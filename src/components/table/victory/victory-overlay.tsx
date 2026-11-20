"use client";

/**
 * The victory flight: the dragon crosses the table breathing out coins, notes
 * and cards. Shown only to the winner, on their own screen.
 *
 * Rendered once, then driven imperatively in a requestAnimationFrame loop:
 * no React re-render per frame. Each frame sets one CSS transform on the
 * dragon's wrapper, an SVG matrix on each body part, and transform/opacity
 * on the particles. With reduced motion the dragon just appears briefly at
 * rest instead.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Dragon } from "@/components/ui/dragon";
import type { DragonPartId } from "@/components/ui/dragon-art";
import { partMatrix, transformAttribute } from "@/components/ui/dragon-rig";
import { ParticleArt, PARTICLE_SIZE } from "./particles";
import {
  VICTORY_MS,
  dragonSize,
  flightAt,
  mouthAt,
  particleAt,
  particleSpecs,
} from "./timeline";

type Props = {
  /** Different for every victory (the hand number); also seeds the burst. */
  seed: number;
  onDone: () => void;
};

export function VictoryOverlay({ seed, onDone }: Props) {
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  return reduced ? <StillCelebration onDone={onDone} /> : <Flight seed={seed} onDone={onDone} />;
}

/** The overlay box: the table plus a small margin, clipped, never clickable. */
const boxClass =
  "pointer-events-none absolute -inset-x-[min(12%,2.25rem)] -inset-y-[min(8%,2rem)] z-20 overflow-hidden";

function StillCelebration({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div aria-hidden="true" className={boxClass} data-victory="still">
      <Dragon className="absolute top-[40%] left-1/2 h-[45%] -translate-x-1/2 -translate-y-1/2 animate-fade-up" />
    </div>
  );
}

function Flight({ seed, onDone }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const dragonRef = useRef<HTMLDivElement>(null);
  const particleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const specs = useMemo(() => particleSpecs(seed), [seed]);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const box = boxRef.current;
    const wrapper = dragonRef.current;
    if (!box || !wrapper) return;

    // Measured once: the flight is short and the table rarely resizes mid-way.
    const W = box.clientWidth;
    const H = box.clientHeight;
    const size = dragonSize(W, H);
    wrapper.style.width = `${size.w}px`;
    wrapper.style.height = `${size.h}px`;

    // Each body-part group, with the part of the group it sits inside (that
    // group already applies its own transform). The jaw appears twice.
    const groups = Array.from(wrapper.querySelectorAll<SVGGElement>("g[data-part]")).map((g) => ({
      g,
      part: g.dataset.part as DragonPartId,
      parent: (g.parentElement?.closest<SVGGElement>("g[data-part]")?.dataset.part ?? null) as DragonPartId | null,
    }));

    // Particle sizes and the mouth position at each one's birth.
    const parts = specs.map((spec, i) => {
      const el = particleRefs.current[i];
      const [pw, ph] = PARTICLE_SIZE[spec.kind];
      if (el) {
        el.style.width = `${pw * size.h}px`;
        el.style.height = `${ph * size.h}px`;
        el.style.fontSize = `${pw * size.h}px`;
      }
      return { el, spec, w: pw * size.h, h: ph * size.h, origin: mouthAt(spec.born, W, H) };
    });

    let start: number | null = null;
    let raf = 0;
    const frame = (now: number) => {
      start ??= now;
      const t = now - start;
      const f = flightAt(t, W, H);
      wrapper.style.transform = `translate3d(${f.x - size.w / 2}px, ${f.y - size.h / 2}px, 0) rotate(${f.rotate}deg)`;
      for (const { g, part, parent } of groups) {
        const value = transformAttribute(partMatrix(part, f.pose, parent));
        if (value) g.setAttribute("transform", value);
        else g.removeAttribute("transform");
      }
      for (const p of parts) {
        if (!p.el) continue;
        const s = particleAt(p.spec, p.origin, t, size.h);
        if (!s) {
          p.el.style.opacity = "0";
          continue;
        }
        p.el.style.opacity = `${s.opacity}`;
        p.el.style.transform = `translate3d(${s.x - p.w / 2}px, ${s.y - p.h / 2}px, 0) rotate(${s.angle}deg) scale(${s.scale})`;
      }
      if (t >= VICTORY_MS) {
        done.current();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [specs]);

  return (
    <div ref={boxRef} aria-hidden="true" className={boxClass} data-victory="flight">
      {specs.map((spec, i) => (
        <div
          key={i}
          ref={(el) => {
            particleRefs.current[i] = el;
          }}
          className="absolute top-0 left-0 opacity-0 will-change-transform"
          data-particle={spec.kind}
        >
          <ParticleArt kind={spec.kind} index={i} />
        </div>
      ))}
      <div ref={dragonRef} className="absolute top-0 left-0 opacity-100 will-change-transform" style={{ transform: "translate3d(-200vw,0,0)" }}>
        <Dragon className="size-full" />
      </div>
    </div>
  );
}
