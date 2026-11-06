import { describe, expect, it } from "vitest";
import type { CoachFeedback } from "@/lib/coach";
import { coachSpeechText, forSpeech, pickVoice, sanToSpeech } from "@/lib/speech";

describe("sanToSpeech", () => {
  it("reads common notation as words", () => {
    expect(sanToSpeech("e4")).toBe("pawn to e4");
    expect(sanToSpeech("Nf3")).toBe("knight to f3");
    expect(sanToSpeech("Nbd2")).toBe("knight from b to d2");
    expect(sanToSpeech("exd5")).toBe("pawn from e takes d5");
    expect(sanToSpeech("Qxh7#")).toBe("queen takes h7, checkmate");
    expect(sanToSpeech("Bb5+")).toBe("bishop to b5, check");
    expect(sanToSpeech("O-O")).toBe("castles king-side");
    expect(sanToSpeech("O-O-O")).toBe("queen-side castles");
    expect(sanToSpeech("e8=Q")).toBe("pawn to e8, promotes to queen");
  });
});

describe("coachSpeechText", () => {
  const fb = (classification: CoachFeedback["classification"], bestSan: string | null): CoachFeedback => ({
    classification,
    explanation: { text: "It hangs a knight.", motifs: [], verified: true },
    square: "f3",
    bestSan,
    evalAfter: { kind: "cp", value: 0 },
  });
  it("adds the better move after an error", () => {
    expect(coachSpeechText(fb("blunder", "Qd2"), "Nf3")).toBe("knight to f3 is a blunder. It hangs a knight. A better move was queen to d2.");
  });
  it("does not nag after a good move", () => {
    expect(coachSpeechText(fb("best", "Nf3"), "Nf3")).toBe("knight to f3 is best. It hangs a knight.");
  });
});

describe("pickVoice", () => {
  const v = (name: string, lang: string, def = false) => ({ name, lang, default: def }) as SpeechSynthesisVoice;
  it("prefers natural English voices and ignores other languages", () => {
    const voices = [v("Hans", "de-DE", true), v("Basic", "en-US", true), v("Microsoft Aria Online (Natural)", "en-US")];
    expect(pickVoice(voices)?.name).toBe("Microsoft Aria Online (Natural)");
    expect(pickVoice([v("Hans", "de-DE")])).toBeNull();
  });
});

describe("forSpeech", () => {
  it("drops sentences that quote evaluation numbers", () => {
    const text = "Compare d4: the engine rates the position +0.44 there, but only −0.11 after this move.";
    expect(forSpeech(text)).toBe("");
    expect(forSpeech("The win slips away. From +3.50 to +0.10, which is a lot.")).toBe("The win slips away.");
    expect(forSpeech("It loses a pawn. The engine prefers Nf3 (0.30 → −0.50).")).toBe("It loses a pawn. The engine prefers knight to f3.");
  });
  it("keeps mate distances, which are worth hearing", () => {
    expect(forSpeech("This allows a forced checkmate in 2.")).toBe("This allows a forced checkmate in 2.");
  });
  it("drops bracketed move lists", () => {
    expect(forSpeech("This misses a way to win material with Nxe5, gaining a piece (Nxe5 dxe5 Qh5+).")).toBe(
      "This misses a way to win material with knight takes e5, gaining a piece.",
    );
  });
  it("reads notation as words but leaves plain squares alone", () => {
    expect(forSpeech("Your knight on e3 can be taken with Rxe3.")).toBe("Your knight on e3 can be taken with rook takes e3.");
    expect(forSpeech("Castles with O-O and the pawn takes with exd5.")).toBe("Castles with castles king-side and the pawn takes with pawn from e takes d5.");
  });
});
