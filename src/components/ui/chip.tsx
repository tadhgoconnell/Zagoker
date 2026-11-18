import { cn } from "@/lib/utils";

/** Flat poker chip used next to chip amounts: accent face, dark edge notches. */
export function Chip({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5 shrink-0", className)}>
      <circle cx="12" cy="12" r="11" fill="#5ded51" />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <rect key={deg} x="10.5" y="1" width="3" height="4" fill="#0f1211" transform={`rotate(${deg} 12 12)`} />
      ))}
      <circle cx="12" cy="12" r="6.2" fill="#0f1211" />
      <polygon points="12,8.2 15.4,12 12,15.8 8.6,12" fill="#5ded51" />
    </svg>
  );
}
