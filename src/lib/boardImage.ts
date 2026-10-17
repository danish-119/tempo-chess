import { boardTheme, pieceUrl } from "@/lib/appearance";

const FILES = "abcdefgh";
const SQ = 90;
const MARGIN = 0;

/** Parse the board part of a FEN into 8 rows of piece codes (null = empty). */
export function boardRows(fen: string): (string | null)[][] {
  return fen
    .split(" ")[0]
    .split("/")
    .map((row) => {
      const out: (string | null)[] = [];
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) out.push(null);
        else out.push((ch === ch.toUpperCase() ? "w" : "b") + ch.toUpperCase());
      }
      return out;
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

/**
 * Draw the position as a PNG (720×720) in the user's board colours and piece
 * set. The built-in "classic" set is drawn with cburnett pieces, its look-alike.
 */
export async function boardPng(opts: {
  fen: string;
  orientation: "white" | "black";
  boardThemeId: string;
  pieceSet: string;
  lastMove?: { from: string; to: string } | null;
  coordinates?: boolean;
}): Promise<Blob> {
  const theme = boardTheme(opts.boardThemeId);
  const set = opts.pieceSet === "classic" ? "cburnett" : opts.pieceSet;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SQ * 8 + MARGIN * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const rows = boardRows(opts.fen);
  const flip = opts.orientation === "black";
  const codes = [...new Set(rows.flat().filter((c): c is string => !!c))];
  const images = Object.fromEntries(await Promise.all(codes.map(async (c) => [c, await loadImage(pieceUrl(set, c))] as const)));

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const x = (flip ? 7 - f : f) * SQ + MARGIN;
      const y = (flip ? 7 - r : r) * SQ + MARGIN;
      const square = `${FILES[f]}${8 - r}`;
      const light = (r + f) % 2 === 0;
      ctx.fillStyle = light ? theme.light : theme.dark;
      ctx.fillRect(x, y, SQ, SQ);
      if (opts.lastMove && (opts.lastMove.from === square || opts.lastMove.to === square)) {
        ctx.fillStyle = "rgba(214, 170, 60, 0.55)";
        ctx.fillRect(x, y, SQ, SQ);
      }
      const code = rows[r]?.[f];
      if (code && images[code]) ctx.drawImage(images[code], x, y, SQ, SQ);
      if (opts.coordinates !== false) {
        ctx.font = "600 15px system-ui, sans-serif";
        ctx.fillStyle = light ? theme.dark : theme.light;
        const bottom = flip ? r === 0 : r === 7;
        const left = flip ? f === 7 : f === 0;
        if (bottom) ctx.fillText(FILES[f], x + SQ - 13, y + SQ - 6);
        if (left) ctx.fillText(String(8 - r), x + 5, y + 18);
      }
    }
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}

export async function downloadBoardPng(filename: string, opts: Parameters<typeof boardPng>[0]): Promise<void> {
  const blob = await boardPng(opts);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
