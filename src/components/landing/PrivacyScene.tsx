import { Cpu, Database, Globe, WifiOff } from "lucide-react";
import { Reveal } from "./Reveal";

const FACTS = [
  { Icon: Cpu, title: "Stockfish runs here", text: "The engine is a WebAssembly file in your browser. Nothing is sent away to be analysed." },
  { Icon: Database, title: "Your games are saved here", text: "Games, reviews and progress live in your browser's own storage, and you can export them as a file." },
  { Icon: WifiOff, title: "It works anywhere", text: "After your first visit Tempo works with no connection at all, and installs like an app." },
] as const;

/** The privacy promise, drawn: everything inside the browser, one dashed line out, only when you ask. */
export function PrivacyScene() {
  return (
    <section className="land-paper" aria-labelledby="privacy-h">
      <div className="land-wrap grid gap-12 py-16 sm:py-20 lg:min-h-[calc(100svh-3.5rem)] lg:grid-cols-[1fr_minmax(0,0.9fr)] lg:items-center lg:gap-16 lg:py-8">
        <Reveal>
          <p className="eyebrow mb-6">Private by design</p>
          <h2 id="privacy-h" className="display text-[clamp(2.2rem,min(5.2vw,9svh),4.5rem)]">
            Your games never leave your device.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ink-2 lg:text-lg [@media(max-height:760px)]:text-base">
            No accounts, no cookies, no analytics, no uploads. The only time Tempo talks to another website is when you ask it to import a game.
          </p>
          <ul className="mt-8 space-y-5 [@media(max-height:760px)]:mt-5 [@media(max-height:760px)]:space-y-3">
            {FACTS.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                  <Icon className="size-5 text-accent" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 max-w-md text-[15px] leading-relaxed text-ink-2">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={120}>
          <div className="mx-auto w-full max-w-[520px]" aria-hidden>
            <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-[var(--shadow)]">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="size-3 rounded-full bg-surface-2" />
                <span className="size-3 rounded-full bg-surface-2" />
                <span className="size-3 rounded-full bg-surface-2" />
                <span className="ml-3 flex-1 truncate rounded-full bg-bg px-4 py-1.5 font-mono text-[11px] text-ink-3">your browser · this device</span>
              </div>
              <div className="grid grid-cols-2 gap-3 p-5 font-mono text-xs">
                {["Stockfish engine", "Your games", "Reviews", "Progress & settings"].map((label) => (
                  <div key={label} className="rounded-2xl border border-border bg-bg px-4 py-6 text-center text-ink [@media(max-height:760px)]:py-4">
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-auto flex h-10 w-px flex-col items-center border-l border-dashed border-ink-3 lg:h-12" />
            <p className="eyebrow mb-3 text-center !text-[11px]">only when you import a game</p>
            <div className="flex items-center justify-center gap-3 font-mono text-xs text-ink-2">
              {["chess.com", "lichess.org"].map((site) => (
                <span key={site} className="flex items-center gap-2 rounded-full border border-dashed border-ink-3 px-4 py-2">
                  <Globe className="size-3.5" /> {site}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
