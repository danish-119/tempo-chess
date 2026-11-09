import { API_URL } from "@/lib/api";
import { uploadMemory } from "@/lib/storage/db";
import { authClient } from "./auth-client";
import { adoptDocs } from "./docs";
import { type Player, getAccount, setAccount } from "./session";

/**
 * Guests: a visitor becomes one by choosing a nickname and a picture, when their first save asks or when they play
 * online. (Choosing Google there also starts a guest for a moment, to hold what they did while they are away at
 * Google; signing in then moves it into their account.)
 *
 * The server creates a guest session (a cookie; nothing is written to browser storage) and the guest gets a Tempo ID
 * like anyone else. Whatever the visitor did before that moment is still in memory, so it is uploaded straight
 * away: a lesson finished a minute before signing in is not lost.
 */
export interface GuestProfile {
  name: string;
  avatar: { style: string; seed: string };
}

/** The DiceBear picture for a style and seed; the server rebuilds it with that style's fixed options. */
export const guestPictureUrl = (style: string, seed: string) => `https://api.dicebear.com/9.x/${style}/png?seed=${seed}`;

interface ServerUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  tag: string;
}

let starting: Promise<Player> | null = null;

/** Become a guest, optionally with a nickname and picture; resolves with the player (or the current one). */
export function startGuest(profile?: GuestProfile): Promise<Player> {
  const now = getAccount();
  if (now.status === "user") return Promise.resolve(now.player);
  starting ??= (async () => {
    try {
      const { data, error } = await authClient.$fetch<{ user: ServerUser }>("/sign-in/anonymous", { method: "POST", body: profile ?? {} });
      if (error || !data) throw Object.assign(new Error(error?.message || "Could not start a guest session."), { status: error?.status });
      const u = data.user;
      const player: Player = { id: u.id, email: u.email, name: u.name, image: u.image ? `${API_URL}/api/avatar/${u.id}` : null, tag: u.tag, guest: true };
      // Set at once, so the account provider sees this session as already handled and keeps what is in memory.
      setAccount({ status: "user", player });
      await Promise.all([adoptDocs(), uploadMemory()]);
      return player;
    } finally {
      starting = null;
    }
  })();
  return starting;
}
