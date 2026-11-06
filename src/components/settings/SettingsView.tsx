"use client";

import { Cpu, Monitor, Moon, Palette, ShieldCheck, Sun, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Alert, Button, Field, Toggle, cx, inputClass } from "@/components/ui/primitives";
import { detectSupport, recommendedThreads, resetEngine } from "@/lib/engine/client";
import { REVIEW_PRESETS } from "@/lib/review/review";
import { BOARD_THEMES, PIECE_SETS, boardTheme, pieceUrl } from "@/lib/appearance";
import { playSound } from "@/lib/sound";
import { clearAll } from "@/lib/storage/db";
import { useLichessAuth } from "@/hooks/useLichessAuth";
import { disconnectLichess, startLichessLogin } from "@/lib/lichess/auth";

type TabId = "appearance" | "sound" | "engine" | "data";
const TABS: { id: TabId; label: string; Icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "sound", label: "Sound & coach", Icon: Volume2 },
  { id: "engine", label: "Engine", Icon: Cpu },
  { id: "data", label: "Account & data", Icon: ShieldCheck },
];
const THEMES = [
  { id: "system", label: "System", Icon: Monitor },
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
] as const;

/** A titled group of settings inside a tab. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="eyebrow !text-[11px]">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

const swatchRing = "ring-offset-2 ring-offset-bg peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus)]";

export function SettingsView() {
  const { settings, update, reset } = useSettings();
  const [support, setSupport] = useState<ReturnType<typeof detectSupport> | null>(null);
  const [cleared, setCleared] = useState(false);
  const lichess = useLichessAuth();
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState<TabId>("appearance");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(detectSupport());
  }, []);

  const engineChange = (patch: Parameters<typeof update>[0]) => {
    update(patch);
    void resetEngine(); // re-created with new options on next use
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Settings sections" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-1 sm:grid-cols-4">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`settings-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`settings-panel-${id}`}
            onClick={() => setTab(id)}
            className={cx(
              "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              tab === id ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} className="space-y-8">
        {tab === "appearance" ? (
          <>
            <Group title="Theme">
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-bg p-1" role="radiogroup" aria-label="Theme">
                {THEMES.map(({ id, label, Icon }) => (
                  <label
                    key={id}
                    className={cx(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[var(--focus)]",
                      settings.theme === id ? "bg-accent text-accent-ink shadow-sm" : "text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    <input type="radio" name="theme" className="sr-only" aria-label={id} checked={settings.theme === id} onChange={() => update({ theme: id })} />
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </label>
                ))}
              </div>
            </Group>

            <Group title="Board">
              <fieldset>
                <legend className="sr-only">Board colours</legend>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                  {BOARD_THEMES.map((t) => (
                    <label key={t.id} className="cursor-pointer text-center text-[11px] text-ink-2">
                      <input type="radio" name="boardTheme" className="peer sr-only" checked={settings.boardTheme === t.id} onChange={() => update({ boardTheme: t.id })} />
                      <span className={cx("mb-1.5 grid aspect-square grid-cols-2 overflow-hidden rounded-lg", swatchRing)} aria-hidden>
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
            </Group>

            <Group title="Pieces">
              <fieldset>
                <legend className="sr-only">Piece set</legend>
                <div className="grid grid-cols-5 gap-3">
                  {PIECE_SETS.map((p) => (
                    <label key={p.id} className="cursor-pointer text-center text-[11px] text-ink-2" title={p.license}>
                      <input type="radio" name="pieceSet" className="peer sr-only" checked={settings.pieceSet === p.id} onChange={() => update({ pieceSet: p.id })} />
                      <span className={cx("mb-1.5 flex aspect-square items-center justify-center rounded-lg", swatchRing)} style={{ background: boardTheme(settings.boardTheme).light }} aria-hidden>
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
            </Group>

            <Group title="On the board">
              <div className="divide-y divide-border">
                <Toggle label="Board coordinates" checked={settings.showCoordinates} onChange={(v) => update({ showCoordinates: v })} />
                <Toggle label="Show legal moves" checked={settings.showLegalMoves} onChange={(v) => update({ showLegalMoves: v })} />
                <Toggle label="Move-quality badges on the board" checked={settings.showBoardBadges} onChange={(v) => update({ showBoardBadges: v })} />
                <Toggle label="Engine arrows" checked={settings.showArrows} onChange={(v) => update({ showArrows: v })} />
                <Toggle label="Piece animations" checked={settings.animations} onChange={(v) => update({ animations: v })} />
                <Toggle label="Colour-blind-safe move colours" checked={settings.colorBlindSafe} onChange={(v) => update({ colorBlindSafe: v })} />
              </div>
            </Group>
          </>
        ) : null}

        {tab === "sound" ? (
          <>
            <Group title="Sound">
              <div className="divide-y divide-border">
                <Toggle
                  label="Sounds"
                  checked={settings.sound}
                  onChange={(v) => {
                    update({ sound: v });
                    if (v) playSound("move", settings.soundVolume);
                  }}
                />
                {settings.sound ? (
                  <div className="py-3">
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
                  </div>
                ) : null}
              </div>
            </Group>
            <Group title="Coach & accessibility">
              <div className="divide-y divide-border">
                <Toggle label="Coach speaks its feedback aloud" description="Uses your browser's built-in voice." checked={settings.coachVoice} onChange={(v) => update({ coachVoice: v })} />
                <Toggle label="Announce moves to screen readers" checked={settings.announceMoves} onChange={(v) => update({ announceMoves: v })} />
                <Toggle label="Glossary hints" description="Explain chess terms as you meet them." checked={settings.showGlossaryHints} onChange={(v) => update({ showGlossaryHints: v })} />
              </div>
            </Group>
          </>
        ) : null}

        {tab === "engine" ? (
          <>
            <Group title="Performance">
              <div className="divide-y divide-border">
                <Toggle
                  label="Force single-threaded engine"
                  description="Use this if analysis is unstable on your device."
                  checked={settings.engineMode === "single"}
                  onChange={(v) => engineChange({ engineMode: v ? "single" : "auto" })}
                />
                <Toggle label="Pause when tab is hidden" checked={settings.pauseWhenHidden} onChange={(v) => update({ pauseWhenHidden: v })} />
              </div>
              <div className="grid gap-4 pt-3 sm:grid-cols-2">
                <Field label={`Threads: ${settings.threads === 0 ? `Auto (${support ? recommendedThreads() : "…"})` : settings.threads}`}>
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
              </div>
            </Group>
            <Group title="Game review">
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
              <div className="divide-y divide-border pt-2">
                <Toggle label="Review imported games automatically" checked={settings.autoReview} onChange={(v) => update({ autoReview: v })} />
                <Toggle label="Analyse automatically" checked={settings.autoAnalyze} onChange={(v) => update({ autoAnalyze: v })} />
              </div>
            </Group>
          </>
        ) : null}

        {tab === "data" ? (
          <>
            <Group title="Accounts">
              <Field label="Your Chess.com username" hint="Used to import your games and mark which side you played.">
                {(p) => (
                  <input {...p} className={inputClass} value={settings.chessComUsername} maxLength={25} onChange={(e) => update({ chessComUsername: e.target.value.trim() })} autoComplete="username" />
                )}
              </Field>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
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
            </Group>

            <Group title="Your data">
              <p className="text-sm text-ink-2">Everything lives in this browser. Nothing is uploaded.</p>
              {cleared ? <Alert tone="success">All saved games, reviews and cached data were deleted, and Lichess was disconnected.</Alert> : null}
              <div className="flex flex-wrap gap-2 pt-2">
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
                    <Button variant="ghost" onClick={() => setConfirm(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="danger" onClick={() => setConfirm(true)}>
                    Delete all local data
                  </Button>
                )}
                <Button onClick={reset}>Reset settings</Button>
              </div>
            </Group>
          </>
        ) : null}
      </div>
    </div>
  );
}
