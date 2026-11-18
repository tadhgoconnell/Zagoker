import { cn, formatChipsCompact } from "@/lib/utils";

/** Fixed colours per denomination, so a 100 chip always looks like a 100 chip. */
const colours: Record<number, { face: string; text: string }> = {
  1: { face: "#e6e9e7", text: "#0f1211" },
  5: { face: "#ef5a57", text: "#0f1211" },
  10: { face: "#4f8ef7", text: "#0f1211" },
  25: { face: "#5ded51", text: "#0f1211" },
  50: { face: "#f2853a", text: "#0f1211" },
  100: { face: "#262c29", text: "#eef1ef" },
  250: { face: "#9b6bf2", text: "#0f1211" },
  500: { face: "#f2c94c", text: "#0f1211" },
  1000: { face: "#3cc9c4", text: "#0f1211" },
  2500: { face: "#ec5fa8", text: "#0f1211" },
  5000: { face: "#b38a5e", text: "#0f1211" },
};
const fallback = { face: "#c9cfcb", text: "#0f1211" };

/** A flat poker chip showing its value. */
export function ChipFace({ value, className }: { value: number; className?: string }) {
  const { face, text } = colours[value] ?? fallback;
  const label = formatChipsCompact(value);
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("shrink-0", className)}>
      <circle cx="20" cy="20" r="19" fill={face} stroke="#0a0c0b" strokeWidth="1" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect key={deg} x="18" y="1.5" width="4" height="6" fill="#f6f7f5" opacity="0.85" transform={`rotate(${deg} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="12" fill={face} stroke="#0a0c0b" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 2" />
      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        fill={text}
        fontSize={label.length > 3 ? 8 : 10}
        fontWeight="700"
        fontFamily="var(--font-geist-sans), sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}
