import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { THRESHOLDS } from "@/lib/review/classify";

export const metadata: Metadata = {
  title: "About & licenses",
  description: "How Tempo works, how moves are classified, and the open-source software it is built on.",
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
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8 leading-relaxed">
      <header>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">About Tempo</h1>
        <p className="mt-2 text-ink-2">
          Tempo is a free, open-source chess analysis tool. It runs the Stockfish engine inside your browser, so reviewing a game costs nothing and your
          games are never uploaded anywhere.
        </p>
        <p className="mt-2 text-ink-2">
          Made by{" "}
          <a href={SITE.author.url} className="underline" rel="noopener noreferrer" target="_blank">
            {SITE.author.name}
          </a>
          .
        </p>
      </header>

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
          No accounts, no cookies, no analytics. Games, reviews and settings are kept in your browser (IndexedDB / localStorage). The
          only network requests besides loading the site are to <code>api.chess.com</code> when you look up a username. Details: <Link href="/privacy" className="underline">privacy policy</Link>.
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
          <p className="text-ink-2">
            Questions, bugs or ideas: <a href={`mailto:${SITE.contactEmail}`} className="underline">{SITE.contactEmail}</a>
          </p>
        </section>
      ) : null}
    </div>
  );
}
