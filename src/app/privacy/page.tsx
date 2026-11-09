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
          Short version: Tempo keeps your games, reviews, progress and settings on its server. Signed in with Google, they are yours for good and follow
          you to every device; without signing in, they are kept as a guest on that browser while you keep coming back. We use one sign-in cookie, no
          analytics and no advertising, and we never sell your data.
        </p>
      </header>

      <h2 className="font-serif text-xl font-semibold text-ink">Your account</h2>
      <p>You sign in with Google. When you do, we store:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your Google account ID, name, email address and profile picture, as Google shares them with us. We never see or store a password.</li>
        <li>Your Tempo ID (a short code we assign, such as #4K7F2QD) and your display name, which you can change.</li>
        <li>Your sessions: when you signed in, and the IP address and browser of each session, so we can keep your account secure.</li>
        <li>
          What you save while signed in: imported games and their reviews, your progress (streak, puzzle-rating estimate and daily puzzle results),
          Basics lesson progress, Puzzle Rush best scores, an unfinished Play game, and your settings.
        </li>
      </ul>
      <p>
        This is stored on Cloudflare&apos;s platform (Cloudflare Workers and D1), which runs the Tempo service. We use it only to run Tempo for you, and we do
        not share it with anyone else, except where the law requires it.
      </p>

      <h2 className="font-serif text-xl font-semibold text-ink">Online games</h2>
      <p>
        Online games are run by the Tempo server, which checks every move and keeps the clocks. For each game we store the two players, the time
        control, the moves, the result and when it was played, so it can appear in both players&apos; history. Your name, picture and Tempo ID are
        shown to your opponent and to anyone watching. Anyone with a game&apos;s code or link can watch it, live or afterwards.
      </p>

      <h2 className="font-serif text-xl font-semibold text-ink">Emails</h2>
      <p>Tempo does not send you emails: no newsletters, no marketing, and no account emails (Google handles signing in).</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Cookies</h2>
      <p>
        Tempo sets one kind of cookie: the session cookie that keeps you signed in (or keeps your guest progress), plus a short-lived signed copy of it so
        pages load quickly. It is set only once you save something or sign in. These cookies are strictly necessary for saving to work, so no consent
        banner is needed. There are no analytics, advertising or tracking cookies.
      </p>

      <h2 className="font-serif text-xl font-semibold text-ink">Without an account</h2>
      <p>
        You can use Tempo without an account. Just looking around stores nothing. The first time you save something (a finished lesson, a setting, a
        game), we create a guest for this browser: a session cookie, a Tempo ID, and the same records as above, with a nickname and a picture if you
        choose them, but no Google details. If you do not come back for 30 days, or you clear this browser&apos;s cookies, the guest is lost, and it is
        deleted with everything saved in it. Signing in with Google moves it into your account. Tempo never writes your data to your browser&apos;s
        storage; the service worker keeps an offline copy of the site itself (pages, engine and puzzles), which contains no personal data.
      </p>

      <h2 className="font-serif text-xl font-semibold text-ink">Engine analysis</h2>
      <p>The Stockfish engine runs inside your browser. Positions you analyse are not sent to Tempo for analysis.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Other services your browser contacts</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong className="text-ink">Chess.com lookups.</strong> When you search for a username, your browser requests that player&apos;s public profile and
          game archives directly from <code>api.chess.com</code>. Chess.com receives your IP address and the username searched, under{" "}
          <a href="https://www.chess.com/legal/privacy" className="underline" rel="noopener noreferrer">Chess.com&apos;s privacy policy</a>.
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
          <strong className="text-ink">Google sign-in (optional).</strong> If you choose it, you sign in on Google&apos;s own page under{" "}
          <a href="https://policies.google.com/privacy" className="underline" rel="noopener noreferrer">Google&apos;s privacy policy</a>.
        </li>
        <li>
          <strong className="text-ink">Spoken coach.</strong> The coach is read aloud with your browser&apos;s built-in speech synthesis. Depending on your
          browser and operating system, some voices run online; Tempo itself sends nothing.
        </li>
        <li>
          <strong className="text-ink">Hosting.</strong> Loading the site and using the API sends standard request data (IP address, browser, requested
          address) to the hosting providers{SITE.url.includes("vercel") ? " (Vercel and Cloudflare)" : " (Cloudflare)"}, which may keep short-lived logs under
          their own policies.
        </li>
      </ul>

      <h2 className="font-serif text-xl font-semibold text-ink">Your choices</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Delete your whole account from <a href="/account" className="underline">Your account</a>. This removes your account and everything saved in it
          straight away; it cannot be undone. Online games you made are deleted with it; in games someone else made, your seat is cleared, but the
          move record keeps the name you played under. Ask us if you want it removed.
        </li>
        <li>Ask us for a copy of your data, or to correct it, using the contact below.</li>
      </ul>

      <h2 className="font-serif text-xl font-semibold text-ink">Children</h2>
      <p>You need to be at least 13 years old to create an account or to save progress as a guest. Anyone can look around and use the tools without saving.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Changes</h2>
      <p>If this policy changes in a way that matters, we will say so on this page before the change takes effect.</p>

      <h2 className="font-serif text-xl font-semibold text-ink">Contact</h2>
      <p>{SITE.contactEmail ? <a className="underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : "Contact the operator of this deployment."}</p>
    </article>
  );
}
