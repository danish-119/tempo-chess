import { Reveal } from "./Reveal";
import { WordReveal } from "./WordReveal";

/** The thesis, lit word by word as you scroll, */
export function Intro() {
  return (
    <section className="land-paper">
      <div className="land-wrap py-24 sm:py-32">
        <Reveal>
          <p className="eyebrow mb-8 flex items-center gap-3">
            <span className="inline-block h-px w-10 bg-accent" aria-hidden /> Why Tempo
          </p>
        </Reveal>
        <WordReveal
          className="display max-w-5xl text-[clamp(2rem,4.6vw,3.9rem)] !leading-[1.08] !tracking-[-0.02em]"
          text="Chess gets better when you understand your own games. Tempo plays with you, explains every move in plain words, and gives you the practice to get better."
        />
      </div>
    </section>
  );
}
