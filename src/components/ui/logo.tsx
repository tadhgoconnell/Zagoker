import Link from "next/link";
import { routes, siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Faceted diamond mark: four flat facets in the accent colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <polygon points="16,2 16,16 4,16" fill="#9cf493" />
      <polygon points="16,2 28,16 16,16" fill="#5ded51" />
      <polygon points="4,16 16,16 16,30" fill="#47d43c" />
      <polygon points="16,16 28,16 16,30" fill="#23731d" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href={routes.home}
      aria-label={`${siteConfig.name} home`}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <LogoMark />
      <span className="font-display text-lg font-extrabold tracking-tight uppercase">
        <span className="text-accent-400">{siteConfig.wordmark.lead}</span>
        <span className="text-cream">{siteConfig.wordmark.tail}</span>
      </span>
    </Link>
  );
}
