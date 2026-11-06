import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 px-4 py-10 leading-relaxed text-ink-2 sm:py-14 [&_a]:text-accent [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h2]:!mt-10 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-6 [&_li]:marker:text-accent [&_strong]:text-ink">
      <header className="space-y-4 pb-2">
        <p className="eyebrow">Legal</p>
        <h1 className="display text-5xl text-ink sm:text-6xl">Privacy policy</h1>
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-ink-2">
          Short version: no accounts, no cookies, no analytics. Your games, reviews and progress stay in your browser.
        </p>
      </header>

      <h2 className="font-serif text-xl font-semibold text-ink">Summary</h2>
      <p>Tempo has no user accounts of its own, sets no cookies, and contains no analytics, advertising or tracking code.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Data that stays on your device</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Games you import and their reviews — in your browser&apos;s IndexedDB.</li>
        <li>Settings, including an optional Chess.com username — in your browser&apos;s localStorage.</li>
        <li>An unfinished Play game, Puzzle Rush best scores, and (if you connect Lichess) your Lichess access token — in localStorage.</li>
        <li>Your progress — streak, puzzle-rating estimate, daily puzzle results and mistake bank — in your browser&apos;s IndexedDB. You can export it as a file from the Progress page.</li>
        <li>The offline copy of the site (pages, engine, puzzles) saved by the service worker so Tempo works without a connection.</li>
        <li>All engine analysis — computed by Stockfish running inside your browser.</li>
      </ul>
      <p>You can delete all of it at any time from Settings → Data, or by clearing this site&apos;s data in your browser.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Data that leaves your device</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-ink">Chess.com lookups.</strong> When you search for a username, your browser requests that player&apos;s public profile and
          game archives directly from <code>api.chess.com</code>. Chess.com receives your IP address and the username searched, under{" "}
          <a href="https://www.chess.com/legal/privacy" className="underline" rel="noopener noreferrer">Chess.com&apos;s privacy policy</a>. Responses are cached
          locally.
        </li>
        <li>
          <strong className="text-ink">Lichess lookups.</strong> When you search a Lichess username or paste a Lichess game link, your browser requests that
          public data directly from <code>lichess.org</code>, under{" "}
          <a href="https://lichess.org/privacy" className="underline" rel="noopener noreferrer">Lichess&apos;s privacy policy</a>.
        </li>
        <li>
          <strong className="text-ink">Endgame tablebase.</strong> When the analysis board shows a position with 7 pieces or fewer, the position (FEN) is
          sent to the Lichess tablebase at <code>tablebase.lichess.ovh</code>.
        </li>
        <li>
          <strong className="text-ink">Connect Lichess (optional).</strong> The opening explorer needs a Lichess account. If you choose to connect, you log in
          on lichess.org itself; Tempo never sees your password. Lichess returns an access token with no permissions beyond identifying you, which your browser
          stores and sends with explorer requests (the current position) to <code>explorer.lichess.org</code>. Disconnect in Settings revokes the token.
        </li>
        <li>
          <strong className="text-ink">Playing a friend online (optional).</strong> Moves go directly between the two browsers (WebRTC); there is no Tempo
          game server. The invite link and reply code that you exchange contain your connection details, so only share them with the person you want to play.
          To let players on different networks find each other, the browsers ask public STUN servers (Google and Cloudflare) for their public IP address, as
          any video call does; you can turn this off to play only on the same Wi-Fi. Your opponent can see your IP address through the connection itself.
        </li>
        <li>
          <strong className="text-ink">Spoken coach.</strong> The coach is read aloud with your browser&apos;s built-in speech synthesis. Depending on your
          browser and operating system, some voices run online; Tempo itself sends nothing.
        </li>
        <li>
          <strong className="text-ink">Hosting.</strong> Loading the site sends standard request data (IP address, user agent, requested URL) to the hosting
          provider{SITE.url.includes("vercel") ? " (Vercel)" : ""}, which may keep server logs under its own policy.
        </li>
      </ul>
      <p>PGN files you upload or paste are processed in your browser and are not uploaded.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Children</h2>
      <p>Tempo does not knowingly collect personal data from anyone, including children.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Contact</h2>
      <p>{SITE.contactEmail ? <a className="underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : "Contact the operator of this deployment."}</p>
    </article>
  );
}
