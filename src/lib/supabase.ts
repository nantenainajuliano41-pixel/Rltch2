import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured = Boolean(url && anonKey);

// Seules l'URL du projet et la clé publique "anon" sont utilisées ici.
// Si la configuration est absente, l'application affiche un écran d'aide
// avant toute requête (les valeurs de remplacement ne sont jamais utilisées).
export const supabase = createClient(
  isSupabaseConfigured ? url : "http://localhost:54321",
  isSupabaseConfigured ? anonKey : "missing-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
