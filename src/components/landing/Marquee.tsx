const ITEMS = [
  "Stockfish in your browser",
  "No account",
  "Works offline",
  "Every move graded",
  "A coach that talks",
  "Play a friend with a link",
  "Blindfold chess",
  "Your own mistake bank",
  "Free",
];

/** A slow ticker of what Tempo is. Decorative: the same words are in a hidden list for screen readers. */
export function Marquee() {
  const row = ITEMS.map((item) => (
    <span key={item} className="flex items-center gap-10 whitespace-nowrap">
      <span>{item}</span>
      <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
    </span>
  ));
  return (
    <div className="marquee overflow-hidden border-y border-border bg-surface/60 py-4">
      <ul className="sr-only">
        {ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div aria-hidden className="marquee-track eyebrow flex w-max items-center gap-10 !text-ink-2">
        {row}
        {row}
      </div>
    </div>
  );
}
