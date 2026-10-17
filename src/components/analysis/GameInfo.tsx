"use client";

import { ClipboardCopy, Download, ExternalLink, FileDown, ImageDown, Link2, PencilRuler, Printer, Save, Swords } from "lucide-react";
import { downloadText, exportAnnotatedPgn, exportPgn, gameFileName } from "@/lib/chess/export";
import type { ImportedGame } from "@/lib/chess/types";
import { openingIdea } from "@/lib/openings";
import type { GameReview } from "@/lib/review/types";
import { Button, ButtonLink, SectionTitle } from "@/components/ui/primitives";
import { Term } from "@/components/ui/Term";

/** "Game" tab: metadata, opening, exports and sharing. */
export function GameInfo({
  game,
  review,
  fen,
  persistable,
  canCopyMoves,
  onCopy,
  onSave,
  onShare,
  onImage,
}: {
  game: ImportedGame;
  review: GameReview | null;
  fen: string;
  persistable: boolean;
  canCopyMoves: boolean;
  onCopy: (what: "fen" | "moves" | "pgn") => void;
  onSave: () => void;
  onShare: () => void;
  onImage: () => void;
}) {
  const m = game.metadata;
  const opening = review?.opening ?? (m.openingName ? { eco: m.eco ?? "", name: m.openingName, bookPlies: 0 } : null);
  const idea = opening ? openingIdea(opening.name) : null;
  const rows: [string, React.ReactNode][] = [
    ["White", `${m.white}${m.whiteElo ? ` (${m.whiteElo})` : ""}`],
    ["Black", `${m.black}${m.blackElo ? ` (${m.blackElo})` : ""}`],
    ["Result", m.result === "*" ? "Unfinished" : m.result],
    ...(m.termination ? [["Termination", m.termination] as [string, React.ReactNode]] : []),
    ...(m.date ? [["Date", m.date] as [string, React.ReactNode]] : []),
    ...(m.timeControl ? [["Time control", `${m.timeControl}${m.timeClass ? ` · ${m.timeClass}` : ""}`] as [string, React.ReactNode]] : []),
    ...(m.rated !== undefined ? [["Rated", m.rated ? "Yes" : "No"] as [string, React.ReactNode]] : []),
    ...(m.event ? [["Event", m.event] as [string, React.ReactNode]] : []),
    ["Moves", String(Math.ceil(game.moves.length / 2))],
  ];
  const hasMoves = game.moves.length > 0;
  const pgnText = () => (game.source === "local" ? exportPgn(game) : game.originalPgn);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <SectionTitle>Game</SectionTitle>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-3">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        {m.link ? (
          <a href={m.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-3 underline">
            View original game <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </section>

      {opening ? (
        <section className="space-y-1">
          <SectionTitle>Opening</SectionTitle>
          <p className="text-sm font-medium">
            {opening.eco ? <span className="mr-1 font-mono text-xs text-ink-3">{opening.eco}</span> : null}
            {opening.name}
          </p>
          {review?.opening ? (
            <p className="text-xs text-ink-3">
              {review.opening.bookPlies} <Term id="book">book</Term> plies before leaving the database.
            </p>
          ) : null}
          {idea ? <p className="text-sm text-ink-2">{idea}</p> : null}
        </section>
      ) : null}

      <section className="no-print space-y-2">
        <SectionTitle>Copy &amp; export</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onCopy("fen")}>
            <ClipboardCopy className="size-4" aria-hidden /> Copy <Term id="fen">FEN</Term>
          </Button>
          <Button size="sm" onClick={() => onCopy("moves")} disabled={!canCopyMoves}>
            <ClipboardCopy className="size-4" aria-hidden /> Copy moves
          </Button>
          <Button size="sm" onClick={() => onCopy("pgn")} disabled={!hasMoves}>
            <ClipboardCopy className="size-4" aria-hidden /> Copy <Term id="pgn">PGN</Term>
          </Button>
          <Button size="sm" onClick={() => downloadText(gameFileName(game), pgnText())} disabled={!hasMoves}>
            <Download className="size-4" aria-hidden /> Download PGN
          </Button>
          <Button size="sm" onClick={onShare} disabled={!hasMoves}>
            <Link2 className="size-4" aria-hidden /> Copy share link
          </Button>
          <Button size="sm" onClick={onImage}>
            <ImageDown className="size-4" aria-hidden /> Board image
          </Button>
          {review ? (
            <>
              <Button size="sm" onClick={() => downloadText(gameFileName(game, "_tempo"), exportAnnotatedPgn(game, review))}>
                <FileDown className="size-4" aria-hidden /> Annotated PGN
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden /> Print report
              </Button>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onSave}>
            <Save className="size-4" aria-hidden /> {persistable ? "Save" : "Save game"}
          </Button>
          <ButtonLink size="sm" newTab href={`/play?fen=${encodeURIComponent(fen)}`}>
            <Swords className="size-4" aria-hidden /> Play this position vs Stockfish
          </ButtonLink>
          <ButtonLink size="sm" newTab href={`/editor?fen=${encodeURIComponent(fen)}`}>
            <PencilRuler className="size-4" aria-hidden /> Edit position
          </ButtonLink>
        </div>
      </section>

      <section className="space-y-1">
        <SectionTitle>Current position</SectionTitle>
        <code className="block break-all rounded bg-surface-2 p-2 font-mono text-xs text-ink-2">{fen}</code>
      </section>
    </div>
  );
}
