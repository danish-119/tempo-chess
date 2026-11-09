import { describe, expect, it } from "vitest";
import {
  FIRST_MOVE_MS,
  LAG_PER_MOVE_MS,
  type GameState,
  type Player,
  cancel,
  checkTime,
  deadline,
  join,
  newGame,
  offerDraw,
  playMove,
  resign,
  timeControl,
  timeLeft,
  toPgn,
} from "../src/game/rules";

const anna: Player = { id: "anna", name: "Anna", tag: "AAAAAAA", image: null };
const ben: Player = { id: "ben", name: "Ben", tag: "BBBBBBB", image: null };
const cara: Player = { id: "cara", name: "Cara", tag: "CCCCCCC", image: null };
const T0 = 1_000_000;

/** A started 3+2 game: Anna is White, Ben is Black. */
function started(tc = "3+2"): GameState {
  const g = join(newGame("ABC234", timeControl(tc)!, anna, "w", T0), ben, T0);
  if (typeof g === "string") throw new Error(g);
  return g;
}

function play(g: GameState, userId: string, uci: string, at: number, lag = 0): GameState {
  const r = playMove(g, userId, uci, at, lag);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe("joining", () => {
  it("seats the second player and settles colours", () => {
    const g = started();
    expect(g.status).toBe("playing");
    expect(g.players.w?.id).toBe("anna");
    expect(g.players.b?.id).toBe("ben");
  });

  it("draws colours fairly when the creator chose random", () => {
    const g = newGame("ABC234", timeControl("5+0")!, anna, "random", T0);
    expect((join(g, ben, T0, () => 0.1) as GameState).players.w?.id).toBe("anna");
    expect((join(g, ben, T0, () => 0.9) as GameState).players.w?.id).toBe("ben");
  });

  it("refuses the creator and a full game", () => {
    const open = newGame("ABC234", timeControl("5+0")!, anna, "w", T0);
    expect(join(open, anna, T0)).toMatch(/cannot play yourself/);
    expect(join(started(), cara, T0)).toMatch(/already started/);
  });

  it("an unused game code lapses after an hour", () => {
    const invite = newGame("ABC234", timeControl("5+0")!, anna, "w", T0);
    expect(checkTime(invite, T0 + 30 * 60_000).status).toBe("waiting");
    expect(checkTime(invite, T0 + 60 * 60_000).result?.reason).toBe("expired");
  });

  it("only the creator can cancel a game before it starts", () => {
    const open = newGame("ABC234", timeControl("5+0")!, anna, "w", T0);
    expect(cancel(open, "ben", T0)).toMatch(/Only the player/);
    expect((cancel(open, "anna", T0) as GameState).result?.reason).toBe("aborted");
  });
});

describe("moves", () => {
  it("accepts legal moves in turn and refuses everything else", () => {
    let g = started();
    expect(playMove(g, "ben", "e7e5", T0).ok).toBe(false); // not his turn
    expect(playMove(g, "cara", "e2e4", T0).ok).toBe(false); // not in the game
    expect(playMove(g, "anna", "e2e5", T0).ok).toBe(false); // illegal
    expect(playMove(g, "anna", "<script>", T0).ok).toBe(false); // not a move
    g = play(g, "anna", "e2e4", T0 + 1000);
    expect(g.sans).toEqual(["e4"]);
    expect(g.fen).toContain("4P3");
  });

  it("detects checkmate, and the result names the winner", () => {
    let g = started();
    const at = (n: number) => T0 + n * 1000;
    for (const [i, [who, m]] of (
      [
        ["anna", "f2f3"],
        ["ben", "e7e5"],
        ["anna", "g2g4"],
        ["ben", "d8h4"],
      ] as const
    ).entries())
      g = play(g, who, m, at(i + 1));
    expect(g.status).toBe("ended");
    expect(g.result).toEqual({ result: "0-1", reason: "checkmate", winner: "b" });
    expect(toPgn(g)).toContain("1. f3 e5 2. g4 Qh4# 0-1");
  });

  it("detects a draw by threefold repetition", () => {
    let g = started();
    let t = T0;
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    for (let i = 0; i < 8 && g.status === "playing"; i++) g = play(g, i % 2 ? "ben" : "anna", shuffle[i % 4], (t += 500));
    expect(g.result?.reason).toBe("threefold");
  });
});

describe("clocks", () => {
  it("White's clock does not run before the first move", () => {
    const g = started();
    expect(timeLeft(g, "w", T0 + 20_000)).toBe(180_000);
  });

  it("charges thinking time measured on the server, and adds the increment", () => {
    let g = play(started(), "anna", "e2e4", T0 + 5_000); // first move: free
    g = play(g, "ben", "e7e5", T0 + 15_000); // Black thought 10 s
    expect(g.clock?.b).toBe(180_000 - 10_000 + 2_000);
  });

  it("forgives a little network delay, but never more than the per-move cap", () => {
    let g = play(started(), "anna", "e2e4", T0);
    g = play(g, "ben", "e7e5", T0 + 10_000, 5_000); // claims 5 s of lag
    expect(g.clock?.b).toBe(180_000 - (10_000 - LAG_PER_MOVE_MS) + 2_000);
    expect(g.lagQuota.b).toBeLessThan(3_000);
  });

  it("a move that arrives after the flag fell loses on time", () => {
    let g = play(started("1+0"), "anna", "e2e4", T0);
    const r = playMove(g, "ben", "e7e5", T0 + 61_000);
    expect(r.ok && r.state.result?.reason).toBe("timeout");
    g = r.ok ? r.state : g;
    expect(g.result?.result).toBe("1-0");
  });

  it("the alarm flags the side to move, and calls off a game nobody started", () => {
    const g = play(started("1+0"), "anna", "e2e4", T0);
    expect(deadline(g)).toBe(T0 + 60_000);
    expect(checkTime(g, T0 + 59_000).status).toBe("playing");
    expect(checkTime(g, T0 + 60_000).result).toEqual({ result: "1-0", reason: "timeout", winner: "w" });
    const fresh = started();
    expect(deadline(fresh)).toBe(T0 + FIRST_MOVE_MS);
    expect(checkTime(fresh, T0 + FIRST_MOVE_MS).result?.reason).toBe("aborted");
  });

  it("running out of time is a draw when the opponent cannot possibly mate", () => {
    const g = { ...started("1+0"), fen: "8/8/8/4k3/8/8/4K3/7N b - - 0 40", moves: ["a", "b"], sans: ["x", "y"], turnStartedAt: T0 };
    // Black to move runs out; White has only a knight.
    expect(checkTime(g, T0 + 61_000).result).toEqual({ result: "1/2-1/2", reason: "timeout-insufficient", winner: null });
  });

  it("untimed games have no deadline after the first move", () => {
    const g = play(started("none"), "anna", "e2e4", T0);
    expect(deadline(g)).toBeNull();
  });
});

describe("resigning and draws", () => {
  it("leaving before both players have moved calls the game off; later it is a resignation", () => {
    const g = started();
    expect((resign(g, "anna", T0) as GameState).result?.result).toBe("*");
    let h = play(g, "anna", "e2e4", T0);
    h = play(h, "ben", "e7e5", T0 + 1000);
    expect((resign(h, "anna", T0 + 2000) as GameState).result).toEqual({ result: "0-1", reason: "resign", winner: "b" });
  });

  it("an offer accepted by the other player is a draw; moving instead lets it lapse", () => {
    let g = play(started(), "anna", "e2e4", T0);
    g = offerDraw(g, "anna", T0) as GameState;
    expect(g.drawOffer).toBe("w");
    g = play(g, "ben", "e7e5", T0 + 1000);
    expect(g.drawOffer).toBeNull();
    g = offerDraw(g, "anna", T0 + 2000) as GameState;
    g = offerDraw(g, "ben", T0 + 3000) as GameState;
    expect(g.result).toEqual({ result: "1/2-1/2", reason: "agreement", winner: null });
  });
});
