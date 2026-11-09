"use client";

import { Chess } from "chess.js";
import { Clapperboard, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Alert, Button, LoadingDots } from "@/components/ui/primitives";
import { boardTheme, pieceUrl } from "@/lib/appearance";
import type { ImportedGame } from "@/lib/chess/types";
import { evalBarFraction } from "@/lib/engine/score";
import { encodeGif } from "@/lib/gif";
import { MOVE_CLASS_LABEL, type GameReview } from "@/lib/review/types";
import { moveClassColor, moveClassNag } from "./MoveClassBadge";

const SIZE = 480;
const BAR = 16;
const BOARD = SIZE - BAR; // 464 → 58px squares
const SQ = BOARD / 8;
const TOP = 34;
const FOOT = 34;
const CAPTION = 46;
const HEIGHT = TOP + BOARD + FOOT + CAPTION;
const CODES = ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"] as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/** Resolve "var(--c-best)" to the real colour for canvas drawing. */
function cssColor(v: string): string {
  const m = /var\((--[\w-]+)\)/.exec(v);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#888" : v;
}

const yieldToBrowser = () => new Promise<void>((r) => setTimeout(r, 0));

/** Renders the reviewed game into an animated GIF (board, eval bar, move grades) entirely in the browser. */
export function GifExportButton({ game, review, orientation }: { game: ImportedGame; review: GameReview; orientation: "white" | "black" }) {
  const { settings } = useSettings();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; kb: number } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const make = async () => {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const set = settings.pieceSet === "classic" ? "cburnett" : settings.pieceSet;
      const images = await Promise.all(CODES.map((c) => loadImage(pieceUrl(set, c))));
      const pieceImg = Object.fromEntries(CODES.map((c, i) => [c, images[i]])) as Record<(typeof CODES)[number], HTMLImageElement>;
      const theme = boardTheme(settings.boardTheme);
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Your browser cannot draw the animation.");

      const flipped = orientation === "black";
      const topColor = flipped ? "w" : "b";
      const name = (c: "w" | "b") => (c === "w" ? game.metadata.white : game.metadata.black);
      const acc = (c: "w" | "b") => {
        const a = (c === "w" ? review.white : review.black).accuracy;
        return a == null ? "" : `  ${a.toFixed(1)}%`;
      };
      const ink = "#ece8df";
      const frames: { data: Uint8ClampedArray; delayMs: number }[] = [];
      const fens = [game.startFen, ...game.moves.map((m) => m.fenAfter)];

      for (let i = 0; i < fens.length; i++) {
        const board = new Chess(fens[i]).board();
        const move = i > 0 ? game.moves[i - 1] : null;
        const mr = i > 0 ? review.moves[i - 1] : null;

        ctx.fillStyle = "#26282c";
        ctx.fillRect(0, 0, SIZE, HEIGHT);

        // Player strips
        ctx.font = "600 15px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillStyle = ink;
        ctx.fillText(`${name(topColor)}${acc(topColor)}`, BAR + 8, TOP / 2);
        const bottomColor = topColor === "w" ? "b" : "w";
        ctx.fillText(`${name(bottomColor)}${acc(bottomColor)}`, BAR + 8, TOP + BOARD + FOOT / 2);

        // Eval bar (white share measured from White's side of the board)
        const frac = evalBarFraction(review.positions[i]?.score ?? null);
        ctx.fillStyle = "#3a3d43";
        ctx.fillRect(0, TOP, BAR - 4, BOARD);
        ctx.fillStyle = "#f2f0ea";
        const whiteH = BOARD * frac;
        if (flipped) ctx.fillRect(0, TOP, BAR - 4, whiteH);
        else ctx.fillRect(0, TOP + BOARD - whiteH, BAR - 4, whiteH);

        // Squares, last move, pieces
        for (let r = 0; r < 8; r++) {
          for (let f = 0; f < 8; f++) {
            const file = flipped ? 7 - f : f;
            const rank = flipped ? r : 7 - r; // board[0] is rank 8
            const x = BAR + f * SQ;
            const y = TOP + r * SQ;
            const light = (file + (7 - rank)) % 2 === 0;
            ctx.fillStyle = light ? theme.light : theme.dark;
            ctx.fillRect(x, y, SQ, SQ);
            const sqName = `${"abcdefgh"[file]}${rank + 1}`;
            if (move && (sqName === move.from || sqName === move.to)) {
              ctx.fillStyle = "rgba(214,170,60,0.55)";
              ctx.fillRect(x, y, SQ, SQ);
            }
            const cell = board[7 - rank][file];
            if (cell) ctx.drawImage(pieceImg[`${cell.color}${cell.type.toUpperCase()}` as (typeof CODES)[number]], x, y, SQ, SQ);
          }
        }

        // Grade badge on the destination square
        if (move && mr) {
          const f = "abcdefgh".indexOf(move.to[0]);
          const rank = Number(move.to[1]) - 1;
          const cx = BAR + (flipped ? 7 - f : f) * SQ + SQ - 13;
          const cy = TOP + (flipped ? rank : 7 - rank) * SQ + 13;
          ctx.beginPath();
          ctx.arc(cx, cy, 12, 0, Math.PI * 2);
          ctx.fillStyle = cssColor(moveClassColor(mr.classification));
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = "700 12px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(moveClassNag(mr.classification) ?? "✓", cx, cy + 1);
          ctx.textAlign = "left";
        }

        // Caption
        const capY = TOP + BOARD + FOOT;
        ctx.fillStyle = "#2e3035";
        ctx.fillRect(0, capY, SIZE, CAPTION);
        ctx.fillStyle = ink;
        ctx.font = "600 17px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        if (move && mr) {
          ctx.fillText(`${mr.moveNumber}${mr.color === "w" ? "." : "…"} ${mr.san}`, 14, capY + 16);
          ctx.fillStyle = cssColor(moveClassColor(mr.classification));
          ctx.font = "600 14px system-ui, sans-serif";
          ctx.fillText(MOVE_CLASS_LABEL[mr.classification], 14, capY + 35);
        } else {
          ctx.fillText(`${game.metadata.white} vs ${game.metadata.black}`, 14, capY + 16);
          ctx.fillStyle = "#b8b2a6";
          ctx.font = "500 14px system-ui, sans-serif";
          ctx.fillText(game.metadata.result !== "*" ? `Result ${game.metadata.result}` : "Reviewed with Tempo", 14, capY + 35);
        }
        ctx.fillStyle = "#8f8a7f";
        ctx.font = "500 12px system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("Tempo", SIZE - 12, capY + CAPTION - 12);
        ctx.textAlign = "left";

        frames.push({
          data: ctx.getImageData(0, 0, SIZE, HEIGHT).data,
          delayMs: i === 0 ? 1400 : i === fens.length - 1 ? 3000 : 900,
        });
        setProgress(Math.round(((i + 1) / fens.length) * 100));
        if (i % 4 === 3) await yieldToBrowser();
      }

      const bytes = encodeGif(frames, SIZE, HEIGHT);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "image/gif" }));
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;
      setResult({ url, kb: Math.round(bytes.length / 1024) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the GIF.");
    } finally {
      setBusy(false);
    }
  };

  const fileName = `tempo-${game.metadata.white}-vs-${game.metadata.black}.gif`.replace(/[^\w.-]+/g, "_");

  return (
    <div className="no-print space-y-2 rounded-lg border border-border px-3 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <Clapperboard className="size-4 text-accent" aria-hidden /> Share this game as a GIF
      </p>
      <p className="text-xs text-ink-3">Every move with its grade and the evaluation bar. Made on your device, nothing is uploaded.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={make} disabled={busy}>
          {busy ? <LoadingDots className="mr-1.5" /> : null}
          {busy ? `Creating… ${progress}%` : result ? "Create again" : "Create GIF"}
        </Button>
        {result ? (
          <a
            href={result.url}
            download={fileName}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-sm font-medium text-accent-ink hover:brightness-110"
          >
            <Download className="size-4" aria-hidden /> Download ({result.kb} KB)
          </a>
        ) : null}
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {result ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={result.url} alt={`Animated replay of ${game.metadata.white} vs ${game.metadata.black}`} className="w-full max-w-xs rounded-md border border-border" />
      ) : null}
    </div>
  );
}
