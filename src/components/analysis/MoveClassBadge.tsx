import { BookOpen, Sparkles, Check, CheckCheck, CircleAlert, CircleX, Crosshair, Lock, ThumbsUp, TriangleAlert, Unlink } from "lucide-react";
import { MOVE_CLASS_LABEL, type MoveClass } from "@/lib/review/types";
import { cx } from "@/components/ui/primitives";

/** Tempo's own symbols and colours. */
const META: Record<MoveClass, { color: string; Icon: typeof Check; nag?: string }> = {
  brilliant: { color: "var(--c-brilliant)", Icon: Sparkles, nag: "!!" },
  book: { color: "var(--c-book)", Icon: BookOpen },
  forced: { color: "var(--c-forced)", Icon: Lock },
  only: { color: "var(--c-only)", Icon: Crosshair, nag: "!" },
  best: { color: "var(--c-best)", Icon: CheckCheck },
  excellent: { color: "var(--c-excellent)", Icon: Check },
  good: { color: "var(--c-good)", Icon: ThumbsUp },
  inaccuracy: { color: "var(--c-inaccuracy)", Icon: CircleAlert, nag: "?!" },
  mistake: { color: "var(--c-mistake)", Icon: TriangleAlert, nag: "?" },
  blunder: { color: "var(--c-blunder)", Icon: CircleX, nag: "??" },
  "missed-win": { color: "var(--c-missed)", Icon: Unlink, nag: "?" },
};

export function moveClassColor(c: MoveClass): string {
  return META[c].color;
}

export function moveClassNag(c: MoveClass): string | undefined {
  return META[c].nag;
}

export function MoveClassIcon({ classification, className }: { classification: MoveClass; className?: string }) {
  const { Icon, color } = META[classification];
  return <Icon className={cx("shrink-0", className ?? "size-4")} style={{ color }} aria-hidden />;
}

export function MoveClassBadge({ classification, size = "md" }: { classification: MoveClass; size?: "sm" | "md" }) {
  const { color, Icon } = META[classification];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-xs",
      )}
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      {MOVE_CLASS_LABEL[classification]}
    </span>
  );
}

