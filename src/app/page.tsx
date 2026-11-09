import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { Intro } from "@/components/landing/Intro";
import { Marquee } from "@/components/landing/Marquee";
import { Studio } from "@/components/landing/Studio";

export default function HomePage() {
  return (
    <>
      <Hero />
      <div className="land-dark">
        <Marquee />
      </div>
      <Intro />
      <Studio />
      <FinalCta />
    </>
  );
}
