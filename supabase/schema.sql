-- =====================================================================
--  Messagerie privée temps réel (1-à-1) — Schéma Supabase complet
--  À coller et exécuter en une seule fois dans :
--  Supabase > SQL Editor > New query > Run
--  Le script est idempotent et conçu contre toute incursion (IDOR,
--  usurpation d'identité, fuite de messages ou injection LIKE).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- Profils : une ligne par utilisateur inscrit (liée à auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique,
  created_at  timestamptz not null default now(),
  constraint profiles_username_length check (char_length(btrim(username)) between 3 and 20),
  constraint profiles_username_safe check (username !~ '[\r\n\t]')
);

-- Pseudo unique sans tenir compte de la casse (« Marie » = « marie »)
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Conversations individuelles (1-à-1)
-- user1_id < user2_id garantit l'unicité canonique d'une paire d'utilisateurs
create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  user1_id             uuid not null references public.profiles (id) on delete cascade,
  user2_id             uuid not null references public.profiles (id) on delete cascade,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now(),
  constraint conversations_distinct_users check (user1_id <> user2_id),
  constraint conversations_canonical_order check (user1_id < user2_id),
  constraint conversations_pair_unique unique (user1_id, user2_id)
);

create index if not exists conversations_user1_idx
  on public.conversations (user1_id, last_message_at desc);

create index if not exists conversations_user2_idx
  on public.conversations (user2_id, last_message_at desc);

-- Messages privés
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now(),
  constraint messages_content_length check (
    char_length(btrim(content)) between 1 and 2000
  )
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------
-- 2. TRIGGER : création automatique du profil à l'inscription
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := nullif(regexp_replace(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')), '[\r\n\t]+', '', 'g'), '');

  if v_username is null or char_length(v_username) < 3 or char_length(v_username) > 20 then
    v_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. TRIGGERS : mise à jour sécurisée du dernier message
-- ---------------------------------------------------------------------

create or replace function public.sync_conversation_last_message_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = new.created_at,
    last_message_preview = left(new.content, 100)
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;
create trigger on_message_inserted
  after insert on public.messages
  for each row execute function public.sync_conversation_last_message_on_insert();

create or replace function public.sync_conversation_last_message_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last record;
begin
  select created_at, content
  into v_last
  from public.messages
  where conversation_id = old.conversation_id
  order by created_at desc
  limit 1;

  update public.conversations
  set
    last_message_at = v_last.created_at,
    last_message_preview = case when v_last.content is null then null else left(v_last.content, 100) end
  where id = old.conversation_id;

  return old;
end;
$$;

drop trigger if exists on_message_deleted on public.messages;
create trigger on_message_deleted
  after delete on public.messages
  for each row execute function public.sync_conversation_last_message_on_delete();

-- ---------------------------------------------------------------------
-- 4. FONCTIONS RPC SÉCURISÉES
-- ---------------------------------------------------------------------

-- Vérifier la disponibilité d'un pseudo avant inscription (booléen uniquement)
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(btrim(p_username))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Rechercher un utilisateur par pseudo (authentifié uniquement, anti-injection LIKE)
create or replace function public.search_users_by_username(p_query text)
returns table (id uuid, username text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text;
  v_escaped text;
begin
  if v_uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  v_clean := btrim(coalesce(p_query, ''));
  if char_length(v_clean) < 2 or char_length(v_clean) > 20 then
    return;
  end if;

  -- Échappe les jokers LIKE (!, %, _) pour empêcher le scraping par motif
  v_escaped := replace(replace(replace(v_clean, '!', '!!'), '%', '!%'), '_', '!_');

  return query
  select p.id, p.username
  from public.profiles p
  where p.id <> v_uid
    and p.username ilike '%' || v_escaped || '%' escape '!'
  order by
    (lower(p.username) = lower(v_clean)) desc,
    (lower(p.username) like lower(v_escaped) || '%' escape '!') desc,
    p.username asc
  limit 10;
end;
$$;

revoke all on function public.search_users_by_username(text) from public;
grant execute on function public.search_users_by_username(text) to authenticated;

-- Envoyer un message privé (crée la conversation canonique si elle n'existe pas encore)
create or replace function public.send_direct_message(
  p_recipient_id uuid,
  p_content text
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  content text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_clean text;
  v_u1 uuid;
  v_u2 uuid;
  v_conv_id uuid;
begin
  if v_sender_id is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  if p_recipient_id is null or p_recipient_id = v_sender_id then
    raise exception 'Destinataire invalide' using errcode = '22023';
  end if;

  if not exists (select 1 from public.profiles where profiles.id = p_recipient_id) then
    raise exception 'Destinataire introuvable' using errcode = '22023';
  end if;

  v_clean := btrim(coalesce(p_content, ''));
  if char_length(v_clean) < 1 or char_length(v_clean) > 2000 then
    raise exception 'Contenu invalide' using errcode = '23514';
  end if;

  v_u1 := least(v_sender_id, p_recipient_id);
  v_u2 := greatest(v_sender_id, p_recipient_id);

  insert into public.conversations (user1_id, user2_id)
  values (v_u1, v_u2)
  on conflict (user1_id, user2_id) do nothing;

  select c.id into v_conv_id
  from public.conversations c
  where c.user1_id = v_u1 and c.user2_id = v_u2;

  return query
  insert into public.messages (conversation_id, sender_id, content)
  values (v_conv_id, v_sender_id, v_clean)
  returning
    messages.id,
    messages.conversation_id,
    messages.sender_id,
    messages.content,
    messages.created_at;
end;
$$;

revoke all on function public.send_direct_message(uuid, text) from public;
grant execute on function public.send_direct_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (ANTI-INCURSION)
-- ---------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

alter table public.profiles      force row level security;
alter table public.conversations force row level security;
alter table public.messages      force row level security;

-- Privilèges SQL minimaux : zéro accès anon, zéro écriture directe sur profiles/conversations
revoke all on public.profiles      from anon, authenticated;
revoke all on public.conversations from anon, authenticated;
revoke all on public.messages      from anon, authenticated;

grant select                 on public.profiles      to authenticated;
grant select                 on public.conversations to authenticated;
grant select, insert, delete on public.messages      to authenticated;

-- ----- profiles -----
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- ----- conversations -----
-- Lecture strictement limitée aux deux participants (user1_id ou user2_id)
drop policy if exists "conversations_select_participants" on public.conversations;
create policy "conversations_select_participants"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user1_id or auth.uid() = user2_id);

-- ----- messages -----
-- Lecture strictement limitée aux participants de la conversation
drop policy if exists "messages_select_participants" on public.messages;
create policy "messages_select_participants"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- Insertion : expéditeur réel + membre vérifié de la conversation
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- Suppression : uniquement ses propres messages dans ses propres conversations
drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
  on public.messages for delete
  to authenticated
  using (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------
-- 6. REALTIME (filtré automatiquement par les politiques RLS ci-dessus)
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- Force PostgREST à recharger immédiatement le cache des tables et fonctions RPC
notify pgrst, 'reload schema';
