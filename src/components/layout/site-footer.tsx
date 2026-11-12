import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { mainNav, routes, siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/6 bg-ink-950">
      <Container className="flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-slate">
            {siteConfig.name} is a free entertainment platform. Chips are
            virtual, have no monetary value, and cannot be bought, sold,
            withdrawn or exchanged for anything.
          </p>
        </div>

        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-mist"
        >
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-cream">
              {item.label}
            </Link>
          ))}
          <Link href={routes.login} className="hover:text-cream">
            Log in
          </Link>
          <Link href={routes.register} className="hover:text-cream">
            Sign up
          </Link>
        </nav>
      </Container>
      <div className="hairline-gold opacity-40" />
      <Container className="py-5 text-xs text-slate">
        Play-money poker for fun. No real-money gambling.
      </Container>
    </footer>
  );
}
