import { Board } from "@/components/board/Board";
import { CapturedPieces } from "@/components/board/CapturedPieces";
import { OPERA, OPERA_PLIES, operaFen, operaLabel } from "@/content/opera-review";

/** The Opera Game on the real board at `ply`, with each player's captured pieces and material lead. */
export function PlayVisual({ ply }: { ply: number }) {
  const fen = operaFen(ply);
  const move = ply > 0 ? OPERA.moves[ply - 1] : null;
  return (
    <div className="mx-auto w-full max-w-[min(100%,40svh)] sm:max-w-[min(100%,44svh)] lg:max-w-[min(100%,calc(100svh-12.5rem))]">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="inline-block size-3.5 rounded-sm border border-border" style={{ background: "var(--eval-black)" }} aria-hidden />
          <span className="truncate">{OPERA.game.black}</span>
        </span>
        <CapturedPieces fen={fen} side="b" />
      </div>
      <div aria-hidden>
        <Board
          fen={fen}
          orientation="white"
          lastMove={move ? { from: move.uci.slice(0, 2), to: move.uci.slice(2, 4) } : null}
          interactive={false}
          id="landing-studio-board"
          ariaLabel="Opera Game, scrolling replay"
        />
      </div>
      <div className="flex items-center justify-between px-1 pt-2">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span className="inline-block size-3.5 rounded-sm border border-border" style={{ background: "var(--eval-white)" }} aria-hidden />
          <span className="truncate">{OPERA.game.white}</span>
        </span>
        <CapturedPieces fen={fen} side="w" />
      </div>
      <p className="eyebrow mt-2 flex items-center justify-between !text-[11px]" aria-hidden>
        <span className="normal-case">{operaLabel(ply)}</span>
        <span>
          {ply} / {OPERA_PLIES}
        </span>
      </p>
    </div>
  );
}
