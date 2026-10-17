import { START_FEN } from "@/lib/chess/types";

/** EPD → [ECO, name]. Data: lichess-org/chess-openings (CC0-1.0). */
export type OpeningTable = Record<string, [string, string]>;

export interface OpeningInfo {
  eco: string;
  name: string;
  /** Number of plies from the start that are consecutive book moves. */
  bookPlies: number;
}

let tablePromise: Promise<OpeningTable> | null = null;

/** Lazy-load the opening table (~200 KB) only when it is needed. */
export function loadOpeningTable(): Promise<OpeningTable> {
  tablePromise ??= import("@/data/openings.json").then((m) => m.default as unknown as OpeningTable);
  return tablePromise;
}

export function toEpd(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

/**
 * Book policy: a ply counts as "book" only if the game began from the
 * standard starting position and every position up to and including the
 * one after this ply exists in the opening table. The first ply that leaves
 * the table ends the book phase for good, even if a later position
 * transposes back in.
 */
export function identifyOpening(table: OpeningTable, startFen: string, fensAfterMoves: string[]): OpeningInfo | null {
  if (toEpd(startFen) !== toEpd(START_FEN)) return null;
  let best: [string, string] | null = null;
  let bookPlies = 0;
  for (const fen of fensAfterMoves) {
    const hit = table[toEpd(fen)];
    if (!hit) break;
    best = hit;
    bookPlies++;
  }
  return best ? { eco: best[0], name: best[1], bookPlies } : null;
}

/** Strategic notes for broad opening families, matched by name prefix. */
const OPENING_IDEAS: { prefix: string; idea: string }[] = [
  { prefix: "Sicilian Defense", idea: "Black fights for the centre asymmetrically with …c5, accepting a lead in development for White in exchange for counter-chances on the queenside and the half-open c-file." },
  { prefix: "French Defense", idea: "Black builds a solid pawn chain with …e6 and …d5, often counter-attacking White's centre with …c5 and …f6; the light-squared bishop can be hard to activate." },
  { prefix: "Caro-Kann Defense", idea: "Black supports …d5 with …c6, aiming for a sound structure and a freely developed light-squared bishop." },
  { prefix: "Ruy Lopez", idea: "White pressures the knight that defends e5, building long-term pressure on Black's centre; play is often slow and strategic." },
  { prefix: "Italian Game", idea: "White develops the bishop to c4 aiming at f7 and prepares a central break with c3 and d4." },
  { prefix: "Scotch Game", idea: "White opens the centre immediately with d4, gaining space and open lines for the pieces." },
  { prefix: "Queen's Gambit", idea: "White offers the c-pawn to deflect Black's d5-pawn and gain central control." },
  { prefix: "Slav Defense", idea: "Black defends d5 with …c6, keeping the light-squared bishop free to develop outside the pawn chain." },
  { prefix: "King's Indian Defense", idea: "Black allows White a big centre and then strikes back with …e5 or …c5, often with a kingside pawn storm." },
  { prefix: "Nimzo-Indian Defense", idea: "Black pins the c3-knight to control e4, often giving up the bishop pair to damage White's pawns." },
  { prefix: "Grünfeld Defense", idea: "Black lets White build a broad centre and then attacks it with pieces and …c5." },
  { prefix: "English Opening", idea: "White controls d5 from the flank with c4, keeping options to transpose into many structures." },
  { prefix: "London System", idea: "White sets up Bf4, e3, d4 and c3 in a solid, repeatable structure with few forcing lines." },
  { prefix: "Scandinavian Defense", idea: "Black challenges e4 at once; the queen often recaptures early, trading time for a simple structure." },
  { prefix: "Pirc Defense", idea: "Black fianchettoes and invites White to over-extend in the centre before counter-attacking it." },
  { prefix: "Dutch Defense", idea: "Black controls e4 with …f5, aiming for kingside activity at the cost of some king safety." },
  { prefix: "Petrov's Defense", idea: "Black mirrors White's attack on e4, aiming for a solid, symmetrical position." },
  { prefix: "King's Gambit", idea: "White sacrifices the f-pawn to open the f-file and build a quick attack on f7." },
  { prefix: "Vienna Game", idea: "White develops Nc3 first, keeping the option of an early f4 break." },
  { prefix: "Four Knights Game", idea: "Both sides develop knights symmetrically; play is solid and principled." },
];

export function openingIdea(name: string): string | null {
  return OPENING_IDEAS.find((o) => name.startsWith(o.prefix))?.idea ?? null;
}
