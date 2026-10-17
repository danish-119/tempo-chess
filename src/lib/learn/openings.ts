/**
 * Common openings for the Learn section: the main line, which side it's
 * studied from, and the ideas behind it. Lines are standard theory (checked
 * for legality in tests/unit/learn.test.ts).
 */
export interface OpeningLesson {
  id: string;
  name: string;
  eco: string;
  group: "1.e4 for White" | "1.d4 for White" | "Against 1.e4" | "Against 1.d4" | "Other first moves";
  /** The side you learn it for (the board is shown from this side). */
  side: "w" | "b";
  moves: string;
  summary: string;
  ideas: string[];
}

export const OPENINGS: OpeningLesson[] = [
  // ---- 1.e4 for White
  {
    id: "italian", name: "Italian Game", eco: "C50", group: "1.e4 for White", side: "w",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O",
    summary: "The bishop aims at f7, the weakest square in Black's camp, while White builds a slow centre with c3 and d3 (or d4).",
    ideas: ["Bc4 eyes f7 — watch for Ng5 tricks early on.", "c3 prepares d4 to take over the centre.", "Castle quickly, then reroute the b1-knight via d2–f1–g3."],
  },
  {
    id: "ruy-lopez", name: "Ruy Lopez (Spanish)", eco: "C84", group: "1.e4 for White", side: "w",
    moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3",
    summary: "One of the oldest and richest openings: White pressures the knight that defends e5 and prepares d4 for a lasting edge.",
    ideas: ["Bb5 attacks the defender of e5 rather than e5 itself.", "Re1 protects e4 so Nxe4 is never a worry.", "c3 and h3 prepare d4 without allowing …Bg4."],
  },
  {
    id: "scotch", name: "Scotch Game", eco: "C45", group: "1.e4 for White", side: "w",
    moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7",
    summary: "White opens the centre at once with d4, getting free piece play and a space advantage.",
    ideas: ["Trade the e5-pawn for the d-pawn to open lines early.", "Be3 and c3 support the strong knight on d4.", "Aim for quick development and pressure down the open d-file."],
  },
  {
    id: "kings-gambit", name: "King's Gambit", eco: "C33", group: "1.e4 for White", side: "w",
    moves: "e4 e5 f4 exf4 Nf3 d5 exd5 Nf6 Bc4 Nxd5 O-O",
    summary: "A romantic gambit: White gives the f-pawn to open the f-file and race ahead in development.",
    ideas: ["The open f-file points straight at f7.", "Black's best answer is often to strike back with …d5.", "Castle fast — White's own king is a little exposed."],
  },
  {
    id: "vienna", name: "Vienna Game", eco: "C25", group: "1.e4 for White", side: "w",
    moves: "e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3 Be7",
    summary: "Nc3 first keeps f4 in reserve — a King's Gambit with an extra piece already out.",
    ideas: ["Nc3 guards e4 and prepares f4.", "After f4 the f-file opens for the rook.", "A good surprise weapon at club level."],
  },
  {
    id: "evans", name: "Evans Gambit", eco: "C51", group: "1.e4 for White", side: "w",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O",
    summary: "White sacrifices the b-pawn to gain time with c3 and d4 and build a big centre against the f7-square.",
    ideas: ["b4 deflects the bishop so c3 and d4 come with tempo.", "Fast castling and Ba3 / Qb3 ideas create strong pressure.", "Great for learning attacking play."],
  },
  // ---- 1.d4 for White
  {
    id: "qgd", name: "Queen's Gambit Declined", eco: "D53", group: "1.d4 for White", side: "w",
    moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 Nbd7 Rc1 c6",
    summary: "White offers the c-pawn to deflect Black's d-pawn from the centre; Black declines with …e6 and keeps a solid wall.",
    ideas: ["c4 challenges d5 — it's a 'gambit' in name only, the pawn is easily regained.", "Bg5 pins the f6-knight that defends d5.", "Typical plans: minority attack with b4–b5, or central break e4."],
  },
  {
    id: "qga", name: "Queen's Gambit Accepted", eco: "D27", group: "1.d4 for White", side: "w",
    moves: "d4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6",
    summary: "Black takes the c-pawn and gives up the centre for a while; White regains the pawn and enjoys a central majority.",
    ideas: ["Don't rush to win the pawn back — e3 and Bxc4 do it naturally.", "White's pieces become active; Black aims for …c5 to free the game.", "An isolated d-pawn often appears: know how to play with it."],
  },
  {
    id: "london", name: "London System", eco: "D02", group: "1.d4 for White", side: "w",
    moves: "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3",
    summary: "A system you can play against almost anything: bishop to f4 before e3, then a solid pyramid of pawns.",
    ideas: ["Develop the dark-squared bishop before closing it in with e3.", "c3 + e3 + d4 form a rock-solid structure.", "Plan: Ne5, f4 and a kingside attack."],
  },
  // ---- Against 1.e4
  {
    id: "sicilian-najdorf", name: "Sicilian Defence: Najdorf", eco: "B90", group: "Against 1.e4", side: "b",
    moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6",
    summary: "The most popular fighting reply to 1.e4: Black trades a wing pawn for a central one and plays for a win.",
    ideas: ["…c5 controls d4 from the side and unbalances the game.", "…a6 stops Nb5/Bb5 and prepares …e5 or …b5.", "Black counterattacks on the queenside along the half-open c-file."],
  },
  {
    id: "sicilian-dragon", name: "Sicilian Defence: Dragon", eco: "B70", group: "Against 1.e4", side: "b",
    moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be2 Bg7 O-O O-O",
    summary: "Black fianchettoes the bishop on g7, where it breathes fire down the long diagonal.",
    ideas: ["The g7-bishop is Black's best piece — don't trade it lightly.", "Use the half-open c-file and …Rc8, …Ne5–c4 ideas.", "Sharp: both sides often attack opposite kings."],
  },
  {
    id: "french", name: "French Defence", eco: "C11", group: "Against 1.e4", side: "b",
    moves: "e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7",
    summary: "Solid and strategic: Black challenges e4 with …d5 and later attacks White's pawn chain with …c5 and …f6.",
    ideas: ["Attack the base of the chain (d4) with …c5.", "The light-squared bishop on c8 is often a problem — plan to free it.", "…f6 breaks against e5 when the time is right."],
  },
  {
    id: "caro-kann", name: "Caro-Kann Defence", eco: "B18", group: "Against 1.e4", side: "b",
    moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7",
    summary: "Like the French but the light-squared bishop gets out before …e6. Very solid with a healthy pawn structure.",
    ideas: ["…c6 supports …d5 without blocking the c8-bishop.", "…Bf5–g6 develops the 'problem bishop' early.", "Aim for …e6, …Ngf6 and a sound, slightly passive but safe game."],
  },
  {
    id: "scandinavian", name: "Scandinavian Defence", eco: "B01", group: "Against 1.e4", side: "b",
    moves: "e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5",
    summary: "Black hits e4 immediately. The queen comes out early but finds a safe home on a5.",
    ideas: ["Easy to learn: the first moves are almost always the same.", "Qa5 pins the c3-knight when White's d-pawn moves.", "Develop Bf5 and …e6 for a Caro-Kann-like setup."],
  },
  {
    id: "pirc", name: "Pirc Defence", eco: "B07", group: "Against 1.e4", side: "b",
    moves: "e4 d6 d4 Nf6 Nc3 g6 Nf3 Bg7 Be2 O-O O-O c6",
    summary: "Black lets White build a centre, then attacks it from a safe fianchetto setup.",
    ideas: ["Hypermodern: control the centre from a distance with the g7-bishop.", "Break with …e5 or …c5 at the right moment.", "Flexible but requires care against fast attacks."],
  },
  {
    id: "petrov", name: "Petrov Defence", eco: "C42", group: "Against 1.e4", side: "b",
    moves: "e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3 Nc6",
    summary: "Black counterattacks e4 instead of defending e5 — symmetrical and very hard to beat.",
    ideas: ["Don't take on e4 at once after Nxe5: first …d6 kicks the knight.", "Copying White for too long can be dangerous — know the traps.", "A great drawing weapon with chances to outplay later."],
  },
  // ---- Against 1.d4
  {
    id: "kings-indian", name: "King's Indian Defence", eco: "E92", group: "Against 1.d4", side: "b",
    moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7",
    summary: "Black allows a big centre, castles, then strikes with …e5 and often a pawn storm on the kingside.",
    ideas: ["Plan after d5: …Ne8/…Nd7, …f5 and attack the white king.", "White usually plays on the queenside with c5.", "Very dynamic — races between opposite wings are typical."],
  },
  {
    id: "nimzo", name: "Nimzo-Indian Defence", eco: "E41", group: "Against 1.d4", side: "b",
    moves: "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O",
    summary: "Black pins the c3-knight to stop e4, ready to give the bishop for the knight and damage White's pawns.",
    ideas: ["…Bb4 fights for e4 by pinning its defender.", "…Bxc3 doubles White's c-pawns — target them later.", "Respected at every level, from club to world championship."],
  },
  {
    id: "slav", name: "Slav Defence", eco: "D15", group: "Against 1.d4", side: "b",
    moves: "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4",
    summary: "Black supports d5 with …c6, keeping the c8-bishop free to develop outside the pawn chain.",
    ideas: ["…c6 holds d5 without locking in the light-squared bishop.", "…dxc4 and …Bf5 is the main plan; a4 stops …b5.", "Solid structure with active pieces."],
  },
  {
    id: "dutch", name: "Dutch Defence", eco: "A81", group: "Against 1.d4", side: "b",
    moves: "d4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6",
    summary: "…f5 grabs e4 and prepares a kingside attack, at the cost of a slightly weakened king.",
    ideas: ["Control e4 — it's the key square.", "Attack with …Qe8–h5 and …f4 ideas.", "Careful with the e8–h5 diagonal and early checks."],
  },
  // ---- Other
  {
    id: "english", name: "English Opening", eco: "A29", group: "Other first moves", side: "w",
    moves: "c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6 Nf3 Nc6 O-O",
    summary: "1.c4 controls d5 from the side — like a Sicilian with colours reversed and an extra move.",
    ideas: ["Fianchetto the bishop on g2 to rake the long diagonal.", "Pressure d5 and the queenside with Rb1, a3, b4.", "Flexible: can transpose into many 1.d4 openings."],
  },
  {
    id: "reti", name: "Réti Opening", eco: "A09", group: "Other first moves", side: "w",
    moves: "Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3 c5 Bb2",
    summary: "Hypermodern: develop the knight, then attack Black's centre from the flanks with c4 and fianchettoed bishops.",
    ideas: ["Delay central pawn moves; let Black commit first.", "Two fianchettoed bishops pressure the centre from afar.", "Good for players who like flexible, positional games."],
  },
];

export const OPENING_GROUPS = [...new Set(OPENINGS.map((o) => o.group))];

export function openingById(id: string | null | undefined): OpeningLesson | null {
  return OPENINGS.find((o) => o.id === id) ?? null;
}
