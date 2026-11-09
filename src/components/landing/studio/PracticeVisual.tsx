import { ArrowUpRight, Flame, X } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Board } from "@/components/board/Board";
import { FACTS } from "@/content/landing";
import { operaFen } from "@/content/opera-review";
import { cx } from "@/lib/cx";

/** How many tiles there are; the scene reveals them one after another. */
export const PRACTICE_TILES = 6;

function Tile({
  href,
  label,
  index,
  shown,
  className,
  children,
}: {
  href: string;
  label: string;
  index: number;
  shown: number;
  className?: string;
  children: ReactNode;
}) {
  const visible = index < shown;
  const style: CSSProperties = { opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(18px) scale(0.98)" };
  return (
    <Link
      href={href}
      aria-label={label}
      tabIndex={visible ? 0 : -1}
      style={style}
      className={cx(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 transition-[opacity,transform,border-color] duration-500 hover:border-accent sm:p-5",
        className,
      )}
    >
      {children}
      <ArrowUpRight className="absolute top-3.5 right-3.5 size-4 text-ink-3 transition-colors group-hover:text-accent" aria-hidden />
    </Link>
  );
}

function Title({ title, text }: { title: string; text?: string }) {
  return (
    <>
      <h3 className="display text-[clamp(1.05rem,1.6vw,1.4rem)] !leading-tight">{title}</h3>
      {text ? <p className="mt-1 hidden text-[13px] leading-snug text-ink-2 sm:block">{text}</p> : null}
    </>
  );
}

/** The training modes, each a link to the real mode. `shown` is how many tiles have appeared so far. */
export function PracticeVisual({ shown }: { shown: number }) {
  return (
    <div className="mx-auto grid w-full max-w-[600px] grid-cols-2 gap-2.5 sm:gap-3">
      <Tile href="/practice?mode=puzzles" label="Puzzles: practise tactics" index={0} shown={shown} className="row-span-2">
        <p className="eyebrow mb-3 !text-[10px] sm:!text-[11px]">Mate in 2 · find the move</p>
        <div className="mx-auto mb-3 w-full max-w-[230px]" aria-hidden>
          <Board fen={operaFen(30)} orientation="white" interactive={false} highlights={{ b3: "hint" }} id="landing-puzzle-board" ariaLabel="A mate in two" />
        </div>
        <Title title={`${FACTS.puzzles.toLocaleString("en-US")} puzzles`} text="By level and theme, with hints and a timer." />
      </Tile>

      <Tile href="/practice?mode=rush" label="Puzzle Rush: race the clock" index={1} shown={shown}>
        <div className="mb-2 flex items-center gap-3">
          <span className="display text-4xl tabular text-accent sm:text-5xl">2:41</span>
          <span className="flex items-center gap-1" aria-hidden>
            <X className="size-4 text-bad" />
            <X className="size-4 text-bad" />
            <span className="size-3.5 rounded-full border border-ink-3" />
          </span>
        </div>
        <Title title="Puzzle Rush" text="Beat the clock. Three mistakes end the run." />
      </Tile>

      <Tile href="/practice?mode=blindfold" label="Blindfold chess: play without seeing the board" index={2} shown={shown}>
        <div className="mb-2 rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs" aria-hidden>
          <p className="text-ink-3">The board is hidden.</p>
          <p className="mt-1 text-ink">
            <span className="text-accent">›</span> Nf3<span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-accent" />
          </p>
        </div>
        <Title title="Blindfold" text="Type your moves. Peek only if you must." />
      </Tile>

      <Tile href="/progress" label="Progress: streaks and a daily puzzle" index={3} shown={shown}>
        <div className="mb-2 flex items-center gap-2" aria-hidden>
          <Flame className="size-5 shrink-0 text-accent" />
          <div className="grid grid-flow-col grid-rows-3 gap-[3px]">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className={cx("size-2 rounded-[2px]", [0, 1, 2, 1, 3, 0, 2, 3][i % 8] === 0 ? "bg-surface-2" : [0, 1, 2, 1, 3, 0, 2, 3][i % 8] === 1 ? "bg-accent/35" : [0, 1, 2, 1, 3, 0, 2, 3][i % 8] === 2 ? "bg-accent/65" : "bg-accent")} />
            ))}
          </div>
        </div>
        <Title title="Streaks & daily puzzle" text="A rating estimate and a calendar, on every device." />
      </Tile>

      <Tile href="/practice?mode=endgames" label="Endgames: win against perfect defence" index={4} shown={shown} className="col-span-2 hidden sm:flex">
        <div className="flex items-center gap-4">
          <span className="display text-4xl tabular text-accent">{FACTS.endgames}</span>
          <div>
            <Title title="Endgames" />
            <p className="mt-0.5 text-[13px] text-ink-2">Win the key endgames against perfect tablebase defence.</p>
          </div>
        </div>
      </Tile>
    </div>
  );
}
