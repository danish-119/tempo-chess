import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Crosshair, Library } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Learn",
  description: "Learn the main chess openings move by move, the common tactics and checkmate patterns, and the words chess players use.",
  alternates: { canonical: "/learn" },
};

const SECTIONS = [
  { href: "/learn/openings", title: "Openings", text: "The main lines and the ideas behind them. Watch, then play them yourself.", Icon: BookOpen },
  { href: "/learn/tactics", title: "Tactics", text: "Forks, pins, skewers and classic mating patterns, with real examples.", Icon: Crosshair },
  { href: "/learn/glossary", title: "Glossary", text: "Plain-language meanings of chess and engine terms.", Icon: Library },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <PageHeader eyebrow="Learn" size="lg" title="Get better at chess." subtitle="Watch the main lines, learn the patterns behind the tactics, and look up any term. All free, all in your browser." />
      <ul className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ href, title, text, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)]"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft">
                <Icon className="size-6 text-accent" aria-hidden />
              </span>
              <span className="display mt-3 text-2xl">{title}</span>
              <span className="text-sm leading-relaxed text-ink-2">{text}</span>
              <ArrowUpRight className="absolute top-5 right-5 size-5 text-ink-3 transition-colors group-hover:text-accent" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
