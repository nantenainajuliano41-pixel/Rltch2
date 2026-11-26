# 💬 Messagerie privée en temps réel

Application de discussion individuelle (1-à-1) : **React + Vite + Tailwind CSS** côté frontend, **Supabase** pour le backend (Auth, PostgreSQL + RLS strict, Realtime), et le pack **Noto Color Emoji**.

Seuls les utilisateurs inscrits et connectés peuvent rechercher un pseudo et échanger des messages privés. Pour démarrer une discussion avec une nouvelle personne, il suffit de rechercher son pseudo ; dès que le premier message est envoyé, la conversation apparaît durablement dans votre liste de discussions des deux côtés.

## 1. Configurer Supabase

1. Créez un projet sur <https://supabase.com>.
2. **Lancer le SQL** : menu **SQL Editor** → **New query** → copiez-collez tout le contenu de `supabase/schema.sql` → **Run**.
3. **Récupérer les clés** : **Project Settings → API** :
   - `VITE_SUPABASE_URL` (Project URL)
   - `VITE_SUPABASE_ANON_KEY` (clé `anon` publique uniquement — jamais `service_role`)
4. Vérifiez que **Database → Publications → `supabase_realtime`** contient bien `messages` et `conversations`.

## 2. Sécurité (anti-incursion)

- **Isolation stricte des conversations (RLS forcé)** : un utilisateur ne peut lire que les `conversations` où `auth.uid() = user1_id` ou `auth.uid() = user2_id`, et uniquement les `messages` appartenant à ses propres conversations.
- **Aucune usurpation ni écriture directe non contrôlée** : la création de conversation passe par la fonction SQL sécurisée `send_direct_message` (qui impose `user1_id < user2_id`, interdit l'envoi à soi-même et vérifie l'existence du destinataire). L'insertion directe de `conversations` et la modification de messages sont révoquées.
- **Recherche de pseudo protégée** : `search_users_by_username` exige une session authentifiée, échappe les jokers `LIKE` (`%`, `_`, `\`) et limite les résultats à 10 profils sans exposer d'email.
- **Protection XSS** : tout contenu est rendu comme texte React (aucun `dangerouslySetInnerHTML`).
