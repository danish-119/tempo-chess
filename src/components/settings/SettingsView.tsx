"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Alert, Button, Card, Field, SectionTitle, Toggle, inputClass } from "@/components/ui/primitives";
import { detectSupport, recommendedThreads, resetEngine } from "@/lib/engine/client";
import { REVIEW_PRESETS } from "@/lib/review/review";
import { BOARD_THEMES, PIECE_SETS, boardTheme, pieceUrl } from "@/lib/appearance";
import { playSound } from "@/lib/sound";
import { clearAll } from "@/lib/storage/db";
import { useLichessAuth } from "@/hooks/useLichessAuth";
import { disconnectLichess, startLichessLogin } from "@/lib/lichess/auth";

export function SettingsView() {
  const { settings, update, reset } = useSettings();
  const [support, setSupport] = useState<ReturnType<typeof detectSupport> | null>(null);
  const [cleared, setCleared] = useState(false);
  const lichess = useLichessAuth();
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(detectSupport());
  }, []);

  const engineChange = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    void resetEngine(); // re-created with new options on next use
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle className="mb-3">Appearance</SectionTitle>
        <fieldset className="mb-2">
          <legend className="mb-1 text-sm font-medium">Theme</legend>
          <div className="flex gap-2">
            {(["system", "light", "dark"] as const).map((t) => (
              <label key={t} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm capitalize ${settings.theme === t ? "border-accent bg-accent-soft" : "border-border"}`}>
                <input type="radio" name="theme" className="sr-only" checked={settings.theme === t} onChange={() => update({ theme: t })} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mb-3">
          <legend className="mb-1 text-sm font-medium">Board</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {BOARD_THEMES.map((t) => (
              <label key={t.id} className="cursor-pointer text-center text-[11px] text-ink-2">
                <input type="radio" name="boardTheme" className="peer sr-only" checked={settings.boardTheme === t.id} onChange={() => update({ boardTheme: t.id })} />
                <span className="mb-1 grid aspect-square grid-cols-2 overflow-hidden rounded-md ring-offset-2 ring-offset-bg peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus)]" aria-hidden>
                  <span style={{ background: t.light }} />
                  <span style={{ background: t.dark }} />
                  <span style={{ background: t.dark }} />
                  <span style={{ background: t.light }} />
                </span>
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mb-3">
          <legend className="mb-1 text-sm font-medium">Pieces</legend>
          <div className="grid grid-cols-5 gap-2">
            {PIECE_SETS.map((p) => (
              <label key={p.id} className="cursor-pointer text-center text-[11px] text-ink-2" title={p.license}>
                <input type="radio" name="pieceSet" className="peer sr-only" checked={settings.pieceSet === p.id} onChange={() => update({ pieceSet: p.id })} />
                <span
                  className="mb-1 flex aspect-square items-center justify-center rounded-md ring-offset-2 ring-offset-bg peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus)]"
                  style={{ background: boardTheme(settings.boardTheme).light }}
                  aria-hidden
                >
                  {p.id === "classic" ? (
                    <span className="text-3xl leading-none text-black">♞</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pieceUrl(p.id, "wN")} alt="" className="size-4/5" />
                  )}
                </span>
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Toggle label="Board coordinates" checked={settings.showCoordinates} onChange={(v) => update({ showCoordinates: v })} />
        <Toggle label="Show legal moves" checked={settings.showLegalMoves} onChange={(v) => update({ showLegalMoves: v })} />
        <Toggle label="Move-quality badges on the board" checked={settings.showBoardBadges} onChange={(v) => update({ showBoardBadges: v })} />
        <Toggle label="Engine arrows" checked={settings.showArrows} onChange={(v) => update({ showArrows: v })} />
        <Toggle label="Piece animations" checked={settings.animations} onChange={(v) => update({ animations: v })} />
        <Toggle label="Sounds" checked={settings.sound} onChange={(v) => { update({ sound: v }); if (v) playSound("move", settings.soundVolume); }} />
        {settings.sound ? (
          <Field label={`Volume: ${Math.round(settings.soundVolume * 100)}%`}>
            {(p) => (
              <input
                {...p}
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.soundVolume}
                onChange={(e) => update({ soundVolume: Number(e.target.value) })}
                onPointerUp={() => playSound("capture", settings.soundVolume)}
                onKeyUp={() => playSound("move", settings.soundVolume)}
                className="accent-[var(--accent)]"
              />
            )}
          </Field>
        ) : null}
        <Toggle label="Glossary hints" checked={settings.showGlossaryHints} onChange={(v) => update({ showGlossaryHints: v })} />
      </Card>

      <Card className="p-5">
        <SectionTitle className="mb-3">Engine</SectionTitle>
        <Toggle
          label="Force single-threaded engine"
          checked={settings.engineMode === "single"}
          onChange={(v) => engineChange({ engineMode: v ? "single" : "auto" })}
        />
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field
            label={`Threads: ${settings.threads === 0 ? `Auto (${support ? recommendedThreads() : "…"})` : settings.threads}`}
          >
            {(p) => (
              <input
                {...p}
                type="range"
                min={0}
                max={typeof navigator !== "undefined" ? Math.max(1, navigator.hardwareConcurrency || 1) : 8}
                value={settings.threads}
                onChange={(e) => engineChange({ threads: Number(e.target.value) })}
                className="accent-[var(--accent)]"
              />
            )}
          </Field>
          <Field label={`Live analysis depth: ${settings.liveDepth}`}>
            {(p) => (
              <input {...p} type="range" min={8} max={30} value={settings.liveDepth} onChange={(e) => update({ liveDepth: Number(e.target.value) })} className="accent-[var(--accent)]" />
            )}
          </Field>
          <Field label={`Engine lines: ${settings.liveMultiPv}`}>
            {(p) => (
              <input {...p} type="range" min={1} max={5} value={settings.liveMultiPv} onChange={(e) => update({ liveMultiPv: Number(e.target.value) })} className="accent-[var(--accent)]" />
            )}
          </Field>
          <Field label="Default review strength">
            {(p) => (
              <select {...p} className={inputClass} value={settings.reviewPreset} onChange={(e) => update({ reviewPreset: e.target.value as typeof settings.reviewPreset })}>
                {Object.values(REVIEW_PRESETS).map((r) => (
                  <option key={r.preset} value={r.preset}>
                    {r.preset[0].toUpperCase() + r.preset.slice(1)} — depth {r.depth}, ≤{r.movetimeMs / 1000}s/position
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Toggle label="Review imported games automatically" checked={settings.autoReview} onChange={(v) => update({ autoReview: v })} />
        <Toggle label="Analyse automatically" checked={settings.autoAnalyze} onChange={(v) => update({ autoAnalyze: v })} />
        <Toggle label="Pause when tab is hidden" checked={settings.pauseWhenHidden} onChange={(v) => update({ pauseWhenHidden: v })} />
      </Card>

      <Card className="p-5">
        <SectionTitle className="mb-3">You</SectionTitle>
        <Field label="Your Chess.com username">
          {(p) => (
            <input {...p} className={inputClass} value={settings.chessComUsername} maxLength={25} onChange={(e) => update({ chessComUsername: e.target.value.trim() })} autoComplete="username" />
          )}
        </Field>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <p className="font-medium">Lichess account</p>
            <p className="text-ink-3">{lichess ? `Connected${lichess.username ? ` as ${lichess.username}` : ""} · used for the opening explorer` : "Optional · unlocks the opening explorer"}</p>
          </div>
          {lichess ? (
            <Button size="sm" onClick={() => void disconnectLichess()}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={() => void startLichessLogin(window.location.pathname + window.location.search)}>
              Connect Lichess
            </Button>
          )}
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <SectionTitle>Data</SectionTitle>
        {cleared ? <Alert tone="success">All saved games, reviews and cached data were deleted, and Lichess was disconnected.</Alert> : null}
        <div className="flex flex-wrap gap-2">
          {confirm ? (
            <>
              <Button
                variant="danger"
                onClick={async () => {
                  await clearAll();
                  await disconnectLichess();
                  setCleared(true);
                  setConfirm(false);
                }}
              >
                Yes, delete all local data
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirm(true)}>Delete all local data</Button>
          )}
          <Button onClick={reset}>Reset settings</Button>
        </div>
      </Card>
    </div>
  );
}
