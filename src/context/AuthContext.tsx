import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { translateAuthError } from "../lib/errors";
import { validateUsername } from "../lib/security";

interface SignUpResult {
  error?: string;
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  username: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, username: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfileName(null);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data?.username) setProfileName(data.username as string);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: translateAuthError(error) };
    return {};
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, username: string): Promise<SignUpResult> => {
      const check = validateUsername(username);
      if (!check.valid) {
        return { error: check.error ?? "Pseudo invalide." };
      }

      const { data: available, error: rpcError } = await supabase.rpc("is_username_available", {
        p_username: check.clean,
      });
      if (!rpcError && available === false) {
        return { error: "Ce pseudo est déjà utilisé. Choisissez-en un autre." };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: check.clean } },
      });

      if (error) return { error: translateAuthError(error) };

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          error: "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.",
        };
      }

      if (!data.session) return { needsConfirmation: true };

      return {};
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const metaName =
      typeof user?.user_metadata?.username === "string" ? (user.user_metadata.username as string) : "";
    return {
      session,
      user,
      username: profileName ?? (metaName || "Moi"),
      loading,
      signIn,
      signUp,
      signOut,
    };
  }, [session, profileName, loading, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
