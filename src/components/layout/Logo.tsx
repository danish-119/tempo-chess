/** Tempo mark: a stylised clock hand over a board square. Original artwork. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden focusable="false">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="var(--accent)" />
      <rect x="2" y="2" width="14" height="14" rx="0" fill="var(--accent-ink)" opacity="0.16" />
      <rect x="16" y="16" width="14" height="14" rx="0" fill="var(--accent-ink)" opacity="0.16" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" />
      <path d="M16 10.5V16l3.8 2.6" fill="none" stroke="var(--accent-ink)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
