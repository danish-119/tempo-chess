"use client";

import Link from "next/link";
import { GLOSSARY_BY_ID } from "@/lib/glossary";
import { useSettings } from "@/components/providers/SettingsProvider";

/** Inline glossary hint: a dotted-underlined link to the Learn page with a hover definition. */
export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const { settings } = useSettings();
  const entry = GLOSSARY_BY_ID[id];
  if (!entry || !settings.showGlossaryHints) return <>{children}</>;
  return (
    <Link
      href={`/learn/glossary#${entry.id}`}
      target="_blank"
      rel="noopener"
      title={`${entry.term}: ${entry.short}`}
      className="underline decoration-dotted decoration-ink-3 underline-offset-2 hover:decoration-ink"
    >
      {children}
    </Link>
  );
}
