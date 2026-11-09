"use client";

import { useState } from "react";
import { Check, Shuffle } from "lucide-react";
import { cx } from "@/components/ui/primitives";
import { API_URL } from "@/lib/api";

/** The DiceBear styles on offer; the server accepts only these, and adds each one's colours and friendly faces. */
export const PICTURE_STYLES = [
  { id: "avataaars", label: "People" },
  { id: "open-peeps", label: "Sketches" },
  { id: "thumbs", label: "Shapes" },
] as const;
export type PictureStyle = (typeof PICTURE_STYLES)[number]["id"];
export interface Picture {
  style: PictureStyle;
  seed: string;
}

const seeds = () => Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 10));
const previewUrl = (style: PictureStyle, seed: string) => `${API_URL}/api/avatar/guest/${style}/${seed}`;

/** Eight pictures to choose from, a style switch and a shuffle. Used by guests and by Google accounts alike. */
export function useNewPicture(): [Picture, (p: Picture) => void, string[], () => void] {
  const [options, setOptions] = useState<string[]>(seeds);
  const [picture, setPicture] = useState<Picture>(() => ({ style: "avataaars", seed: options[0] }));
  const shuffle = () => {
    const next = seeds();
    setOptions(next);
    setPicture((p) => ({ style: p.style, seed: next[0] }));
  };
  return [picture, setPicture, options, shuffle];
}

export function AvatarPicker({ picture, onChange, options, onShuffle }: { picture: Picture; onChange: (p: Picture) => void; options: string[]; onShuffle: () => void }) {
  return (
    <fieldset>
      <div className="mb-2 flex items-center justify-between gap-2">
        <legend className="text-sm font-medium">Your picture</legend>
        <div className="flex items-center gap-1">
          <div role="radiogroup" aria-label="Picture style" className="flex rounded-full border border-border p-0.5">
            {PICTURE_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={picture.style === s.id}
                onClick={() => onChange({ style: s.id, seed: picture.seed })}
                className={cx("h-7 rounded-full px-2.5 text-xs font-medium transition-colors", picture.style === s.id ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink")}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Show other pictures"
            title="Show other pictures"
            className="inline-flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <Shuffle className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      <div role="radiogroup" aria-label="Picture" className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {options.map((s, i) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={picture.seed === s}
            aria-label={`Picture ${i + 1}`}
            onClick={() => onChange({ style: picture.style, seed: s })}
            className={cx(
              "relative aspect-square overflow-hidden rounded-xl border bg-bg transition-[transform,box-shadow] active:scale-95",
              picture.seed === s ? "border-accent ring-2 ring-accent" : "border-border hover:border-ink-3",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- generated picture served by the Tempo API; the site is a static export */}
            <img src={previewUrl(picture.style, s)} alt="" width={64} height={64} loading="lazy" className="size-full object-cover" />
            {picture.seed === s ? (
              <span className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-accent text-accent-ink">
                <Check className="size-2.5" aria-hidden />
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-3">Pictures by DiceBear.</p>
    </fieldset>
  );
}
