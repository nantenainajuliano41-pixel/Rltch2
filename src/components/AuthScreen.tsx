import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { validateUsername } from "../lib/security";
import { ChatIcon, Spinner } from "./Icons";

type Mode = "login" | "signup";

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setInfo(null);

    if (mode === "signup") {
      const check = validateUsername(username);
      if (!check.valid) {
        setError(check.error ?? "Pseudo invalide.");
        return;
      }
      if (password.length < 6) {
        setError("Mot de passe trop court : 6 caractères minimum.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        const res = await signIn(email, password);
        if (res.error) setError(res.error);
      } else {
        const res = await signUp(email, password, username);
        if (res.error) {
          setError(res.error);
        } else if (res.needsConfirmation) {
          setInfo(
            "Compte créé ! Vérifiez vos emails et cliquez sur le lien de confirmation, puis connectez-vous."
          );
          setMode("login");
          setPassword("");
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200">
            <ChatIcon width={28} height={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Messagerie privée</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connectez-vous pour discuter en privé en temps réel.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${
                  mode === m ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "login" ? "Connexion" : "Inscription"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
            {mode === "signup" && (
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Pseudo
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={submitting}
                  placeholder="Votre pseudo (unique)"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                placeholder="vous@exemple.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={mode === "signup" ? 6 : undefined}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                placeholder={mode === "signup" ? "6 caractères minimum" : "Votre mot de passe"}
                className={inputClass}
              />
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {info && (
              <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-500 hover:to-violet-500 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Spinner />}
              {submitting
                ? mode === "login"
                  ? "Connexion…"
                  : "Création du compte…"
                : mode === "login"
                  ? "Se connecter"
                  : "Créer mon compte"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
