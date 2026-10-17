"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chessboard, type SquareHandlerArgs } from "react-chessboard";
import { Play, RotateCcw, Square } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Button, Card, Toggle, cx } from "@/components/ui/primitives";
import { useSound } from "@/hooks/useSound";
import { boardTheme } from "@/lib/appearance";
import { COORD_MODES, COORD_TIMES, type CoordMode, type CoordTime, isLightSquare, nameChoices, randomSquare } from "@/lib/coordinates";

type Side = "white" | "black" | "random";

function Segmented<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-1" disabled={disabled}>
      <legend className="text-xs font-medium text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={cx(
              "rounded-lg border px-2.5 py-1.5 text-sm font-medium disabled:opacity-50",
              value === o.id ? "border-accent bg-accent-soft ring-2 ring-accent" : "border-border hover:bg-surface-2",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Learn square names: find, name, or say the colour of squares — timed or untimed. */
export function CoordinateTrainer() {
  const { settings } = useSettings();
  const sound = useSound();
  const theme = boardTheme(settings.boardTheme);
  const [mode, setMode] = useState<CoordMode>("find");
  const [time, setTime] = useState<CoordTime>(60);
  const [side, setSide] = useState<Side>("white");
  const [showCoords, setShowCoords] = useState(false);
  const [orientation, setOrientation] = useState<"white" | "black">("white");
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [right, setRight] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(0);
  const [flash, setFlash] = useState<{ square: string | null; ok: boolean } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running || time === null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running, time]);

  const left = running && time !== null ? Math.max(0, (deadline - now) / 1000) : time ?? 0;

  const stop = () => {
    setRunning(false);
    setFinished(true);
    setTarget(null);
    sound.play("game-end");
  };

  useEffect(() => {
    if (!running || time === null || left > 0) return;
    const t = setTimeout(stop, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, left, time]);

  const nextTarget = (prev: string | null) => {
    const sq = randomSquare(prev);
    setTarget(sq);
    if (mode === "name") setChoices(nameChoices(sq));
  };

  const start = () => {
    const t0 = Date.now();
    setRight(0);
    setWrong(0);
    setFinished(false);
    setFlash(null);
    setOrientation(side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side);
    setNow(t0);
    setDeadline(time === null ? 0 : t0 + time * 1000);
    setRunning(true);
    nextTarget(null);
  };

  /** Record an answer; on a wrong answer the same question stays (find/name) so you learn it. */
  const answer = (ok: boolean, square: string | null) => {
    if (!running || !target) return;
    if (ok) setRight((n) => n + 1);
    else setWrong((n) => n + 1);
    sound.play(ok ? "move" : "incorrect");
    setFlash({ square, ok });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 300);
    if (ok || mode === "color") nextTarget(target);
  };

  const onSquareClick = ({ square }: SquareHandlerArgs) => {
    if (mode === "find") answer(square === target, square);
  };

  const squareStyles = useMemo(() => {
    const st: Record<string, React.CSSProperties> = {};
    if (running && mode === "name" && target) st[target] = { boxShadow: "inset 0 0 0 5px var(--accent)", backgroundImage: "linear-gradient(rgba(255,255,255,.25), rgba(255,255,255,.25))" };
    if (flash?.square) st[flash.square] = { ...st[flash.square], boxShadow: `inset 0 0 0 5px var(${flash.ok ? "--good" : "--bad"})` };
    return st;
  }, [running, mode, target, flash]);

  const total = right + wrong;
  const accuracy = total ? Math.round((right / total) * 100) : 0;
  const hideBoard = running && mode === "color";

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
      <div className="flex min-h-0 flex-col items-center">
        <div className="relative w-full max-w-[min(100%,calc(100dvh-12rem))]">
          <div className={cx(hideBoard && "invisible")}>
            <Chessboard
              options={{
                id: "tempo-coords",
                position: "8/8/8/8/8/8/8/8 w - - 0 1",
                boardOrientation: orientation,
                showNotation: !running || showCoords,
                allowDragging: false,
                onSquareClick,
                squareStyles,
                darkSquareStyle: { backgroundColor: theme.dark },
                lightSquareStyle: { backgroundColor: theme.light },
                darkSquareNotationStyle: { color: theme.light, fontWeight: 600 },
                lightSquareNotationStyle: { color: theme.dark, fontWeight: 600 },
                boardStyle: { borderRadius: "6px", overflow: "hidden", boxShadow: "var(--shadow)", cursor: running && mode === "find" ? "pointer" : "default" },
              }}
            />
          </div>
          {running && target && mode !== "name" ? (
            <span
              className={cx(
                "pointer-events-none absolute inset-0 grid place-items-center font-serif text-7xl font-bold sm:text-8xl",
                hideBoard ? "text-ink" : "text-white/90",
                flash && hideBoard && (flash.ok ? "text-good" : "text-bad"),
              )}
              style={hideBoard ? undefined : { textShadow: "0 2px 12px rgba(0,0,0,.6)" }}
              aria-live="assertive"
            >
              {target}
            </span>
          ) : null}
        </div>

        {running && mode === "name" ? (
          <div className="mt-3 grid w-full max-w-md grid-cols-4 gap-2" aria-label="Choose the square's name">
            {choices.map((c) => (
              <Button key={c} size="lg" className="font-mono text-lg" onClick={() => answer(c === target, null)}>
                {c}
              </Button>
            ))}
          </div>
        ) : null}
        {running && mode === "color" ? (
          <div className="mt-3 grid w-full max-w-md grid-cols-2 gap-2">
            {(["light", "dark"] as const).map((c) => (
              <Button key={c} size="lg" className="capitalize" onClick={() => answer(target !== null && isLightSquare(target) === (c === "light"), null)}>
                <span className="size-4 rounded-sm border border-border" style={{ background: c === "light" ? theme.light : theme.dark }} aria-hidden /> {c}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <Card className="h-fit space-y-4 p-4">
        <Segmented label="Mode" value={mode} options={COORD_MODES.map((m) => ({ id: m.id, label: m.label }))} onChange={setMode} disabled={running} />
        <p className="-mt-2 text-xs text-ink-3">{COORD_MODES.find((m) => m.id === mode)?.hint}</p>
        <Segmented label="Time" value={time} options={COORD_TIMES} onChange={setTime} disabled={running} />
        <Segmented
          label="Play as"
          value={side}
          options={[
            { id: "white", label: "White" },
            { id: "black", label: "Black" },
            { id: "random", label: "Random" },
          ]}
          onChange={setSide}
          disabled={running}
        />
        {mode !== "color" ? <Toggle label="Show coordinates on the board" checked={showCoords} onChange={setShowCoords} /> : null}

        <div className="grid grid-cols-3 border-t border-border pt-3 text-center" aria-live="polite">
          <div>
            <p className="text-xs text-ink-3">{time === null ? "Mode" : "Time"}</p>
            <p className={cx("font-mono text-2xl font-semibold tabular", running && time !== null && left < 5 && "text-bad")}>{time === null ? "∞" : left.toFixed(0)}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Correct</p>
            <p className="font-serif text-2xl tabular">{right}</p>
          </div>
          <div>
            <p className="text-xs text-ink-3">Accuracy</p>
            <p className="font-serif text-2xl tabular">{total ? `${accuracy}%` : "—"}</p>
          </div>
        </div>
        {finished ? (
          <p className="text-center text-sm text-ink-2">
            {right} correct, {wrong} wrong{total ? ` · ${accuracy}% accuracy` : ""}
          </p>
        ) : null}

        {running ? (
          <Button className="w-full" onClick={stop}>
            <Square className="size-4" aria-hidden /> Stop
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={start}>
            {finished ? <RotateCcw className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />} {finished ? "Again" : "Start"}
          </Button>
        )}
      </Card>
    </div>
  );
}
