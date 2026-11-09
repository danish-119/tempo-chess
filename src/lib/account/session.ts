/**
 * Who is using the app right now:
 * - "loading": still finding out;
 * - "visitor": no session yet. Nothing is saved until they save something, which makes them a guest;
 * - "user": a player with a session, either a Google account or a guest (`player.guest`). Their data lives on the
 *   Tempo server; a guest's lasts while they come back, on this browser.
 * A tiny store that React components and plain modules can both read.
 */
export interface Player {
  id: string;
  email: string;
  /** The display name: their Google name, a nickname they chose, or "Guest". Not unique. */
  name: string;
  image: string | null;
  /** The Tempo ID we assigned, such as 4K7F2QD: unique, so players with the same name are told apart. */
  tag: string;
  /** A guest (not signed in with Google). */
  guest: boolean;
}

export type AccountState = { status: "loading" } | { status: "visitor" } | { status: "user"; player: Player };

let state: AccountState = { status: "loading" };
const listeners = new Set<() => void>();

export function getAccount(): AccountState {
  return state;
}

export function setAccount(next: AccountState): void {
  state = next;
  for (const l of listeners) l();
}

export function subscribeAccount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The player with a session (an account or a guest), or null for a visitor (or while still loading). */
export function currentPlayer(): Player | null {
  return state.status === "user" ? state.player : null;
}

/** Resolves once we know whether there is a session. */
export function accountReady(): Promise<AccountState> {
  if (state.status !== "loading") return Promise.resolve(state);
  return new Promise((resolve) => {
    const off = subscribeAccount(() => {
      if (state.status === "loading") return;
      off();
      resolve(state);
    });
  });
}

/**
 * A visitor's first save makes them a guest (see guest.ts, which registers how). Storage modules call this without
 * importing the sign-in code, which keeps them free of a dependency cycle.
 */
let starter: (() => void) | null = null;
export function onFirstSave(fn: () => void): void {
  starter = fn;
}
export function firstSave(): void {
  if (state.status === "visitor") starter?.();
}
