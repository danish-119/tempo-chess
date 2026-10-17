import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { THRESHOLDS } from "@/lib/review/classify";

export const metadata: Metadata = {
  title: "About & licenses",
  description: "What Tempo is, what you can do with it, how game review works, and the open-source software it is built on.",
  alternates: { canonical: "/about" },
};

const THIRD_PARTY = [
  { name: "Stockfish 19", via: "Stockfish.js 19.0.1 (nmrugg/stockfish.js), lite WASM builds", license: "GPL-3.0", url: "https://github.com/official-stockfish/Stockfish", source: "https://github.com/nmrugg/stockfish.js" },
  { name: "Lichess SFX sounds (Enigmahack)", via: "Move, capture, check and result sounds", license: "AGPL-3.0+", url: "https://github.com/lichess-org/lila/tree/master/public/sound/sfx" },
  { name: "Lichess puzzle database", via: "10,000 practice puzzles", license: "CC0-1.0", url: "https://database.lichess.org/#puzzles" },
  { name: "Piece sets (Lichess collection)", via: "Cburnett, Merida, MPChess (GPL) · Chessnut (Apache-2.0) · Fantasy, Spatial, Celtic (MIT) · Rhosgfx (CC0) · Pixel (AGPL)", license: "various", url: "https://github.com/lichess-org/lila/blob/master/COPYING.md" },
  { name: "Bot avatars", via: "DiceBear Notionists (by Zoish)", license: "CC0-1.0", url: "https://www.dicebear.com/licenses/" },
  { name: "chess.js 1.4", via: "Move generation, validation and PGN parsing", license: "BSD-2-Clause", url: "https://github.com/jhlywa/chess.js" },
  { name: "react-chessboard 5", via: "Board component and default piece set", license: "MIT", url: "https://github.com/Clariity/react-chessboard" },
  { name: "lichess-org/chess-openings", via: "Opening names and ECO codes", license: "CC0-1.0", url: "https://github.com/lichess-org/chess-openings" },
  { name: "Lichess tablebase & opening explorer", via: "Online services queried at runtime (not bundled): 7-piece endgame results and opening statistics", license: "service", url: "https://lichess.org/api" },
];

const FEATURES: { title: string; href: string; text: string }[] = [
  { title: "Play", href: "/play", text: "Ten bots from beginner (≈400) to full-strength Stockfish, a coach who shows threats and grades your moves, or a friend on the same device." },
  { title: "Review & analyze", href: "/review", text: "Import a game from Chess.com, Lichess or PGN and it opens on the analysis board: every move classified, accuracy, key moments and an evaluation graph, plus live Stockfish lines, an exact 7-piece endgame tablebase and an opening explorer." },
  { title: "Practice", href: "/practice", text: "10,000 puzzles by level and theme, Puzzle Rush, 18 key endgames against perfect defence, and a coordinate trainer." },
  { title: "Learn", href: "/learn", text: "22 openings to watch and practise, 27 tactics and mating patterns with real examples, and a 116-term glossary." },
  { title: "Editor", href: "/editor", text: "Set up any position, then analyze it, play it out against a bot, or share it as a link or image." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 leading-relaxed">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">About Tempo</h1>
        <p className="mt-2 text-ink-2">
          Tempo is a free, open-source place to play, review, practise and learn chess. The Stockfish engine runs inside your browser, so there is no
          server, no account and no subscription — every feature is free and unlimited, and your games never leave your device.
        </p>
        <p className="mt-3 text-ink-2">
          Built by{" "}
          <a href={SITE.author.url} className="font-medium text-ink underline" rel="noopener noreferrer" target="_blank">
            {SITE.author.name}
          </a>
          {SITE.repoUrl ? (
            <>
              {" "}
              · <a href={SITE.repoUrl} className="underline" rel="noopener noreferrer" target="_blank">source on GitHub</a>
            </>
          ) : null}
        </p>
      </header>

      <section aria-labelledby="features-h" className="space-y-3">
        <h2 id="features-h" className="font-serif text-2xl font-semibold">What you can do</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f.href}>
              <Link href={f.href} className="block h-full rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent hover:bg-accent-soft">
                <span className="font-semibold">{f.title}</span>
                <span className="mt-1 block text-sm text-ink-2">{f.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-h" className="space-y-2">
        <h2 id="how-h" className="font-serif text-2xl font-semibold">How it works</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-2">
          <li>
            <strong>Engine in your browser.</strong> Stockfish 19 (WebAssembly) uses several CPU cores when your browser allows it, and works offline once
            loaded.
          </li>
          <li>
            <strong>No backend, no database.</strong> Tempo is a static website. Games, reviews and settings are stored only in your browser.
          </li>
          <li>
            <strong>Public data only.</strong> Game imports use the public Chess.com and Lichess APIs; endgame results and opening statistics come from
            Lichess&apos;s free services.
          </li>
          <li>
            <strong>No AI guesswork.</strong> Explanations come from fixed rules checked against the engine&apos;s lines.
          </li>
        </ul>
      </section>

      <section id="method" aria-labelledby="method-h" className="scroll-mt-20 space-y-3">
        <h2 id="method-h" className="font-serif text-2xl font-semibold">How a review works</h2>
        <ol className="list-decimal space-y-2 pl-5 text-ink-2">
          <li>Every position of the game is analysed by Stockfish with the same settings (preset depth and a per-position time cap), with two engine lines.</li>
          <li>
            Each evaluation is converted to White&apos;s point of view and then to a <em>win probability</em> using the logistic curve published by Lichess:
            <code className="mx-1 rounded bg-surface-2 px-1 text-sm">Win% = 50 + 50 × (2 / (1 + e^(−0.00368208 × cp)) − 1)</code>. Forced mates count as 100% / 0%.
          </li>
          <li>
            For each move, Tempo compares the mover&apos;s win% after the engine&apos;s best move with the win% after the move played. The difference is the
            <em> win% lost</em>:
            <ul className="mt-2 list-disc pl-5">
              <li>Engine&apos;s top move → <strong>Best</strong> (or <strong>Great</strong> — the only good move — if the second-best line is ≥{THRESHOLDS.onlyMoveGap} points worse and the position wasn&apos;t already lost)</li>
              <li>&lt; {THRESHOLDS.excellent} → Excellent · &lt; {THRESHOLDS.good} → Good · &lt; {THRESHOLDS.inaccuracy} → Inaccuracy · &lt; {THRESHOLDS.mistake} → Mistake · otherwise Blunder</li>
              <li>
                <strong>Miss</strong>: failing to capitalise — either a winning position (≥{THRESHOLDS.missedWinBefore}%) falls to ≤{THRESHOLDS.missedWinAfter}%, or the opponent just made a mistake/blunder and the move gives the advantage straight back.
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
            is legal and actually wins that material or delivers that mate; otherwise Tempo uses neutral wording such as &ldquo;the engine prefers…&rdquo;.
          </li>
        </ol>
        <p className="text-sm text-ink-3">
          Limitations: these are approximations. They depend on search depth, so other tools may grade the same move differently. Very fast reviews (Quick preset) may misjudge sharp positions. The lite engine is
          somewhat weaker than full Stockfish but far stronger than any human.
        </p>
      </section>

      <section aria-labelledby="privacy-h" className="space-y-2">
        <h2 id="privacy-h" className="font-serif text-2xl font-semibold">Privacy in one paragraph</h2>
        <p className="text-ink-2">
          No accounts, no cookies, no analytics. Games, reviews and settings are kept in your browser (IndexedDB / localStorage). Besides loading the
          site, your browser only contacts <code>api.chess.com</code> or <code>lichess.org</code> when you import games, the Lichess tablebase for
          positions with 7 pieces or fewer, and the Lichess opening explorer if you choose to connect a Lichess account. Share links keep the game in the
          link itself, so nothing is uploaded. Details: <Link href="/privacy" className="underline">privacy policy</Link>.
        </p>
      </section>

      <section id="licenses" aria-labelledby="lic-h" className="space-y-3">
        <h2 id="lic-h" className="font-serif text-2xl font-semibold">Open-source licenses</h2>
        <p className="text-ink-2">
          Tempo itself is licensed under the <strong>GNU General Public License v3.0 or later</strong>. It bundles the Stockfish chess engine, which is
          GPL-3.0; the full license text is served at <a className="underline" href="/engine/COPYING.txt">/engine/COPYING.txt</a>.
        </p>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface text-sm">
          {THIRD_PARTY.map((t) => (
            <li key={t.name} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
              <span>
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">{t.name}</a>
                <span className="block text-xs text-ink-3">{t.via}</span>
              </span>
              <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-xs">{t.license}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="source" aria-labelledby="src-h" className="scroll-mt-20 space-y-2">
        <h2 id="src-h" className="font-serif text-2xl font-semibold">Source code</h2>
        <p className="text-ink-2">
          {SITE.repoUrl ? (
            <>The complete corresponding source code of this site is available at <a href={SITE.repoUrl} className="underline" rel="noopener noreferrer">{SITE.repoUrl}</a>.</>
          ) : (
            <>The source code of this deployment is available from its operator on request, under the terms of the GPL-3.0.</>
          )}{" "}
          The Stockfish engine binaries are unmodified builds from Stockfish.js 19.0.1; their source is at{" "}
          <a href="https://github.com/nmrugg/stockfish.js" className="underline" rel="noopener noreferrer">github.com/nmrugg/stockfish.js</a> and{" "}
          <a href="https://github.com/official-stockfish/Stockfish" className="underline" rel="noopener noreferrer">github.com/official-stockfish/Stockfish</a>.
        </p>
      </section>

      {SITE.contactEmail ? (
        <section id="contact" aria-labelledby="contact-h" className="scroll-mt-20 space-y-2">
          <h2 id="contact-h" className="font-serif text-2xl font-semibold">Contact</h2>
          <p className="text-ink-2">Questions, bugs or ideas — get in touch:</p>
          <ul className="space-y-1 text-ink-2">
            <li>
              Email: <a href={`mailto:${SITE.contactEmail}`} className="underline">{SITE.contactEmail}</a>
            </li>
            {SITE.whatsapp ? (
              <li>
                WhatsApp:{" "}
                <a href={`https://wa.me/${SITE.whatsapp}`} className="underline" rel="noopener noreferrer" target="_blank">
                  +{SITE.whatsapp.slice(0, 2)} {SITE.whatsapp.slice(2, 5)} {SITE.whatsapp.slice(5)}
                </a>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
