import { MOVE_CLASS_LABEL, type MoveClass } from "@/lib/review/types";
import { MoveClassIcon, moveClassColor } from "@/components/analysis/MoveClassBadge";

/** Small circular move-quality marker drawn in the corner of a board square. */
export function BoardBadge({ classification }: { classification: MoveClass }) {
  const color = moveClassColor(classification);
  return (
    <span
      className="pointer-events-none absolute top-[3%] right-[3%] z-10 flex size-[38%] items-center justify-center rounded-full shadow-md ring-2 ring-white/90"
      style={{ background: color }}
      role="img"
      aria-label={MOVE_CLASS_LABEL[classification]}
      title={MOVE_CLASS_LABEL[classification]}
    >
      <MoveClassIcon classification={classification} className="size-[62%] !text-white" />
    </span>
  );
}
