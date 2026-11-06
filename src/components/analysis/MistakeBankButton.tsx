"use client";

import { Brain, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";
import type { Color, ImportedGame } from "@/lib/chess/types";
import { addMistakes, dateKey } from "@/lib/progress";
import type { GameReview } from "@/lib/review/types";
import { updateProgress } from "@/lib/storage/db";

const COUNTED = new Set(["mistake", "blunder", "missed-win"]);

/** Copies a player's mistakes from this review into the spaced-repetition mistake bank. */
export function MistakeBankButton({ game, review }: { game: ImportedGame; review: GameReview }) {
  const [added, setAdded] = useState<Color | null>(null);
  const [error, setError] = useState(false);

  const collect = (side: Color) =>
    review.moves
      .filter((m) => m.color === side && COUNTED.has(m.classification) && m.bestMoveUci && m.bestMoveSan && m.bestMoveUci !== m.uci)
      .flatMap((m) => {
        const fen = game.moves[m.ply - 1]?.fenBefore;
        if (!fen || !m.bestMoveUci || !m.bestMoveSan) return [];
        return [
          {
            id: `${game.id}:${m.ply}`,
            fen,
            playedUci: m.uci,
            playedSan: m.san,
            bestUci: m.bestMoveUci,
            bestSan: m.bestMoveSan,
            classification: m.classification,
            gameLabel: `${game.metadata.white} vs ${game.metadata.black}`.slice(0, 120),
          },
        ];
      });

  const sides: { color: Color; label: string; name: string }[] = [
    { color: "w", label: "White", name: game.metadata.white },
    { color: "b", label: "Black", name: game.metadata.black },
  ];

  const add = async (side: Color) => {
    setError(false);
    try {
      await updateProgress((p) => addMistakes(p, collect(side), dateKey()));
      setAdded(side);
    } catch {
      setError(true);
    }
  };

  const counts = sides.map((s) => collect(s.color).length);
  if (counts.every((n) => n === 0)) return null;

  return (
    <div className="no-print space-y-2 rounded-lg border border-border px-3 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Brain className="size-4 text-accent" aria-hidden /> Practise these mistakes later
      </p>
      <div className="flex flex-wrap gap-2">
        {sides.map((s, i) => (
          <Button key={s.color} size="sm" disabled={counts[i] === 0 || added === s.color} onClick={() => add(s.color)} title={s.name}>
            {added === s.color ? <Check className="mr-1 size-4" aria-hidden /> : null}
            {added === s.color ? "Added" : `${s.label}: ${counts[i]} mistake${counts[i] === 1 ? "" : "s"}`}
          </Button>
        ))}
      </div>
      {added ? (
        <p className="text-xs text-ink-2">
          Saved. <Link href="/practice?mode=mistakes" className="underline">Open the mistake bank</Link>
        </p>
      ) : null}
      {error ? <p className="text-xs text-bad">Could not save. Browser storage may be blocked.</p> : null}
    </div>
  );
}
