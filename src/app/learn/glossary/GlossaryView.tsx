"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cx, inputClass } from "@/components/ui/primitives";
import { GLOSSARY, GLOSSARY_SECTIONS, type GlossaryCategory } from "@/lib/glossary";

/** Searchable glossary, grouped by topic. */
export function GlossaryView() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<GlossaryCategory | "all">("all");

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      GLOSSARY.filter(
        (g) =>
          (section === "all" || g.category === section) &&
          (!q || g.term.toLowerCase().includes(q) || g.short.toLowerCase().includes(q) || g.long?.toLowerCase().includes(q)),
      ),
    [q, section],
  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Search the glossary</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            className={cx(inputClass, "pl-9")}
            placeholder={`Search ${GLOSSARY.length} terms — e.g. en passant, outpost, zugzwang`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Topic">
          {[{ id: "all" as const, title: "All" }, ...GLOSSARY_SECTIONS].map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={section === s.id}
              onClick={() => setSection(s.id)}
              className={cx(
                "rounded-full border px-3 py-1 text-sm",
                section === s.id ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-ink-3">No terms match “{query}”.</p>
      ) : (
        <div className="space-y-8">
          {GLOSSARY_SECTIONS.filter((s) => matches.some((g) => g.category === s.id)).map((s) => (
            <section key={s.id} aria-labelledby={`h-${s.id}`}>
              <h2 id={`h-${s.id}`} className="mb-3 font-serif text-xl font-semibold">
                {s.title}
              </h2>
              <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
                {matches
                  .filter((g) => g.category === s.id)
                  .map((g) => (
                    <div key={g.id} id={g.id} className="scroll-mt-20 p-4 target:bg-accent-soft">
                      <dt className="font-semibold">{g.term}</dt>
                      <dd className="text-sm text-ink-2">
                        {g.short}
                        {g.long ? <span className="mt-1 block">{g.long}</span> : null}
                        {g.learn ? (
                          <Link href={g.learn} className="mt-2 block w-fit text-sm font-medium text-accent underline">
                            Learn with examples →
                          </Link>
                        ) : null}
                      </dd>
                    </div>
                  ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
