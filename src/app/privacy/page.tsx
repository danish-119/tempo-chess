import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 px-4 py-8 leading-relaxed text-ink-2">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Privacy policy</h1>
      <p className="text-sm text-ink-3">
        Template reflecting how this software works. Operators of a deployment should review it, add their contact details and adjust for their hosting.
      </p>

      <h2 className="font-serif text-xl font-semibold text-ink">Summary</h2>
      <p>Tempo has no user accounts of its own, sets no cookies, and contains no analytics, advertising or tracking code.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Data that stays on your device</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Games you import and their reviews — in your browser&apos;s IndexedDB.</li>
        <li>Settings, including an optional Chess.com username — in your browser&apos;s localStorage.</li>
        <li>An unfinished Play game, Puzzle Rush best scores, and (if you connect Lichess) your Lichess access token — in localStorage.</li>
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
