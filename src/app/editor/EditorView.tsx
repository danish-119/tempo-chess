"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Chessboard, ChessboardProvider, type PieceDropHandlerArgs, type PieceHandlerArgs, SparePiece, type SquareHandlerArgs } from "react-chessboard";
import { ArrowUpDown, ClipboardCopy, Crown, Eraser, Hand, ImageDown, Link2, RotateCcw, Search, Swords, Trash2 } from "lucide-react";
import { usePieceRenderers } from "@/components/board/pieces";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Alert, Button, ButtonLink, Card, cx, inputClass } from "@/components/ui/primitives";
import { boardTheme } from "@/lib/appearance";
import { type Castling, type Placement, START_PLACEMENT_FEN, buildFen, placementFromFen, possibleCastling, setupProblem } from "@/lib/chess/editor";
import { setQuery } from "@/lib/url";
import { downloadBoardPng } from "@/lib/boardImage";
import { tablebaseApplies } from "@/lib/tablebase";

/** "move" drags pieces around; a piece code places that piece; "erase" removes. */
type Tool = "move" | "erase" | string;

const ROW = ["K", "Q", "R", "B", "N", "P"];
const NAMES: Record<string, string> = { K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn" };

function initialState(fen: string | null) {
  const full = fen && fen.split(" ").length >= 1 && fen.trim() ? fen.trim() : `${START_PLACEMENT_FEN} w KQkq - 0 1`;
  const parts = full.split(/\s+/);
  const rights = parts[2] ?? "KQkq";
  return {
    placement: placementFromFen(full),
    turn: (parts[1] === "b" ? "b" : "w") as "w" | "b",
    castling: { K: rights.includes("K"), Q: rights.includes("Q"), k: rights.includes("k"), q: rights.includes("q") },
  };
}

export function EditorView() {
  const params = useSearchParams();
  const { settings } = useSettings();
  const pieces = usePieceRenderers(settings.pieceSet);
  const theme = boardTheme(settings.boardTheme);
  const init = useMemo(() => initialState(params.get("fen")), [params]);
  const [placement, setPlacementState] = useState<Placement>(init.placement);
  const [turn, setTurnState] = useState<"w" | "b">(init.turn);
  const [castling, setCastlingState] = useState<Castling>(init.castling);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [tool, setTool] = useState<Tool>("move");
  const [fenInput, setFenInput] = useState<string | null>(null);
  const [fenError, setFenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const fen = buildFen(placement, turn, castling);
  const problem = setupProblem(fen);
  const allowed = possibleCastling(placement);

  // Every edit goes through here so the address always holds the position.
  const commit = (p: Placement, t = turn, c = castling) => {
    setPlacementState(p);
    setTurnState(t);
    setCastlingState(c);
    setFenInput(null);
    setFenError(null);
    setQuery({ fen: buildFen(p, t, c) });
  };

  const put = (p: Placement, square: string, code: string) => {
    const next = { ...p };
    // One king per side: placing a king moves it.
    if (code[1] === "K") for (const [sq, c] of Object.entries(next)) if (c === code) delete next[sq];
    next[square] = code;
    return next;
  };

  const onSquareClick = ({ square }: SquareHandlerArgs) => {
    if (tool === "move") return;
    const next = { ...placement };
    if (tool === "erase" || next[square] === tool) delete next[square];
    else return commit(put(placement, square, tool));
    commit(next);
  };

  const onPieceDrop = ({ piece, sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    const code = piece.pieceType;
    if (piece.isSparePiece) {
      if (!targetSquare) return false;
      commit(put(placement, targetSquare, code));
      return true;
    }
    const next = { ...placement };
    delete next[sourceSquare];
    // Dropped off the board: the piece is removed.
    commit(targetSquare ? put(next, targetSquare, code) : next);
    return true;
  };

  const onPieceClick = ({ isSparePiece, piece }: PieceHandlerArgs) => {
    if (isSparePiece) setTool((t) => (t === piece.pieceType ? "move" : piece.pieceType));
  };

  const loadFen = () => {
    const text = (fenInput ?? fen).trim();
    const parts = text.split(/\s+/);
    if (parts[0].split("/").length !== 8) {
      setFenError("That doesn't look like a FEN.");
      return;
    }
    const s = initialState(text);
    commit(s.placement, s.turn, s.castling);
  };

  const copyFen = async () => {
    try {
      await navigator.clipboard.writeText(fen);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/editor?fen=${encodeURIComponent(fen)}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const palette = (color: "w" | "b") => (
    <div className="grid w-full grid-cols-8 gap-1 rounded-lg bg-surface-2 p-1" aria-label={`${color === "w" ? "White" : "Black"} pieces`}>
      {ROW.map((r) => {
        const code = `${color}${r}`;
        return (
          <div
            key={code}
            title={`${color === "w" ? "White" : "Black"} ${NAMES[r]}`}
            className={cx("aspect-square rounded-md", tool === code ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-surface")}
          >
            <SparePiece pieceType={code} />
          </div>
        );
      })}
      <button
        type="button"
        aria-label="Move pieces"
        aria-pressed={tool === "move"}
        onClick={() => setTool("move")}
        className={cx("grid aspect-square place-items-center rounded-md", tool === "move" ? "bg-accent-soft text-accent ring-2 ring-accent" : "text-ink-2 hover:bg-surface")}
      >
        <Hand className="size-1/2" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Erase pieces"
        aria-pressed={tool === "erase"}
        onClick={() => setTool("erase")}
        className={cx("grid aspect-square place-items-center rounded-md", tool === "erase" ? "bg-accent-soft text-accent ring-2 ring-accent" : "text-ink-2 hover:bg-surface")}
      >
        <Eraser className="size-1/2" aria-hidden />
      </button>
    </div>
  );

  const top = orientation === "white" ? "b" : "w";
  const bottom = top === "w" ? "b" : "w";

  return (
    <ChessboardProvider
      options={{
        id: "tempo-editor",
        position: fen,
        boardOrientation: orientation,
        showNotation: settings.showCoordinates,
        showAnimations: false,
        allowDragging: true,
        allowDragOffBoard: true,
        onPieceDrop,
        onPieceClick,
        onSquareClick,
        ...(pieces ? { pieces } : {}),
        darkSquareStyle: { backgroundColor: theme.dark },
        lightSquareStyle: { backgroundColor: theme.light },
        darkSquareNotationStyle: { color: theme.light, fontWeight: 600 },
        lightSquareNotationStyle: { color: theme.dark, fontWeight: 600 },
        boardStyle: { borderRadius: "6px", overflow: "hidden", boxShadow: "var(--shadow)" },
      }}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-17rem))] flex-col gap-2">
          {palette(top)}
          <div className={cx(tool !== "move" && "cursor-crosshair")} role="group" aria-label="Board editor">
            <Chessboard />
          </div>
          {palette(bottom)}
        </div>

        <div className="space-y-3">
          <Card className="space-y-4 p-4">
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-ink-3">Side to move</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Side to move">
                {(["w", "b"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={turn === c}
                    onClick={() => commit(placement, c)}
                    className={cx(
                      "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold",
                      turn === c ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
                    )}
                  >
                    <span className="size-3 rounded-sm border border-border" style={{ background: c === "w" ? "var(--eval-white)" : "var(--eval-black)" }} aria-hidden />
                    {c === "w" ? "White" : "Black"}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wider text-ink-3">Castling allowed</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {(
                  [
                    ["K", "White kingside"],
                    ["Q", "White queenside"],
                    ["k", "Black kingside"],
                    ["q", "Black queenside"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className={cx("flex items-center gap-2", !allowed[k] && "text-ink-3")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent)]"
                      checked={castling[k] && allowed[k]}
                      disabled={!allowed[k]}
                      onChange={(e) => commit(placement, turn, { ...castling, [k]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => commit(placementFromFen(START_PLACEMENT_FEN), "w", { K: true, Q: true, k: true, q: true })}>
                <RotateCcw className="size-4" aria-hidden /> Start position
              </Button>
              <Button size="sm" onClick={() => commit({})}>
                <Trash2 className="size-4" aria-hidden /> Clear
              </Button>
              <Button size="sm" onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
                <ArrowUpDown className="size-4" aria-hidden /> Flip
              </Button>
              <Button size="sm" onClick={() => void copyLink()}>
                <Link2 className="size-4" aria-hidden /> {linkCopied ? "Link copied" : "Copy link"}
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  void downloadBoardPng("tempo_position.png", { fen, orientation, boardThemeId: settings.boardTheme, pieceSet: settings.pieceSet }).catch(() => undefined)
                }
              >
                <ImageDown className="size-4" aria-hidden /> Image
              </Button>
            </div>
          </Card>

          <Card className="space-y-2 p-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              FEN
              <div className="flex gap-2">
                <input
                  className={cx(inputClass, "min-w-0 flex-1 font-mono text-xs")}
                  value={fenInput ?? fen}
                  onChange={(e) => {
                    setFenInput(e.target.value);
                    setFenError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && loadFen()}
                  spellCheck={false}
                  autoCapitalize="none"
                />
                {fenInput !== null ? (
                  <Button size="sm" onClick={loadFen}>
                    Load
                  </Button>
                ) : (
                  <Button size="sm" onClick={copyFen} aria-label="Copy FEN">
                    <ClipboardCopy className="size-4" aria-hidden /> {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </div>
            </label>
            {fenError ? <p className="text-xs text-bad">{fenError}</p> : null}
          </Card>

          {problem ? (
            <Alert tone="warning" title="Not a legal position yet">
              {problem}
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ButtonLink variant="primary" href={`/analyze?fen=${encodeURIComponent(fen)}`}>
                <Search className="size-4" aria-hidden /> Analyze
              </ButtonLink>
              <ButtonLink href={`/play?fen=${encodeURIComponent(fen)}`}>
                <Swords className="size-4" aria-hidden /> Play from here
              </ButtonLink>
              {tablebaseApplies(fen) ? (
                <ButtonLink className="col-span-2" href={`/practice?mode=endgames&fen=${encodeURIComponent(fen)}`}>
                  <Crown className="size-4" aria-hidden /> Practice vs perfect defence
                </ButtonLink>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </ChessboardProvider>
  );
}
