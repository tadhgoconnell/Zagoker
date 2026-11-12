import { Features } from "@/components/landing/features";
import { FreePlay } from "@/components/landing/free-play";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <FreePlay />
    </>
  );
}
