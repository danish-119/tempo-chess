"use client";

import { useMemo } from "react";
import { PIECE_CODES, pieceUrl } from "@/lib/appearance";

/** react-chessboard piece renderers for the chosen set (undefined = built-in set). */
export function usePieceRenderers(set: string) {
  return useMemo(() => {
    if (set === "classic") return undefined;
    return Object.fromEntries(
      PIECE_CODES.map((code) => [
        code,
        () => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pieceUrl(set, code)} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />
        ),
      ]),
    );
  }, [set]);
}
