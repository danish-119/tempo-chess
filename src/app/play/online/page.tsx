import type { Metadata } from "next";
import { RedirectToPlay } from "./RedirectToPlay";

// Online play now lives on the Play page. This address only forwards old invite links.
export const metadata: Metadata = {
  title: "Play a friend online",
  robots: { index: false },
  alternates: { canonical: "/play" },
};

export default function OnlineRedirectPage() {
  return <RedirectToPlay />;
}
