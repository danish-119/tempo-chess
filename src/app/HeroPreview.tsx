import { CircleX, CheckCheck, TriangleAlert } from "lucide-react";

/**
 * Static illustration of the workspace (not a live analysis). The position
 * and annotations are a hand-made example and are labelled as such.
 */
const FEN_ROWS = ["r1bqkb1r", "pppp1ppp", "2n2n2", "4p2Q", "2B1P3", "8", "PPPP1PPP", "RNB1K1NR"];
const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟", K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" };

function rows() {
  return FEN_ROWS.map((r) => r.replace(/\d/g, (d) => ".".repeat(Number(d))).split(""));
}

export function HeroPreview() {
  const board = rows();
  return (
    <figure className="card relative mx-auto w-full max-w-md overflow-hidden p-4" aria-label="Illustration of a Tempo game review">
      <div className="flex gap-2">
        <div className="relative w-4 overflow-hidden rounded-sm border border-border" style={{ background: "var(--eval-black)" }} aria-hidden>
          <div className="absolute inset-x-0 bottom-0" style={{ height: "92%", background: "var(--eval-white)" }} />
        </div>
        <div className="grid flex-1 grid-cols-8 overflow-hidden rounded-md" aria-hidden>
          {board.flatMap((row, r) =>
            row.map((piece, c) => {
              const dark = (r + c) % 2 === 1;
              const highlight = (r === 0 && c === 6) || (r === 2 && c === 5); // last move: Ng8–f6
              return (
                <div
                  key={`${r}-${c}`}
                  className="flex aspect-square items-center justify-center text-[min(6vw,1.9rem)] leading-none"
                  style={{
                    background: highlight ? "var(--sq-last)" : dark ? "var(--sq-dark)" : "var(--sq-light)",
                    color: piece === piece.toUpperCase() ? "#fff" : "#1d1b18",
                    textShadow: piece === piece.toUpperCase() ? "0 0 1px #000, 0 0 2px #000" : "none",
                  }}
                >
                  {piece !== "." ? GLYPH[piece] : ""}
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium" style={{ color: "var(--c-blunder)", borderColor: "var(--c-blunder)" }}>
            <CircleX className="size-3.5" aria-hidden /> Blunder
          </span>
          <span className="font-mono font-semibold">3… Nf6??</span>
        </div>
        <p className="text-ink-2">This allows a forced checkmate in 1 — 4. Qxf7#. Better was 3… g6.</p>
        <div className="flex gap-3 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1"><CheckCheck className="size-3.5" style={{ color: "var(--c-best)" }} aria-hidden /> Best 12</span>
          <span className="inline-flex items-center gap-1"><TriangleAlert className="size-3.5" style={{ color: "var(--c-mistake)" }} aria-hidden /> Mistakes 1</span>
        </div>
      </div>
      <figcaption className="mt-2 text-[11px] text-ink-3">Illustration of the review panel.</figcaption>
    </figure>
  );
}
