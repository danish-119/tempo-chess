import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of use",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-5 px-4 py-8 leading-relaxed text-ink-2">
      <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">Terms of use</h1>
      <p className="text-sm text-ink-3">Template — operators of a deployment should review and adapt it.</p>
      <ol className="list-decimal space-y-3 pl-5">
        <li>Tempo is free software provided under the GNU GPL v3.0 or later, <strong>without any warranty</strong>, to the extent permitted by law.</li>
        <li>Engine evaluations, move classifications, accuracy scores and explanations are automated approximations and may be wrong.</li>
        <li>
          When you import games by username, you use Chess.com&apos;s or Lichess&apos;s public API and must respect their terms. Only public data is accessed; Tempo never asks for Chess.com passwords.
        </li>
        <li>Do not use Tempo to obtain engine assistance during games you are playing. That is cheating under the rules of every major chess site.</li>
        <li>You are responsible for the content you import. Data is stored only in your browser.</li>
      </ol>
    </article>
  );
}
