import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** The title block at the top of an inner page: a small label, a display title and one line of context. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  back,
  actions,
  size = "md",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  back?: { href: string; label: string };
  actions?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-border pb-5">
      <div className="min-w-0">
        <p className="eyebrow mb-2 flex items-center gap-2">
          {back ? (
            <Link href={back.href} aria-label={back.label} className="grid size-6 place-items-center rounded-full border border-border text-ink-2 transition-colors hover:border-ink hover:text-ink">
              <ArrowLeft className="size-3.5" aria-hidden />
            </Link>
          ) : null}
          {eyebrow}
        </p>
        <h1 className={size === "lg" ? "display text-5xl sm:text-6xl" : "display text-3xl sm:text-4xl"}>{title}</h1>
        {subtitle ? <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
