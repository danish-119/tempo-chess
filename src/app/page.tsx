import { Download, GraduationCap, Lock, Search, Swords, Target, WifiOff } from "lucide-react";
import { ButtonLink } from "@/components/ui/primitives";
import { HeroPreview } from "./HeroPreview";

const PILLARS = [
  {
    Icon: Swords,
    title: "Play",
    href: "/play",
    cta: "Play now",
    points: [
      "10 bots, from beginner to full-strength Stockfish",
      "Coach mode: hints, threat warnings and live feedback on every move",
      "Challenge a friend online with just a link, with clocks and no account",
      "Or play in person on one device, with optional clocks",
    ],
  },
  {
    Icon: Search,
    title: "Review",
    href: "/review",
    cta: "Review a game",
    points: [
      "Import Chess.com or Lichess games by username, or any PGN",
      "Every move graded, Brilliant to Blunder, with a clear reason",
      "Accuracy, key moments, eval graph and annotated export",
      "Save your mistakes to a bank, or share the game as an animated GIF",
    ],
  },
  {
    Icon: Target,
    title: "Practice",
    href: "/practice",
    cta: "Start training",
    points: [
      "10,000 puzzles by level and theme, a daily puzzle and Puzzle Rush",
      "Endgames against perfect defence, coordinates and blindfold chess",
      "A mistake bank that brings your own errors back until you fix them",
      "Streaks and a rating estimate, saved privately on your device",
    ],
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-12 md:grid-cols-[1.1fr_1fr] md:pt-16">
        <div className="space-y-6">
          <h1 className="font-serif text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">Play. Review. Improve.</h1>
          <p className="max-w-xl text-lg text-ink-2">
            Play bots, a coach or a friend online. Get every game reviewed move by move, and sharpen your tactics with puzzles, blindfold and your own
            mistake bank. Free, private, and it even works offline, with Stockfish running in your browser.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/play" variant="primary" size="lg">
              <GraduationCap className="size-5" aria-hidden /> Play with Coach
            </ButtonLink>
            <ButtonLink href="/review" size="lg">
              <Search className="size-5" aria-hidden /> Review a game
            </ButtonLink>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
            <li className="flex items-center gap-1.5">
              <Lock className="size-4 text-accent" aria-hidden /> No account, no tracking
            </li>
            <li className="flex items-center gap-1.5">
              <WifiOff className="size-4 text-accent" aria-hidden /> Works offline
            </li>
            <li className="flex items-center gap-1.5">
              <Download className="size-4 text-accent" aria-hidden /> Installs like an app
            </li>
          </ul>
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

      <section aria-labelledby="private" className="mx-auto max-w-7xl px-4 pb-14">
        <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="private" className="font-serif text-2xl font-semibold">Your games stay yours</h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-2">
              Stockfish runs inside your browser, your games and progress are stored on your device, and there are no accounts or ads. Install Tempo from
              your browser menu to use it anywhere, even with no connection.
            </p>
          </div>
          <ButtonLink href="/about" variant="secondary" className="shrink-0">
            How it works
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
