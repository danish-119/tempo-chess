import { cx } from "@/lib/cx";

/**
 * Loading placeholders shaped like what is coming, instead of a spinner. Each composite announces itself once to
 * screen readers (`role="status"` with a hidden label); the shapes themselves are hidden from them. The shimmer stops
 * for visitors who prefer reduced motion (see `.skeleton` in globals.css).
 */

/** One placeholder block. Size and shape come from `className`. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  // Default corners only when the caller sets none (a `rounded-full` avatar must stay round).
  return <span aria-hidden className={cx("skeleton block", !className?.includes("rounded") && "rounded-md", className)} style={style} />;
}

/** A few lines of text, the last one shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden className={cx("block space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx("h-3", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </span>
  );
}

/** The wrapper every composite uses: announces `label` once and marks the region busy. */
function Loading({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A page heading: the small eyebrow and the big title. */
function HeaderSkeleton() {
  return (
    <div className="mb-5 border-b border-border pb-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-9 w-56 max-w-full" />
    </div>
  );
}

/** A board with a panel beside it: Play, Analysis, the editor, an online game, puzzles. Fits inside the page's own container. */
export function BoardPageSkeleton({ label, header = false, className }: { label: string; header?: boolean; className?: string }) {
  return (
    <Loading label={label} className={className}>
      {header ? <HeaderSkeleton /> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6">
        <div className="mx-auto w-full max-w-[min(100%,calc(100dvh-12rem))]">
          <div className="flex items-center gap-2 py-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3.5 w-28" />
          </div>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="flex items-center gap-2 py-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <Skeleton className="h-9 w-full rounded-xl" />
          <SkeletonText lines={3} />
          <Skeleton className="h-24 w-full rounded-xl" />
          <SkeletonText lines={2} />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 rounded-full" />
            <Skeleton className="h-10 rounded-full" />
          </div>
        </div>
      </div>
    </Loading>
  );
}

/** Just the square board, for a board area that loads on its own. */
export function BoardSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label}>
      <Skeleton className="aspect-square w-full rounded-xl" />
    </Loading>
  );
}

/** Rows of a list, such as imported games. */
export function ListSkeleton({ label, rows = 6, avatar = false, className }: { label: string; rows?: number; avatar?: boolean; className?: string }) {
  return (
    <Loading label={label} className={cx("divide-y divide-border overflow-hidden rounded-xl border border-border", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          {avatar ? <Skeleton className="size-8 shrink-0 rounded-full" /> : <Skeleton className="h-5 w-11 shrink-0 rounded-md" />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3.5" style={{ width: `${62 - ((i * 13) % 24)}%` }} />
            <Skeleton className="h-2.5 w-2/5" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </Loading>
  );
}

/** A few short lines inside a panel (a lookup, a saved review, engine lines). */
export function PanelSkeleton({ label, lines = 3, className }: { label: string; lines?: number; className?: string }) {
  return (
    <Loading label={label} className={className}>
      <SkeletonText lines={lines} />
    </Loading>
  );
}

/** A grid of tiles, such as the openings or tactics lists. */
export function TileGridSkeleton({ label, tiles = 12, header = false }: { label: string; tiles?: number; header?: boolean }) {
  return (
    <Loading label={label}>
      {header ? <HeaderSkeleton /> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: tiles }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="mt-2 h-3.5 w-4/5" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** The account page: a profile card and two sections. */
export function AccountSkeleton() {
  return (
    <Loading label="Loading your account…" className="mx-auto w-full max-w-xl space-y-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-3 w-52 max-w-full" />
        </div>
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="rounded-2xl border border-border bg-surface p-5">
          <Skeleton className="h-4 w-44" />
          <SkeletonText lines={2} className="mt-3" />
        </div>
      ))}
    </Loading>
  );
}

/** The Progress page: the four numbers, then the calendar and the cards below. */
export function ProgressSkeleton() {
  return (
    <Loading label="Loading your progress…" className="space-y-3 sm:space-y-4">
      <HeaderSkeleton />
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-3 sm:p-4">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="mt-2 h-7 w-4/5" />
          </div>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </Loading>
  );
}

/** A centred card, such as the screen before an online game starts. */
export function CardSkeleton({ label }: { label: string }) {
  return (
    <Loading label={label} className="mx-auto w-full max-w-md rounded-2xl border border-border bg-surface p-6">
      <Skeleton className="mx-auto h-6 w-40 rounded-full" />
      <Skeleton className="mx-auto mt-4 h-8 w-64 max-w-full" />
      <Skeleton className="mx-auto mt-5 h-16 w-56 rounded-2xl" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-10 rounded-full" />
      </div>
    </Loading>
  );
}
