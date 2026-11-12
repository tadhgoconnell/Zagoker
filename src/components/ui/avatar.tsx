import {
  Cat,
  Club,
  Crown,
  Diamond,
  Flame,
  Gem,
  Ghost,
  Heart,
  Rocket,
  Spade,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AvatarKey } from "@/config/avatars";
import { cn } from "@/lib/utils";

const avatars: Record<AvatarKey, { icon: LucideIcon; bg: string }> = {
  spade: { icon: Spade, bg: "from-ink-500 to-ink-700" },
  heart: { icon: Heart, bg: "from-[#c8262c] to-[#5c1215]" },
  diamond: { icon: Diamond, bg: "from-[#2f7fd6] to-[#143a66]" },
  club: { icon: Club, bg: "from-felt-500 to-felt-800" },
  crown: { icon: Crown, bg: "from-gold-500 to-gold-700" },
  star: { icon: Star, bg: "from-[#8b5cf6] to-[#3b2380]" },
  flame: { icon: Flame, bg: "from-[#f97316] to-[#7c2d12]" },
  bolt: { icon: Zap, bg: "from-[#eab308] to-[#713f12]" },
  gem: { icon: Gem, bg: "from-[#14b8a6] to-[#134e4a]" },
  rocket: { icon: Rocket, bg: "from-[#ec4899] to-[#701a45]" },
  ghost: { icon: Ghost, bg: "from-[#64748b] to-[#1e293b]" },
  cat: { icon: Cat, bg: "from-[#a16207] to-[#422006]" },
};

const sizes = {
  sm: "size-8 [&>svg]:size-4",
  md: "size-11 [&>svg]:size-5",
  lg: "size-16 [&>svg]:size-7",
  xl: "size-24 [&>svg]:size-11",
};

export function Avatar({
  avatar,
  size = "md",
  className,
}: {
  avatar: AvatarKey;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const { icon: Icon, bg } = avatars[avatar];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-linear-to-b text-white ring-1 ring-white/20 shadow-card",
        bg,
        sizes[size],
        className,
      )}
    >
      <Icon strokeWidth={2.2} />
    </span>
  );
}
