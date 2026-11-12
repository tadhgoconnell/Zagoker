import Link from "next/link";
import { siteConfig, routes } from "@/config/site";
import { cn } from "@/lib/utils";

/** Gold spade emblem. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <defs>
        <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8e8b0" />
          <stop offset="0.5" stopColor="#e3bf55" />
          <stop offset="1" stopColor="#a8832a" />
        </linearGradient>
      </defs>
      <circle
        cx="16"
        cy="16"
        r="15"
        fill="#0e1424"
        stroke="url(#logo-gold)"
        strokeWidth="1.5"
      />
      <path
        fill="url(#logo-gold)"
        d="M16 6.5c-2.6 3.6-7.5 6.3-7.5 10.6 0 2.5 1.9 4.2 4.1 4.2 1.1 0 2-.4 2.7-1.1-.2 1.7-.9 3.2-2.3 4.3h6c-1.4-1.1-2.1-2.6-2.3-4.3.7.7 1.6 1.1 2.7 1.1 2.2 0 4.1-1.7 4.1-4.2 0-4.3-4.9-7-7.5-10.6Z"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href={routes.home}
      aria-label={`${siteConfig.name} home`}
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-[0.12em]">
        <span className="text-gold-gradient">{siteConfig.wordmark.lead}</span>
        <span className="text-cream">{siteConfig.wordmark.tail}</span>
      </span>
    </Link>
  );
}
