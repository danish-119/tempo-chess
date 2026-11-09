import type { Metadata } from "next";
import { ProgressView } from "./ProgressView";

export const metadata: Metadata = {
  title: "Progress",
  description: "Your practice streak, puzzle rating estimate, daily puzzle and the endgames you have mastered, saved to your account.",
  alternates: { canonical: "/progress" },
};

export default function ProgressPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-4">
      <ProgressView />
    </div>
  );
}
