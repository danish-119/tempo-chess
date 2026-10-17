import { GraduationCap, Search, Swords, Target } from "lucide-react";
import { ButtonLink } from "@/components/ui/primitives";
import { HeroPreview } from "./HeroPreview";

const PILLARS = [
  {
    Icon: Swords,
    title: "Play",
    href: "/play",
    cta: "Play now",
    points: ["10 bots, from beginner to full-strength Stockfish", "Coach mode: hints, threat warnings, live feedback", "Play in person on one device, with optional clocks"],
  },
  {
    Icon: Search,
    title: "Review",
    href: "/review",
    cta: "Review a game",
    points: ["Import Chess.com games by username, or any PGN", "Every move graded — Brilliant to Blunder — with reasons", "Accuracy, key moments, eval graph, annotated export"],
  },
  {
    Icon: Target,
    title: "Practice",
    href: "/practice",
    cta: "Solve puzzles",
    points: ["10,000 hand-picked puzzles, served at random", "Pick your level and a theme: forks, pins, mates…", "Hints, solutions, a timer and a session streak"],
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-12 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div className="space-y-6">
          <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">Play. Review. Improve.</h1>
          <p className="max-w-xl text-lg text-ink-2">
            Play bots or a friend with a coach at your side, get every game reviewed move by move, and sharpen your tactics with puzzles — all free,
            powered by Stockfish in your browser.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/play" variant="primary" size="lg">
              <GraduationCap className="size-5" aria-hidden /> Play with Coach
            </ButtonLink>
            <ButtonLink href="/review" size="lg">
              <Search className="size-5" aria-hidden /> Review a game
            </ButtonLink>
          </div>
        </div>
        <HeroPreview />
      </section>

      <section aria-labelledby="pillars" className="mx-auto max-w-7xl px-4 pb-14">
        <h2 id="pillars" className="sr-only">What you can do</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {PILLARS.map(({ Icon, title, href, cta, points }) => (
            <li key={title} className="card flex flex-col p-6">
              <Icon className="mb-3 size-7 text-accent" aria-hidden />
              <h3 className="mb-2 font-serif text-2xl font-semibold">{title}</h3>
              <ul className="mb-5 flex-1 space-y-1.5 text-sm text-ink-2">
                {points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
              <ButtonLink href={href} variant="secondary" className="self-start">
                {cta}
              </ButtonLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
