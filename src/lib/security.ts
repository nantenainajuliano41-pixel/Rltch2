const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Retourne la paire canonique ordonnée (user1_id < user2_id) ou null si invalide / identique. */
export function canonicalPair(a: string, b: string): [string, string] | null {
  if (!isValidUuid(a) || !isValidUuid(b)) return null;
  const normA = a.toLowerCase();
  const normB = b.toLowerCase();
  if (normA === normB) return null;
  return normA < normB ? [normA, normB] : [normB, normA];
}

/** Nettoie et valide une requête de recherche de pseudo (2 à 20 caractères, sans jokers bruts non contrôlés). */
export function sanitizeSearchQuery(raw: string): string | null {
  const clean = raw.replace(/[\r\n\t]+/g, " ").trim();
  if (clean.length < 2 || clean.length > 20) return null;
  return clean;
}

export function validateUsername(raw: string): { valid: boolean; clean: string; error?: string } {
  const clean = raw.replace(/[\r\n\t]+/g, "").trim();
  if (clean.length < 3 || clean.length > 20) {
    return { valid: false, clean, error: "Le pseudo doit contenir entre 3 et 20 caractères." };
  }
  return { valid: true, clean };
}

export function validateMessageContent(raw: string): { valid: boolean; clean: string; error?: string } {
  const clean = raw.trim();
  if (!clean) {
    return { valid: false, clean, error: "Le message est vide." };
  }
  if (clean.length > 2000) {
    return { valid: false, clean, error: "Le message est trop long (2000 caractères maximum)." };
  }
  return { valid: true, clean };
}
