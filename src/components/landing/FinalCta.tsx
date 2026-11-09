import Link from "next/link";
import { Reveal } from "./Reveal";

/** The finale: a brass band with the whole invitation in two words. */
export function FinalCta() {
  return (
    <section className="land-dark relative isolate overflow-hidden" style={{ background: "var(--accent)", color: "var(--accent-ink)" }} aria-labelledby="cta-h">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -bottom-24 -z-10 select-none font-serif text-[clamp(18rem,42vw,42rem)] leading-none opacity-[0.09]"
      >
        ♞
      </span>
      <div className="land-wrap py-20 sm:py-24">
        <Reveal>
          <p className="mb-6 flex items-center gap-3 font-mono text-xs tracking-[0.16em] uppercase">
            <span className="inline-block h-px w-10 bg-current" aria-hidden /> Ready when you are
          </p>
          <h2 id="cta-h" className="display text-[clamp(4rem,15vw,13rem)] !leading-[0.88]">
            Your move.
          </h2>
          <p className="mt-8 max-w-xl text-lg leading-relaxed sm:text-xl">Free, and in your browser right now. Nothing to install.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/play"
              className="pill"
              style={{ background: "#1d1b18", borderColor: "#1d1b18", color: "#f4efe4" }}
            >
              Play now
            </Link>
            <Link href="/review" className="pill" style={{ borderColor: "currentColor", color: "inherit" }}>
              Review a game
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
