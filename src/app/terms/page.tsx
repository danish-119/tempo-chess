import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 px-4 py-10 leading-relaxed text-ink-2 sm:py-14 [&_li]:marker:text-accent [&_strong]:text-ink">
      <header className="space-y-4 pb-2">
        <p className="eyebrow">Legal</p>
        <h1 className="display text-5xl text-ink sm:text-6xl">Terms of use</h1>
        <p className="text-sm text-ink-3">Plain terms for a free, open-source chess site.</p>
      </header>
      <ol className="list-decimal space-y-4 pl-6 text-[17px]">
        <li>Tempo is free software provided under the GNU GPL v3.0 or later, <strong>without any warranty</strong>, to the extent permitted by law.</li>
        <li>Engine evaluations, move classifications, accuracy scores and explanations are automated approximations and may be wrong.</li>
        <li>
          When you import games by username, you use Chess.com&apos;s or Lichess&apos;s public API and must respect their terms. Only public data is accessed; Tempo never asks for Chess.com passwords.
        </li>
        <li>Do not use Tempo to obtain engine assistance during games you are playing. That is cheating under the rules of every major chess site.</li>
        <li>You are responsible for the content you import and save.</li>
        <li>
          <strong>Accounts.</strong> You need to be at least 13 to create an account. You sign in with your Google account; keep it secure, as you are
          responsible for what is done with your Tempo account. One account per person.
        </li>
        <li>
          <strong>Names and fair play.</strong> Choose a name or guest nickname that does not impersonate anyone and is not offensive. In online games, play
          fairly: no engine help, no deliberately losing or abandoning games, and no abuse of other players. We may rename, suspend
          or close accounts that break these rules.
        </li>
        <li>
          <strong>Your data.</strong> What you save belongs to you. We keep it to run Tempo for you, as described in the privacy policy, and delete it
          when you delete your account. Tempo is provided as it is; keep your own copy of anything important (for example by exporting your progress).
        </li>
        <li>These terms may change; we will note important changes on this page before they take effect.</li>
      </ol>
    </article>
  );
}
