"use client";

import { Chess } from "chess.js";
import { ArrowUpRight, BookOpen, Crosshair, GraduationCap, Library } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MiniBoard } from "@/components/learn/MiniBoard";
import { useAlive, useTick } from "@/app/practice/ModeTile";

/** The Italian Game, one move at a time. */
const OPENING_FENS = (() => {
  const g = new Chess();
  const out = [g.fen()];
  for (const m of ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"]) {
    g.move(m);
    out.push(g.fen());
  }
  return out;
})();
const FORK_FEN = "8/8/2k1q3/8/3N4/8/8/6K1 w - - 0 1";
const TERMS = ["Fork", "Pin", "Tempo", "Gambit", "Zugzwang", "Skewer"];

function OpeningsPreview({ alive }: { alive: boolean }) {
  const t = useTick(alive, 900);
  const ply = alive ? t % OPENING_FENS.length : 5;
  return <MiniBoard fen={OPENING_FENS[ply]} />;
}

function TacticsPreview({ alive }: { alive: boolean }) {
  const t = useTick(alive, 700);
  const lit = alive && t % 2 === 1;
  return <MiniBoard fen={FORK_FEN} glow={lit ? ["c6", "e6"] : []} />;
}

function GlossaryPreview({ alive }: { alive: boolean }) {
  const t = useTick(alive, 1000);
  const term = alive ? TERMS[t % TERMS.length] : TERMS[0];
  return (
    <p key={term} className="display animate-[tile-pop_0.35s_ease-out] text-4xl text-accent" aria-hidden>
      {term}
    </p>
  );
}

const ROOK_FENS = ["7k/8/8/8/8/8/8/R3K3 w - - 0 1", "7k/8/8/R7/8/8/8/4K3 w - - 0 1"];

/** A rook that hops to a lit square: the first lesson in miniature. */
function BasicsPreview({ alive }: { alive: boolean }) {
  const t = useTick(alive, 1000);
  const hopped = alive && t % 2 === 1;
  return <MiniBoard fen={ROOK_FENS[hopped ? 1 : 0]} glow={["a5"]} />;
}

const TILES = [
  { href: "/learn/basics", title: "Basics", Icon: GraduationCap, Preview: BasicsPreview },
  { href: "/learn/openings", title: "Openings", Icon: BookOpen, Preview: OpeningsPreview },
  { href: "/learn/tactics", title: "Tactics", Icon: Crosshair, Preview: TacticsPreview },
  { href: "/learn/glossary", title: "Glossary", Icon: Library, Preview: GlossaryPreview },
];

function LearnTile({ href, title, Icon, Preview }: (typeof TILES)[number]) {
  const [engaged, setEngaged] = useState(false);
  const alive = useAlive(engaged);
  return (
    <Link
      href={href}
      onPointerEnter={() => setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)] focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.985]"
    >
      <span className="flex h-[clamp(4rem,15dvh,9rem)] items-center justify-center overflow-hidden border-b border-border bg-bg/60 p-2 transition-colors group-hover:bg-accent-soft sm:h-44 sm:p-4">
        <Preview alive={alive} />
      </span>
      <span className="flex items-center gap-2.5 px-3 py-2.5 sm:p-4">
        <Icon className="size-5 shrink-0 text-accent" aria-hidden />
        <span className="display min-w-0 flex-1 truncate text-xl sm:text-2xl">{title}</span>
        <ArrowUpRight className="size-5 shrink-0 text-ink-3 transition-colors group-hover:text-accent" aria-hidden />
      </span>
    </Link>
  );
}

/** The three Learn sections as tiles whose previews play when you hover, focus or (on touch) always. */
export function LearnTiles() {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {TILES.map((t) => (
        <li key={t.href}>
          <LearnTile {...t} />
        </li>
      ))}
    </ul>
  );
}
