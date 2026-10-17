import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Crosshair, Library } from "lucide-react";

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
    <div className="mx-auto max-w-6xl px-4 py-4">
      <h1 className="mb-4 font-serif text-2xl font-semibold tracking-tight">Learn</h1>
      <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        {SECTIONS.map(({ href, title, text, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-8 text-center shadow-sm transition-colors hover:border-accent hover:bg-accent-soft"
            >
              <Icon className="size-12 text-accent" aria-hidden />
              <span className="font-serif text-xl font-semibold">{title}</span>
              <span className="text-sm text-ink-2">{text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
