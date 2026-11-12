import Link from "next/link";
import { Suspense } from "react";
import { HeaderAuth, HeaderAuthFallback } from "@/components/layout/header-auth";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { mainNav } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-ink-950/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-mist transition-colors hover:bg-white/5 hover:text-cream"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Suspense fallback={<HeaderAuthFallback />}>
          <HeaderAuth />
        </Suspense>
      </Container>
    </header>
  );
}
