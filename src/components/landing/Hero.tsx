import { Download, Lock, WifiOff } from "lucide-react";
import Link from "next/link";
import { HeroBoard } from "./HeroBoard";

/** The first screen: the promise in three words, and a real game being reviewed in front of you. */
export function Hero() {
  return (
    <section className="land-dark relative isolate overflow-hidden lg:h-[calc(100svh-3.5rem)] lg:min-h-[520px]">
      <div className="land-checker absolute inset-0 -z-10" aria-hidden />
      <div className="land-wrap grid items-center gap-14 pt-14 pb-20 sm:pt-20 lg:h-full lg:grid-cols-[1.02fr_1fr] lg:gap-10 lg:py-6">
        <div>
          <h1 className="display text-[clamp(3.4rem,min(10.5vw,13.5svh),8.75rem)]">
            Play.{" "}
            <br />
            Review.{" "}
            <br />
            <em className="font-medium italic text-accent">Improve.</em>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl [@media(max-height:760px)]:mt-5 [@media(max-height:760px)]:text-base lg:[@media(max-height:760px)]:text-base">
            Tempo plays you, explains every move you make, and trains the mistakes you actually make. Stockfish runs inside your browser, so your games never
            leave your device.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 [@media(max-height:760px)]:mt-6">
            <Link href="/play" className="pill pill-solid">
              Play now
            </Link>
            <Link href="/review" className="pill">
              Review a game
            </Link>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 font-mono text-xs uppercase tracking-[0.12em] text-ink-3 [@media(max-height:700px)]:hidden lg:[@media(max-height:700px)]:hidden">
            <li className="flex items-center gap-2">
              <Lock className="size-4 text-accent" aria-hidden /> No account
            </li>
            <li className="flex items-center gap-2">
              <WifiOff className="size-4 text-accent" aria-hidden /> Works offline
            </li>
            <li className="flex items-center gap-2">
              <Download className="size-4 text-accent" aria-hidden /> Installs like an app
            </li>
          </ul>
        </div>
        <HeroBoard />
      </div>
    </section>
  );
}
