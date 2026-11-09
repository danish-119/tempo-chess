"use client";

import { setQuery as setUrlQuery } from "@/lib/url";
import { ArrowLeft, BookOpen, ClipboardCheck, Compass, Cpu, Crown, Crosshair, FileText, Flag, Scale, Search, Timer, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MiniBoard } from "@/components/learn/MiniBoard";
import { cx, inputClass } from "@/components/ui/primitives";
import { GLOSSARY, GLOSSARY_SECTIONS, type GlossaryCategory } from "@/lib/glossary";
import { GLOSSARY_DIAGRAMS } from "@/lib/glossary-diagrams";

const ICONS: Record<GlossaryCategory, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  rules: Scale,
  openings: Flag,
  strategy: Compass,
  tactics: Crosshair,
  endgame: Crown,
  notation: FileText,
  playing: Timer,
  engine: Cpu,
  review: ClipboardCheck,
};

/** The glossary as topics to open, terms to tap, and one card (with a diagram where it helps) for the term you picked. */
export function GlossaryView() {
  const [query, setQuery] = useState("");
  const [section, setSectionState] = useState<GlossaryCategory | null>(null);
  const [pickedId, setPickedIdState] = useState<string | null>(null);

  /** The open topic and term live in the address: /learn/glossary?topic=tactics#fork. */
  const setSection = (c: GlossaryCategory | null) => {
    setSectionState(c);
    setUrlQuery({ topic: c });
  };
  const setPickedId = (id: string | null) => {
    setPickedIdState(id);
    if (typeof window !== "undefined") window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${id ? `#${id}` : ""}`);
  };

  // A link such as /learn/glossary#zugzwang or ?topic=tactics opens straight there.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    const hit = GLOSSARY.find((g) => g.id === id);
    const topic = new URLSearchParams(window.location.search).get("topic");
    const t = setTimeout(() => {
      if (hit) {
        setSectionState(hit.category);
        setPickedIdState(hit.id);
      } else if (topic && GLOSSARY.some((g) => g.category === topic)) {
        setSectionState(topic as GlossaryCategory);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const shown = useMemo(() => {
    if (searching) return GLOSSARY.filter((g) => g.term.toLowerCase().includes(q) || g.short.toLowerCase().includes(q) || g.long?.toLowerCase().includes(q));
    return section ? GLOSSARY.filter((g) => g.category === section) : [];
  }, [q, searching, section]);

  const picked = GLOSSARY.find((g) => g.id === pickedId) ?? null;
  const pickedSection = picked ? GLOSSARY_SECTIONS.find((s) => s.id === picked.category)?.title : null;
  const diagram = picked ? GLOSSARY_DIAGRAMS[picked.id] : undefined;
  const sectionTitle = section ? GLOSSARY_SECTIONS.find((s) => s.id === section)?.title : null;
  const showTerms = searching || section !== null;

  return (
    <div className={cx("grid gap-5", showTerms && "lg:grid-cols-[minmax(0,1fr)_420px]")}>
      <div className="min-w-0 space-y-4">
        <label className="relative block">
          <span className="sr-only">Search the glossary</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input type="search" className={cx(inputClass, "pl-9")} placeholder={`Search ${GLOSSARY.length} terms`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>

        {!showTerms ? (
          <ul className="grid grid-cols-3 gap-2.5 sm:gap-3" aria-label="Topics">
            {GLOSSARY_SECTIONS.map((s, i) => {
              const Icon = ICONS[s.id] ?? BookOpen;
              const count = GLOSSARY.filter((g) => g.category === s.id).length;
              return (
                <li key={s.id} className="animate-[tile-pop_0.3s_ease-out_both]" style={{ animationDelay: `${i * 30}ms` }}>
                  <button
                    type="button"
                    onClick={() => setSection(s.id)}
                    className="group flex h-full min-h-[clamp(5.5rem,16dvh,9rem)] w-full flex-col justify-between gap-2 rounded-2xl border border-border bg-surface p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-[var(--shadow)] focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.985] sm:p-4"
                  >
                    <Icon className="size-6 text-accent transition-transform group-hover:scale-110" aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold leading-tight sm:text-base">{s.title}</span>
                      <span className="block font-mono text-[11px] text-ink-3">{count}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <>
            {!searching ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setSection(null); setPickedId(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm text-ink-2 transition-colors hover:border-ink-3 hover:text-ink">
                  <ArrowLeft className="size-4" aria-hidden /> Topics
                </button>
                <h2 className="display text-2xl">{sectionTitle}</h2>
              </div>
            ) : null}
            {shown.length === 0 ? (
              <p className="text-sm text-ink-3">No terms match “{query}”.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3" aria-label={searching ? "Results" : `${sectionTitle} terms`}>
                {shown.map((g, i) => {
                  const pic = GLOSSARY_DIAGRAMS[g.id];
                  const on = pickedId === g.id;
                  return (
                    <li key={g.id} className="animate-[tile-pop_0.25s_ease-out_both]" style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}>
                      <button
                        type="button"
                        onClick={() => setPickedId(g.id)}
                        aria-pressed={on}
                        className={cx(
                          "flex h-full w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-all hover:-translate-y-0.5 active:scale-[0.99]",
                          on ? "border-accent bg-accent-soft shadow-sm" : "border-border bg-surface hover:border-accent",
                        )}
                      >
                        {pic ? (
                          <span className="size-12 shrink-0" aria-hidden>
                            <MiniBoard fen={pic.fen} glow={pic.glow} className="!max-h-none" />
                          </span>
                        ) : (
                          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-2 font-serif text-xl text-accent" aria-hidden>
                            {g.term[0]}
                          </span>
                        )}
                        <span className="min-w-0 font-semibold text-ink">{g.term}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {/* One card for the picked term: beside the list on a wide screen, a sheet above the tab bar on a phone. */}
      {showTerms ? (
        <aside
          aria-live="polite"
          className={cx(
            "rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow)] sm:p-6",
            "max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[calc(4.9rem+env(safe-area-inset-bottom))] max-lg:z-30 max-lg:max-h-[75dvh] max-lg:overflow-y-auto",
            "lg:sticky lg:top-20 lg:self-start",
            !picked && "max-lg:hidden",
          )}
        >
          {picked ? (
            <div key={picked.id} className="animate-[tile-pop_0.25s_ease-out]">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow !text-[11px]">{pickedSection}</p>
                  <h2 className="display mt-1 text-4xl">{picked.term}</h2>
                </div>
                <button type="button" onClick={() => setPickedId(null)} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden">
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              {diagram ? (
                <div className="mx-auto mt-4 aspect-square w-full max-w-[min(100%,320px)]">
                  <MiniBoard fen={diagram.fen} glow={diagram.glow} coords className="!max-h-none !text-2xl" />
                </div>
              ) : null}
              <p className="mt-4 text-lg leading-relaxed text-ink">{picked.short}</p>
              {picked.long ? <p className="mt-3 text-base leading-relaxed text-ink-2">{picked.long}</p> : null}
              {picked.learn ? (
                <Link href={picked.learn} className="inline-flex items-center justify-center gap-2 rounded-full bg-accent font-semibold text-accent-ink transition-[filter] hover:brightness-110 mt-4 h-10 px-5 text-sm">
                  Learn with examples
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-3">Pick a term.</p>
          )}
        </aside>
      ) : null}
    </div>
  );
}
