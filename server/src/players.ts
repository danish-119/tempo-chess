/**
 * Who a player is to everyone else: a display name they can change (not unique) and a Tempo ID we assign (unique,
 * never changes, never chosen). Two players can both be called "Ali"; their IDs tell them apart.
 */

/** Same alphabet as game codes: no look-alikes (0/O, 1/I/L). 31^7 is about 27 billion IDs. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newTag(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const NAME_MAX = 24;
/** Letters (any language), digits, spaces and a little punctuation; starts with a letter or digit. */
const NAME = new RegExp(`^[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N} _.'-]{1,${NAME_MAX - 1}}$`, "u");

const tidy = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim();

/** A display name a player typed (a guest's nickname, or a new name), tidied, or null when it is not acceptable. */
export function displayName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = tidy(raw);
  return NAME.test(name) ? name : null;
}

/** A name from Google, made to fit: unusual characters dropped, cut to length, never empty. */
export function nameFromProvider(raw: unknown): string {
  const cleaned = tidy(typeof raw === "string" ? raw.replace(/[^\p{L}\p{M}\p{N} _.'-]/gu, "") : "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .slice(0, NAME_MAX)
    .trim();
  return displayName(cleaned) ?? "Player";
}
