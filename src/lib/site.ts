/** Public site configuration. Set NEXT_PUBLIC_SITE_URL at build time. */
export const SITE = {
  name: "Tempo",
  tagline: "Play, review and improve at chess — free",
  description:
    "Play bots or a coach, review your Chess.com, Lichess and PGN games move by move, solve puzzles, master endgames and learn openings — free, private, no account. Stockfish runs in your browser.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  /** Public source repository (required for GPL source availability). */
  repoUrl: process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/danish-119/tempo-chess",
  author: { name: "Danish", url: "https://danish-developer.vercel.app/" },
  /** WhatsApp number in international format, digits only (used for a wa.me link). */
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "923001877119",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "mdanish.software.dev@gmail.com",
};

/** Primary navigation. `match` lists the routes that highlight each item. */
export const NAV = [
  { href: "/play", label: "Play", match: ["/play"] },
  { href: "/review", label: "Review", match: ["/review", "/analyze"] },
  { href: "/practice", label: "Practice", match: ["/practice"] },
  { href: "/learn", label: "Learn", match: ["/learn"] },
  { href: "/editor", label: "Editor", match: ["/editor"] },
] as const;
