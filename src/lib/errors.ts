interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

/** Traduit une erreur Supabase Auth en message français lisible. */
export function translateAuthError(error: ErrorLike | null | undefined): string {
  if (!error) return "Une erreur inconnue est survenue.";
  const msg = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Votre email n'est pas encore confirmé. Vérifiez votre boîte mail (et vos spams) puis cliquez sur le lien reçu.";
  }
  if (
    code === "user_already_exists" ||
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered")
  ) {
    return "Cette adresse email est déjà utilisée. Connectez-vous ou utilisez une autre adresse.";
  }
  if (code === "weak_password" || msg.includes("password should be at least") || msg.includes("weak password")) {
    return "Mot de passe trop court ou trop faible : 6 caractères minimum.";
  }
  if (code === "validation_failed" || msg.includes("unable to validate email") || msg.includes("invalid email")) {
    return "Adresse email invalide.";
  }
  if (msg.includes("database error saving new user")) {
    return "Impossible de créer le compte : ce pseudo est probablement déjà utilisé ou invalide.";
  }
  if (code === "over_email_send_rate_limit" || msg.includes("rate limit") || error.status === 429) {
    return "Trop de tentatives. Patientez quelques instants avant de réessayer.";
  }
  if (code === "signup_disabled" || msg.includes("signups not allowed")) {
    return "Les inscriptions sont désactivées pour le moment.";
  }
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network request failed")) {
    return "Connexion impossible au serveur. Vérifiez votre connexion internet.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}

/** Traduit une erreur PostgREST / base de données en message français. */
export function translateDbError(error: ErrorLike | null | undefined): string {
  if (!error) return "Une erreur inconnue est survenue.";
  const msg = (error.message ?? "").toLowerCase();

  if (error.code === "23505" || msg.includes("duplicate key")) {
    return "Cette discussion existe déjà.";
  }
  if (error.code === "42501" || msg.includes("row-level security")) {
    return "Action non autorisée.";
  }
  if (error.code === "22023") {
    return "Destinataire introuvable ou invalide.";
  }
  if (error.code === "23514") {
    return "Contenu invalide (trop long ou vide).";
  }
  if (msg.includes("failed to fetch") || msg.includes("networkerror")) {
    return "Connexion impossible au serveur. Vérifiez votre connexion internet.";
  }
  return "Une erreur est survenue. Veuillez réessayer.";
}
