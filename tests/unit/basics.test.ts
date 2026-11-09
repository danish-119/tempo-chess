import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { BASICS, type Drill, afterMove, completes, finishSpeech, introSpeech, lessonFen, startSquaresOf, tapCompletes, targetsOf, teachingMoves, trapFor } from "@/lib/learn/basics";

const drills: { id: string; i: number; drill: Drill }[] = BASICS.flatMap((l) => (l.drills ?? []).map((drill, i) => ({ id: l.id, i, drill })));
const uciOf = (m: { from: string; to: string; promotion?: string }) => `${m.from}${m.to}${m.promotion ?? ""}`;

describe("Basics course", () => {
  it("has unique ids, and every position it shows is a real position", () => {
    expect(new Set(BASICS.map((l) => l.id)).size).toBe(BASICS.length);
    for (const l of BASICS) {
      expect(() => new Chess(lessonFen(l)), l.id).not.toThrow();
      for (const e of l.examples ?? []) expect(() => new Chess(e.fen), `${l.id}: ${e.caption}`).not.toThrow();
    }
    for (const { id, i, drill } of drills) expect(() => new Chess(drill.fen), `${id} #${i + 1}`).not.toThrow();
  });

  it("every lesson with practice gives two or three practices, each with something to do", () => {
    for (const l of BASICS) {
      if (!l.drills) continue;
      expect(l.drills.length, l.id).toBeGreaterThanOrEqual(2);
      expect(l.drills.length, l.id).toBeLessThanOrEqual(3);
      expect(l.done, `${l.id} says well done`).toBeTruthy();
      for (const d of l.drills) expect(d.task, l.id).toBeTruthy();
    }
  });

  it("the square-naming practice asks you to tap a named square, with no pieces to know yet", () => {
    const squares = BASICS.find((l) => l.id === "squares")!;
    expect(squares.coords).toBe(true);
    for (const d of squares.drills!) {
      expect(d.goal.kind).toBe("square");
      const sq = d.goal.kind === "square" ? d.goal.square : "";
      expect(sq).toMatch(/^[a-h][1-8]$/);
      expect(d.task).toContain(sq);
      expect(tapCompletes(d, sq)).toBe(true);
      expect(tapCompletes(d, sq === "a1" ? "a2" : "a1")).toBe(false);
      expect(completes(d, "e2e4")).toBe(false);
      expect(teachingMoves(d)).toEqual([]);
    }
    // the lesson comes before any piece is taught
    expect(BASICS.findIndex((l) => l.id === "squares")).toBeLessThan(BASICS.findIndex((l) => l.id === "rook"));
  });

  it("the pieces lesson shows each piece with its name, and where each one starts", () => {
    expect(BASICS.find((l) => l.id === "setup")!.legend).toBe(true);
    expect(startSquaresOf("K").sort()).toEqual(["e1", "e8"]);
    expect(startSquaresOf("Q").sort()).toEqual(["d1", "d8"]);
    expect(startSquaresOf("R").sort()).toEqual(["a1", "a8", "h1", "h8"]);
    expect(startSquaresOf("N").sort()).toEqual(["b1", "b8", "g1", "g8"]);
    expect(startSquaresOf("B").sort()).toEqual(["c1", "c8", "f1", "f8"]);
    expect(startSquaresOf("P")).toHaveLength(16);
  });

  it("every practice can be completed with a legal move", () => {
    for (const { id, i, drill } of drills) {
      if (drill.goal.kind === "square") continue;
      const legal = new Chess(drill.fen).moves({ verbose: true });
      expect(legal.filter((m) => completes(drill, uciOf(m))).length, `${id} #${i + 1} has a solution`).toBeGreaterThan(0);
    }
  });

  it("the starred squares are all reachable by a legal move", () => {
    for (const { id, i, drill } of drills) {
      if (drill.goal.kind !== "move") continue;
      const legal = new Chess(drill.fen).moves({ verbose: true });
      for (const [from, to] of drill.goal.any) expect(legal.some((m) => m.from === from && m.to === to), `${id} #${i + 1}: ${from}${to}`).toBe(true);
      if (!drill.plain) expect(targetsOf(drill).length).toBeGreaterThan(0);
    }
  });

  it("every checkmate practice has a mating move, and other moves do not mate", () => {
    const mates = drills.filter((d) => d.drill.goal.kind === "mate");
    expect(mates.length).toBeGreaterThanOrEqual(10);
    for (const { id, i, drill } of mates) {
      const legal = new Chess(drill.fen).moves({ verbose: true });
      const winning = legal.filter((m) => completes(drill, uciOf(m)));
      expect(winning.length, `${id} #${i + 1}`).toBeGreaterThanOrEqual(1);
      expect(legal.length, `${id} #${i + 1}`).toBeGreaterThan(winning.length);
    }
  });

  it("the check practices start in check", () => {
    for (const { id, i, drill } of drills.filter((d) => ["check", "block", "capture-checker"].includes(d.id))) {
      expect(new Chess(drill.fen).inCheck(), `${id} #${i + 1}`).toBe(true);
    }
  });

  it("the king practice keeps the king off attacked squares: only safe squares are on offer", () => {
    const guarded = BASICS.find((l) => l.id === "king")!.drills![1];
    const moves = new Chess(guarded.fen).moves({ verbose: true }).filter((m) => m.piece === "k");
    expect(moves.map((m) => m.to).sort()).toEqual(["d1", "f1"]);
  });

  it("the stalemate examples are stalemates, the mate examples are mate, and the stalemate traps really stalemate", () => {
    const stale = BASICS.find((l) => l.id === "stalemate")!;
    for (const e of stale.examples!) expect(new Chess(e.fen).isStalemate(), e.caption).toBe(true);
    for (const e of BASICS.find((l) => l.id === "mate")!.examples!) expect(new Chess(e.fen).isCheckmate(), e.caption).toBe(true);
    for (const d of stale.drills!) {
      expect(d.traps?.length).toBeGreaterThan(0);
      for (const t of d.traps!) {
        const after = afterMove(d.fen, `${t.from}${t.to}`);
        expect(after, `${t.from}${t.to} is legal`).not.toBeNull();
        expect(new Chess(after!.fen).isStalemate(), `${t.from}${t.to} is stalemate`).toBe(true);
        expect(trapFor(d, `${t.from}${t.to}`)).toBe(t.say);
      }
    }
  });

  it("the draw examples are positions where nobody can ever mate", () => {
    for (const e of BASICS.find((l) => l.id === "draws")!.examples!) expect(new Chess(e.fen).isInsufficientMaterial(), e.caption).toBe(true);
  });

  it("the en passant practices use a real en passant capture, and the example shows the jump", () => {
    const ep = BASICS.find((l) => l.id === "enpassant")!;
    for (const d of ep.drills!) expect(new Chess(d.fen).moves({ verbose: true }).some((m) => m.flags.includes("e")), d.task).toBe(true);
    expect(ep.examples).toHaveLength(3);
  });

  it("the castling practices castle, and the long one asks for the long castle only", () => {
    for (const id of ["castle", "castle-early"]) {
      for (const d of BASICS.find((l) => l.id === id)!.drills!) {
        const castles = new Chess(d.fen).moves({ verbose: true }).filter((m) => m.flags.includes("k") || m.flags.includes("q"));
        expect(castles.length, `${id}: ${d.task}`).toBeGreaterThan(0);
      }
    }
    const long = BASICS.find((l) => l.id === "castle")!.drills![1];
    expect(completes(long, "e1c1")).toBe(true);
    expect(completes(long, "e1g1")).toBe(false);
  });

  it("promotion practices ask for the piece named: a queen, or a knight that gives check", () => {
    const promote = BASICS.find((l) => l.id === "promote")!;
    const first = promote.drills![0];
    expect(completes(first, "e7e8q")).toBe(true);
    expect(completes(first, "e7e8n")).toBe(false);
    const knight = promote.drills![2];
    expect(completes(knight, "f7f8n")).toBe(true);
    expect(completes(knight, "f7f8q")).toBe(false);
    const after = afterMove(knight.fen, "f7f8n")!;
    expect(new Chess(after.fen).inCheck()).toBe(true);
  });

  it("the coach can show everywhere the piece being taught can go", () => {
    const rook = BASICS.find((l) => l.id === "rook")!.drills![0];
    const moves = teachingMoves(rook);
    expect(moves.length).toBeGreaterThan(5);
    expect(new Set(moves.map((m) => m.from))).toEqual(new Set(["a1"]));
    expect(moves.some((m) => m.to === "a5")).toBe(true);
    // for a check the king is the piece to show
    const check = BASICS.find((l) => l.id === "check")!.drills![0];
    expect(teachingMoves(check).every((m) => m.from === "e1")).toBe(true);
    // for a checkmate there is nothing to give away
    expect(teachingMoves(BASICS.find((l) => l.id === "mate")!.drills![0])).toEqual([]);
  });

  it("every piece has a visual tip: a position to show, with the squares to light up", () => {
    for (const id of ["rook", "bishop", "queen", "king", "knight", "pawn", "capture", "free-piece"]) {
      const tip = BASICS.find((l) => l.id === id)!.tip;
      expect(tip?.text, `${id} has a tip`).toBeTruthy();
      expect(tip?.example, `${id}'s tip can be shown on the board`).toBeTruthy();
      expect(() => new Chess(tip!.example!.fen), id).not.toThrow();
      expect(tip!.example!.glow!.length, id).toBeGreaterThan(0);
      for (const sq of tip!.example!.glow!) expect(sq).toMatch(/^[a-h][1-8]$/);
    }
  });

  it("the knight tip lights exactly the eight squares a centre knight attacks", () => {
    const ex = BASICS.find((l) => l.id === "knight")!.tip!.example!;
    const targets = new Chess(ex.fen)
      .moves({ verbose: true })
      .filter((m) => m.piece === "n")
      .map((m) => m.to)
      .sort();
    expect([...ex.glow!].sort()).toEqual(targets);
  });

  it("capturing is taught as optional: a guarded pawn is a trap, and the traps are legal moves that lose material", () => {
    const free = BASICS.find((l) => l.id === "free-piece")!;
    const guarded = free.drills![2];
    expect(guarded.plain).toBe(true);
    expect(targetsOf(guarded)).toEqual([]);
    expect(teachingMoves(guarded)).toEqual([]);
    expect(trapFor(guarded, "d2d5")).toContain("never have to capture");
    expect(completes(guarded, "d2d5")).toBe(false);
    expect(completes(guarded, "d2d3")).toBe(true);
    expect(afterMove(guarded.fen, "d2d5")).not.toBeNull();
    expect(BASICS.find((l) => l.id === "capture")!.tip!.text).toContain("do not have to capture");
  });

  it("the knight fork lesson: the knight really attacks both pieces, gives check, and cannot just be taken", () => {
    const fork = BASICS.find((l) => l.id === "knight-fork")!;
    expect(fork.examples!.length).toBeGreaterThanOrEqual(2);
    for (const d of fork.drills!) {
      const [[from, to]] = d.goal.kind === "move" ? d.goal.any : [["", ""]];
      const after = afterMove(d.fen, `${from}${to}`)!;
      const chess = new Chess(after.fen);
      expect(chess.inCheck(), `${from}${to} gives check`).toBe(true);
      // the knight is not simply capturable by the king
      expect(chess.moves({ verbose: true }).some((m) => m.to === to && m.captured === "n"), `${from}${to} is not just taken`).toBe(false);
    }
  });

  it("the course covers everything a first-time player needs, in this order", () => {
    expect(BASICS.map((l) => l.id)).toEqual([
      "board", "setup", "squares",
      "rook", "bishop", "queen", "king", "knight", "knight-fork", "pawn",
      "capture", "free-piece", "protect", "values",
      "castle", "enpassant", "promote",
      "check", "legal", "block", "capture-checker", "mate", "stalemate", "draws",
      "mate-rook", "mate-queen", "mate-ladder", "scholar",
      "center", "develop", "castle-early", "opening", "before-move", "endgame",
      "notation", "rules", "ready",
    ]);
  });

  it("the castling examples show when you cannot castle, and each is true", () => {
    const castle = BASICS.find((l) => l.id === "castle")!;
    const sides = (fen: string) => new Chess(fen).moves({ verbose: true }).filter((m) => m.flags.includes("k") || m.flags.includes("q")).map((m) => (m.flags.includes("k") ? "k" : "q"));
    expect(sides(castle.examples![0].fen)).toEqual([]); // in check
    expect(sides(castle.examples![1].fen)).toEqual(["q"]); // f1 is attacked, so not kingside
    expect(sides(castle.examples![2].fen)).toEqual(["k"]); // a piece in the way, so not queenside
  });

  it("the pinned piece cannot move, and the king cannot take a guarded pawn", () => {
    const legal = BASICS.find((l) => l.id === "legal")!;
    const pinned = new Chess(legal.drills![0].fen).moves({ verbose: true });
    expect(pinned.some((m) => m.piece === "b")).toBe(false);
    expect(pinned.length).toBeGreaterThan(0);
    const guarded = new Chess(legal.drills![1].fen);
    expect(guarded.inCheck()).toBe(true);
    expect(guarded.moves({ verbose: true }).some((m) => m.to === "d2")).toBe(false);
  });

  it("the Scholar's mate lesson: Black's good defences stop the mate, the tempting knight move does not", () => {
    const scholar = BASICS.find((l) => l.id === "scholar")!;
    const defend = scholar.drills![0];
    expect(defend.goal.kind === "move" && defend.goal.any.length).toBeGreaterThanOrEqual(4);
    const mateNext = (fen: string) => new Chess(fen).moves({ verbose: true }).some((m) => m.san.endsWith("#"));
    for (const [from, to] of defend.goal.kind === "move" ? defend.goal.any : []) {
      expect(mateNext(afterMove(defend.fen, `${from}${to}`)!.fen), `${from}${to} stops mate`).toBe(false);
    }
    expect(mateNext(afterMove(defend.fen, "g8f6")!.fen), "Nf6 allows mate").toBe(true);
    expect(trapFor(defend, "g8f6")).toContain("checkmate");
    expect(new Chess(scholar.examples![1].fen).isCheckmate()).toBe(true);
  });

  it("some practices are played from Black's side, so the board can turn round", () => {
    const black = drills.filter((d) => d.drill.fen.split(" ")[1] === "b");
    expect(black.map((d) => d.id)).toEqual(expect.arrayContaining(["scholar", "notation"]));
  });

  it("every lesson says something and the longest explanation stays short enough to hear", () => {
    for (const l of BASICS) {
      expect(l.text.length, l.id).toBeGreaterThan(20);
      expect(l.text.length, `${l.id} is too long to listen to`).toBeLessThan(480);
    }
  });

  it("the totals are stated plainly: 64 squares, 32 pieces, 16 each, and how many of each piece", () => {
    const board = BASICS.find((l) => l.id === "board")!;
    expect(board.text).toContain("64 squares");
    expect(board.text).toContain("32 light and 32 dark");
    expect(board.text).toContain("16 pieces, 32 in all");
    expect(BASICS.find((l) => l.id === "setup")!.legend).toBe(true);
    for (const [id, words] of [["rook", "two rooks"], ["bishop", "two bishops"], ["queen", "one queen"], ["king", "one king"], ["knight", "two knights"], ["pawn", "eight pawns"]]) {
      expect(BASICS.find((l) => l.id === id)!.text, id).toContain(words);
    }
  });

  it("the coach follows a finished lesson with its tip", () => {
    const rook = BASICS.find((l) => l.id === "rook")!;
    expect(finishSpeech(rook)).toBe(`${rook.done} A tip. ${rook.tip!.text} ${rook.tip!.example!.caption}`);
    const values = BASICS.find((l) => l.id === "values")!;
    expect(finishSpeech(values)).toBe("");
  });

  it("afterMove returns the next position, or null for an illegal move", () => {
    expect(afterMove(lessonFen(BASICS[0]), "e2e4")?.fen).toContain("4P3");
    expect(afterMove(lessonFen(BASICS[0]), "e2e5")).toBeNull();
  });

  it("the coach introduces a lesson with its title, its idea and what its examples show", () => {
    const rook = BASICS.find((l) => l.id === "rook")!;
    expect(introSpeech(rook)).toBe("The rook. " + rook.text);
    const mate = BASICS.find((l) => l.id === "mate")!;
    expect(introSpeech(mate)).toBe(["Checkmate.", mate.text, ...mate.examples!.map((e) => e.caption)].join(" "));
  });

  it("everything the coach says is written as whole sentences", () => {
    const sentence = (t: string, where: string) => expect(t.trim(), where).toMatch(/^[A-Z0-9"].*[.!?]$/s);
    for (const l of BASICS) {
      sentence(l.text, l.id);
      if (l.done) sentence(l.done, `${l.id} done`);
      if (l.tip) sentence(l.tip.text, `${l.id} tip`);
      if (l.tip?.example) sentence(l.tip.example.caption, `${l.id} tip picture`);
      for (const e of l.examples ?? []) sentence(e.caption, `${l.id} example`);
      for (const d of l.drills ?? []) {
        sentence(d.task, `${l.id} task`);
        for (const t of d.traps ?? []) sentence(t.say, `${l.id} trap`);
      }
    }
  });
});
