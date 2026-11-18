import type { AvatarKey } from "@/config/avatars";
import { seeded, shadeHex } from "@/lib/lowpoly";
import { cn } from "@/lib/utils";

/**
 * Avatars are generated low-poly gems: each preset has its own colour and
 * its own facet pattern, drawn the same way everywhere.
 */
const looks: Record<AvatarKey, { color: string; seed: number }> = {
  spade: { color: "#5ded51", seed: 11 },
  heart: { color: "#ef5a57", seed: 23 },
  diamond: { color: "#4f8ef7", seed: 37 },
  club: { color: "#2fb57a", seed: 41 },
  crown: { color: "#f2c94c", seed: 53 },
  star: { color: "#9b6bf2", seed: 67 },
  flame: { color: "#f2853a", seed: 71 },
  bolt: { color: "#e8e15a", seed: 83 },
  gem: { color: "#3cc9c4", seed: 97 },
  rocket: { color: "#ec5fa8", seed: 101 },
  ghost: { color: "#c9cfcb", seed: 113 },
  cat: { color: "#b38a5e", seed: 127 },
};

const N = 7;

function gem(key: AvatarKey) {
  const { color, seed } = looks[key];
  const rnd = seeded(seed);
  const turn = rnd() * Math.PI * 2;
  const ring = (radius: number, offset: number, jitter: number) =>
    Array.from({ length: N }, (_, i) => {
      const a = turn + ((i + offset) / N) * Math.PI * 2 + (rnd() - 0.5) * jitter;
      const r = radius * (1 - rnd() * 0.12);
      return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as const;
    });
  const outer = ring(58, 0, 0.35); // reaches past the circle; clipped
  const inner = ring(30, 0.5, 0.5);
  const centre = [50 + (rnd() - 0.5) * 10, 50 + (rnd() - 0.5) * 10] as const;
  const tris: (readonly (readonly [number, number])[])[] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    tris.push([outer[i], inner[i], outer[j]], [inner[i], outer[j], inner[j]], [centre, inner[i], inner[j]]);
  }
  return tris.map((t) => {
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    // Light from the upper left.
    const light = ((50 - cx) * 0.7 + (50 - cy)) / 70;
    return {
      points: t.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
      fill: shadeHex(color, Math.max(-0.55, Math.min(0.45, light * 0.5 + (rnd() - 0.5) * 0.25))),
    };
  });
}

const cache = new Map<AvatarKey, ReturnType<typeof gem>>();

const sizes = {
  sm: "size-8",
  md: "size-11",
  lg: "size-16",
  xl: "size-24",
};

export function Avatar({
  avatar,
  photo,
  size = "md",
  className,
}: {
  avatar: AvatarKey;
  /** URL of the player's own photo. When set it is shown instead of the gem. */
  photo?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  if (photo) {
    return (
      // Small, already-resized images from Supabase Storage: next/image would add nothing.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("inline-block shrink-0 rounded-full bg-ink-700 object-cover ring-1 ring-black/40", sizes[size], className)}
      />
    );
  }
  if (!cache.has(avatar)) cache.set(avatar, gem(avatar));
  const facets = cache.get(avatar)!;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-black/40", sizes[size], className)}
    >
      <svg viewBox="0 0 100 100" className="size-full">
        <rect width="100" height="100" fill={shadeHex(looks[avatar].color, -0.3)} />
        {facets.map((f, i) => (
          <polygon key={i} points={f.points} fill={f.fill} stroke={f.fill} strokeWidth={0.5} strokeLinejoin="round" />
        ))}
      </svg>
    </span>
  );
}
