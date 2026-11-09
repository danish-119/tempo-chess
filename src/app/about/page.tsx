import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChartLine, Code2, Cpu, Globe, Lock, Mail, MessageCircle, Puzzle, ShieldCheck, Swords, Trophy, Wand2 } from "lucide-react";
import { SITE } from "@/lib/site";
import { THRESHOLDS } from "@/lib/review/classify";

export const metadata: Metadata = {
  title: "About & licenses",
  description: "What Tempo is, what you can do with it, how game review works, and the open-source software it is built on.",
  alternates: { canonical: "/about" },
};

const THIRD_PARTY = [
  { name: "Stockfish 19", via: "Stockfish.js 19.0.1 (nmrugg/stockfish.js), lite WASM builds", license: "GPL-3.0", url: "https://github.com/official-stockfish/Stockfish" },
  { name: "Lichess SFX sounds (Enigmahack)", via: "Move, capture, check and result sounds", license: "AGPL-3.0+", url: "https://github.com/lichess-org/lila/tree/master/public/sound/sfx" },
  { name: "Lichess puzzle database", via: "10,000 practice puzzles", license: "CC0-1.0", url: "https://database.lichess.org/#puzzles" },
  { name: "Piece sets (Lichess collection)", via: "Cburnett, Merida, MPChess (GPL) · Chessnut (Apache-2.0) · Fantasy, Spatial, Celtic (MIT) · Rhosgfx (CC0) · Pixel (AGPL)", license: "various", url: "https://github.com/lichess-org/lila/blob/master/COPYING.md" },
  { name: "Bot avatars", via: "DiceBear Notionists (by Zoish)", license: "CC0-1.0", url: "https://www.dicebear.com/licenses/" },
  { name: "Guest pictures", via: "DiceBear Avataaars (Pablo Stanley, free for personal and commercial use), Open Peeps (Pablo Stanley) and Thumbs", license: "CC0-1.0 / free use", url: "https://www.dicebear.com/licenses/" },
  { name: "chess.js 1.4", via: "Move generation, validation and PGN parsing (in the app and on the game server)", license: "BSD-2-Clause", url: "https://github.com/jhlywa/chess.js" },
  { name: "react-chessboard 5", via: "Board component and default piece set", license: "MIT", url: "https://github.com/Clariity/react-chessboard" },
  { name: "Better Auth", via: "Accounts, sign-in and sessions", license: "MIT", url: "https://github.com/better-auth/better-auth" },
  { name: "lichess-org/chess-openings", via: "Opening names and ECO codes", license: "CC0-1.0", url: "https://github.com/lichess-org/chess-openings" },
  { name: "Lichess endgame tablebase", via: "Online service queried at runtime (not bundled): exact results with 7 pieces or fewer", license: "service", url: "https://lichess.org/api" },
];

const STATS = [
  ["10,000", "puzzles"],
  ["37", "beginner lessons"],
  ["22", "openings"],
  ["18", "endgames"],
  ["116", "glossary terms"],
] as const;

const FEATURES = [
  { title: "Play", href: "/play", Icon: Swords, text: "Play friends and other players online, ten bots from ≈400 to full Stockfish, a coach who grades your moves, or start from any position." },
  { title: "Review", href: "/review", Icon: ChartLine, text: "Import from Chess.com, Lichess or PGN: every move graded, accuracy, key moments, live engine lines and an exact endgame tablebase." },
  { title: "Practice", href: "/practice", Icon: Puzzle, text: "Puzzles by level and theme, Puzzle Rush, endgames against perfect defence, coordinates and blindfold chess." },
  { title: "Learn", href: "/learn", Icon: BookOpen, text: "A course for complete beginners with a talking coach, openings explained move by move, tactics to practise, and a glossary." },
  { title: "Progress", href: "/progress", Icon: Trophy, text: "Your streak, a puzzle rating, a daily puzzle, an activity calendar and the endgames you have mastered." },
] as const;

const HOW = [
  { Icon: Cpu, title: "The engine runs on your device", text: "Stockfish 19 (WebAssembly) analyses in your browser, uses several cores when it can, and keeps working offline." },
  { Icon: Lock, title: "Your work is kept", text: "Start right away: your games, progress and settings are saved as a guest. Sign in with Google to keep them for good, on every device." },
  { Icon: Globe, title: "Online games are refereed", text: "The Tempo server checks every move and runs the clocks, so nobody can cheat the rules or the time." },
  { Icon: Wand2, title: "No AI guesswork", text: "Explanations come from fixed rules checked against the engine's lines, never from a language model." },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-14 px-4 py-10 leading-relaxed sm:py-14">
      <header className="space-y-5">
        <p className="eyebrow">About</p>
        <h1 className="display max-w-3xl text-5xl sm:text-6xl">A free chess site that plays, reviews and teaches.</h1>
        <p className="max-w-2xl text-lg text-ink-2">
          Tempo is open source and free, with no subscription and no ads. Play anyone, review your games move by move, and learn from the very first
          move to tactics and openings.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/play" className="pill pill-solid">
            Play now
          </Link>
          {SITE.repoUrl ? (
            <a href={SITE.repoUrl} className="pill" rel="noopener noreferrer" target="_blank">
              <Code2 className="size-4" aria-hidden /> Source on GitHub
            </a>
          ) : null}
          <span className="text-sm text-ink-3">
            Built by{" "}
            <a href={SITE.author.url} className="font-medium text-ink underline" rel="noopener noreferrer" target="_blank">
              {SITE.author.name}
            </a>
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-5">
          {STATS.map(([n, label]) => (
            <div key={label} className="rounded-2xl border border-border bg-surface p-4">
              <dt className="sr-only">{label}</dt>
              <dd className="font-serif text-3xl text-ink">{n}</dd>
              <dd className="text-xs text-ink-3">{label}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section aria-labelledby="features-h" className="space-y-4">
        <h2 id="features-h" className="display text-3xl">What you can do</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, href, Icon, text }) => (
            <li key={href}>
              <Link href={href} className="group flex h-full gap-3 rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-accent">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="font-semibold group-hover:text-accent">{title}</span>
                  <span className="mt-1 block text-sm text-ink-2">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-h" className="space-y-4">
        <h2 id="how-h" className="display text-3xl">How it works</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {HOW.map(({ Icon, title, text }) => (
            <li key={title} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-ink-2">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section id="method" aria-labelledby="method-h" className="scroll-mt-20">
        <details className="group rounded-2xl border border-border bg-surface p-5 open:shadow-[var(--shadow)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span>
              <span id="method-h" className="display block text-2xl">How a game review works</span>
              <span className="text-sm text-ink-3">The exact formulas behind move grades and accuracy.</span>
            </span>
            <span className="text-sm font-medium text-accent group-open:hidden">Show</span>
            <span className="hidden text-sm font-medium text-accent group-open:inline">Hide</span>
          </summary>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-ink-2">
            <li>Every position of the game is analysed by Stockfish with the same settings (preset depth and a per-position time cap), with two engine lines.</li>
            <li>
              Each evaluation is converted to White&apos;s point of view and then to a <em>win probability</em> using the logistic curve published by Lichess:
              <code className="mx-1 rounded bg-surface-2 px-1 text-sm">Win% = 50 + 50 × (2 / (1 + e^(−0.00368208 × cp)) − 1)</code>. Forced mates count as 100% / 0%.
            </li>
            <li>
              For each move, Tempo compares the mover&apos;s win% after the engine&apos;s best move with the win% after the move played. The difference is the
              <em> win% lost</em>:
              <ul className="mt-2 list-disc pl-5">
                <li>Engine&apos;s top move → <strong>Best</strong> (or <strong>Great</strong>, the only good move, if the second-best line is ≥{THRESHOLDS.onlyMoveGap} points worse and the position wasn&apos;t already lost)</li>
                <li>&lt; {THRESHOLDS.excellent} → Excellent · &lt; {THRESHOLDS.good} → Good · &lt; {THRESHOLDS.inaccuracy} → Inaccuracy · &lt; {THRESHOLDS.mistake} → Mistake · otherwise Blunder</li>
                <li>
                  <strong>Miss</strong>: failing to capitalise: either a winning position (≥{THRESHOLDS.missedWinBefore}%) falls to ≤{THRESHOLDS.missedWinAfter}%, or the opponent just made a mistake or blunder and the move gives the advantage straight back.
                </li>
                <li>
                  <strong>Brilliant</strong>: a verified sacrifice of at least two points that loses under {THRESHOLDS.brilliantMaxLoss}% win probability, keeps the mover at ≥{THRESHOLDS.brilliantMinAfter}% and was played when the best alternative was below {THRESHOLDS.brilliantMaxAlternative}%.
                </li>
                <li><strong>Forced</strong>: the only legal move. <strong>Book</strong>: every position up to that move is in the opening database.</li>
              </ul>
            </li>
            <li>
              <strong>Accuracy</strong>: each move scores <code className="rounded bg-surface-2 px-1 text-sm">103.1668 × e^(−0.04354 × win% lost) − 3.1669</code> (from
              Lichess&apos;s public description), clamped to 0–100. A player&apos;s game accuracy is the average of the arithmetic and harmonic means of
              their move scores (forced moves excluded).
            </li>
            <li>
              <strong>Explanations</strong> are generated by rules, not AI. A tactic (fork, pin, hanging piece, mate) is named only if the engine&apos;s line
              is legal and actually wins that material or delivers that mate; otherwise the coach sticks to plain wording, without claiming a reason it cannot
              prove. Descriptions of good moves are read straight from the board with the chess rules, never guessed.
            </li>
          </ol>
          <p className="mt-3 text-sm text-ink-3">
            These are approximations that depend on search depth, so other tools may grade the same move differently. Quick reviews may misjudge sharp
            positions. The lite engine is somewhat weaker than full Stockfish but far stronger than any human.
          </p>
        </details>
      </section>

      <section aria-labelledby="privacy-h" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 id="privacy-h" className="font-semibold">Privacy, briefly</h2>
            <p className="mt-1 text-sm text-ink-2">
              No analytics and no ads; the only cookie keeps your session. Your games, progress and settings are saved to your account, or as a guest on this browser until you sign in with Google.
              Engine analysis stays on your device.
            </p>
          </div>
        </div>
        <Link href="/privacy" className="pill shrink-0">
          Privacy policy
        </Link>
      </section>

      <section id="licenses" aria-labelledby="lic-h" className="scroll-mt-20 space-y-4">
        <div>
          <h2 id="lic-h" className="display text-3xl">Open-source licenses</h2>
          <p className="mt-2 text-ink-2">
            Tempo is licensed under the <strong>GNU General Public License v3.0 or later</strong>. It ships the Stockfish engine, which is GPL-3.0; the full
            licence text is at <a className="underline" href="/engine/COPYING.txt">/engine/COPYING.txt</a>.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {THIRD_PARTY.map((t) => (
            <li key={t.name} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-sm">
              <span className="min-w-0">
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                  {t.name}
                </a>
                <span className="block text-xs text-ink-3">{t.via}</span>
              </span>
              <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 font-mono text-xs">{t.license}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <section id="source" aria-labelledby="src-h" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
          <h2 id="src-h" className="flex items-center gap-2 font-semibold">
            <Code2 className="size-5 text-accent" aria-hidden /> Source code
          </h2>
          <p className="mt-2 text-sm text-ink-2">
            {SITE.repoUrl ? (
              <>
                The complete source of this site and its server is at{" "}
                <a href={SITE.repoUrl} className="underline" rel="noopener noreferrer">
                  {SITE.repoUrl.replace(/^https?:\/\//, "")}
                </a>
                .
              </>
            ) : (
              <>The source code of this deployment is available from its operator on request, under the terms of the GPL-3.0.</>
            )}{" "}
            The Stockfish binaries are unmodified builds from Stockfish.js 19.0.1 (
            <a href="https://github.com/nmrugg/stockfish.js" className="underline" rel="noopener noreferrer">
              source
            </a>
            ).
          </p>
        </section>
        {SITE.contactEmail ? (
          <section id="contact" aria-labelledby="contact-h" className="scroll-mt-20 rounded-2xl border border-border bg-surface p-5">
            <h2 id="contact-h" className="flex items-center gap-2 font-semibold">
              <MessageCircle className="size-5 text-accent" aria-hidden /> Contact
            </h2>
            <p className="mt-2 text-sm text-ink-2">Questions, bugs or ideas are always welcome.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`mailto:${SITE.contactEmail}`} className="pill !h-9 text-sm">
                <Mail className="size-4" aria-hidden /> Email
              </a>
              {SITE.whatsapp ? (
                <a href={`https://wa.me/${SITE.whatsapp}`} className="pill !h-9 text-sm" rel="noopener noreferrer" target="_blank">
                  <MessageCircle className="size-4" aria-hidden /> WhatsApp
                </a>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
