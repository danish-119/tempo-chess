"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Alert, Button, Field, cx, inputClass } from "@/components/ui/primitives";
import { parseChessComGameUrl } from "@/lib/chesscom/client";
import { LichessError, fetchLichessGame, parseLichessGameUrl } from "@/lib/lichess/client";
import { PGN_LIMITS, type ParseResult, parsePgnDatabase } from "@/lib/chess/pgn";
import { type ImportedGame, PgnParseError } from "@/lib/chess/types";
import { StorageError, saveGame } from "@/lib/storage/db";

const ACCEPT = ".pgn,application/x-chess-pgn,application/vnd.chess-pgn,text/plain";

function GamePicker({ result, onOpen, busy }: { result: ParseResult; onOpen: (g: ImportedGame) => void; busy: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2" aria-live="polite">
        Found {result.games.length} game{result.games.length === 1 ? "" : "s"}
        {result.errors.length ? `, ${result.errors.length} could not be read` : ""}.
      </p>
      {result.errors.length ? (
        <Alert tone="warning" title="Some games were skipped">
          <ul className="list-disc pl-4">
            {result.errors.slice(0, 5).map((e, i) => (
              <li key={i}>
                Game {(e.gameIndex ?? 0) + 1}: {e.message}
              </li>
            ))}
            {result.errors.length > 5 ? <li>…and {result.errors.length - 5} more</li> : null}
          </ul>
        </Alert>
      ) : null}
      <ul className="max-h-96 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {result.games.map((g, i) => (
          <li key={`${g.id}-${i}`}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(g)}
              className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{g.metadata.white}</span>
                {g.metadata.whiteElo ? <span className="text-ink-3"> ({g.metadata.whiteElo})</span> : null}
                <span className="text-ink-3"> vs </span>
                <span className="font-medium">{g.metadata.black}</span>
                {g.metadata.blackElo ? <span className="text-ink-3"> ({g.metadata.blackElo})</span> : null}
                {g.metadata.event ? <span className="block truncate text-xs text-ink-3">{g.metadata.event}</span> : null}
              </span>
              <span className="text-xs text-ink-3 tabular">
                {g.metadata.result} · {Math.ceil(g.moves.length / 2)} moves{g.metadata.date ? ` · ${g.metadata.date}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PgnImport({ mode }: { mode: "upload" | "paste" }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<React.ReactNode>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (input: string) => {
    setError(null);
    setNotice(null);
    setResult(null);
    const trimmed = input.trim();
    // Pasted game links: Lichess games can be fetched directly; Chess.com's
    // API has no single-game endpoint, so explain how to get the PGN.
    if (/^https?:\/\//i.test(trimmed)) {
      const lichessId = parseLichessGameUrl(trimmed);
      if (lichessId) {
        setBusy(true);
        fetchLichessGame(lichessId)
          .then((g) => open(g))
          .catch((err: unknown) => {
            setError(err instanceof LichessError || err instanceof PgnParseError ? err.message : "Could not load that Lichess game.");
            setBusy(false);
          });
        return;
      }
      const link = parseChessComGameUrl(trimmed);
      if (link) {
        setNotice(
          <>
            Chess.com&apos;s public API cannot fetch a single game by link. Either use the <strong>Chess.com username</strong> tab to pick it from your
            archive, or open the game on Chess.com → <strong>Share</strong> → <strong>PGN</strong> → copy, and paste the PGN here.
          </>,
        );
      } else {
        setError("Only PGN text, Lichess game links or Chess.com game links are supported here. Other URLs are not fetched.");
      }
      return;
    }
    try {
      const res = parsePgnDatabase(input);
      if (res.games.length === 0) {
        setError(res.errors[0]?.message ?? "No games found in this PGN.");
        return;
      }
      if (res.games.length === 1 && res.errors.length === 0) {
        void open(res.games[0]);
        return;
      }
      setResult(res);
    } catch (err) {
      setError(err instanceof PgnParseError ? err.message : "Could not read this PGN.");
    }
  };

  const open = async (game: ImportedGame) => {
    setBusy(true);
    try {
      await saveGame(game);
      router.push(`/analyze?game=${encodeURIComponent(game.id)}`);
    } catch (err) {
      setError(err instanceof StorageError ? err.message : "Could not save the game in this browser.");
      setBusy(false);
    }
  };

  const readFile = async (file: File) => {
    setError(null);
    if (file.size > PGN_LIMITS.maxBytes) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${PGN_LIMITS.maxBytes / 1024 / 1024} MB.`);
      return;
    }
    try {
      const content = await file.text();
      if (content.includes("\u0000")) {
        setError("That file does not look like a text PGN file.");
        return;
      }
      parse(content);
    } catch {
      setError("Could not read that file.");
    }
  };

  return (
    <div className="space-y-4">
      {mode === "upload" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void readFile(f);
          }}
          className={cx(
            "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragging ? "border-accent bg-accent-soft" : "border-border",
          )}
        >
          <FileUp className="size-8 text-ink-3" aria-hidden />
          <p className="text-sm text-ink-2">Drop a .pgn file here</p>
          <Button variant="primary" onClick={() => fileRef.current?.click()}>
            Choose file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="PGN file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            parse(text);
          }}
          className="space-y-3"
        >
          <Field label="PGN or game link" error={error}>
            {(p) => (
              <textarea
                {...p}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className={`${inputClass} h-auto py-2 font-mono text-xs`}
                placeholder={'[White "Me"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 ...'}
                spellCheck={false}
              />
            )}
          </Field>
          <Button type="submit" variant="primary" loading={busy} disabled={!text.trim()}>
            Load game
          </Button>
        </form>
      )}
      {mode === "upload" && error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="info" title="Game links">{notice}</Alert> : null}
      {result ? <GamePicker result={result} onOpen={(g) => void open(g)} busy={busy} /> : null}
    </div>
  );
}
