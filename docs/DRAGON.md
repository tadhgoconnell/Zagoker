# The Zagoker dragon

An original low-poly dragon "rampant", drawn as an inline SVG of 142 flat
facets. Used on card backs (full colour) and printed faintly into the table
felt and the home-page table.

## Files

| File | Role |
| --- | --- |
| `scripts/dragon/draw-dragon.mjs` | The original drawing script. Do not tidy it: any change alters the artwork. `section(...)` markers record where each body part starts. |
| `scripts/dragon/build-dragon-art.mjs` | Groups the facets into the rig and writes `dragon-art.ts`. `--check` fails if the file is out of date. |
| `src/components/ui/dragon-art.ts` | Generated: `dragonRig` (grouped facets), `dragonParts` (pivots and attachments), `dragonPolygons` (the flat original list). |
| `src/components/ui/dragon-rig.ts` | Posing geometry: turns a pose into SVG transform matrices. |
| `src/components/ui/dragon.tsx` | The `<Dragon>` component. |
| `src/components/ui/dragon.test.tsx` | Proves the artwork is unchanged and the rig geometry is right. |

## Structure

Facets are grouped by body part **in their original painting order**: painting
the rig depth-first gives exactly the original sequence (a test checks a
fingerprint of all 142 colours and points). Each group renders as
`<g data-part="..." data-pivot="x y">`. Without a pose no group has a
transform, so the dragon renders exactly as drawn.

Painting order, back to front, with pivots in drawing coordinates
(box `20 0 172 220`):

| Part | Facets | Pivot | Hangs from |
| --- | --- | --- | --- |
| `wing` (membrane + bones) | 16 | shoulder root (103, 74) | torso |
| `tail` | 12 | tail base (126, 146) | torso |
| `tailTip` (nested in tail) | 5 | end of tail (176, 98) | tail |
| `farHindLeg` | 16 | hip (127, 133) | torso |
| `torso` (body, belly, plates) | 19 | body centre (108, 110) | — |
| `neck` (with back spines) | 11 | base of neck (91, 79) | torso |
| `nearHindLeg` | 17 | hip (110, 133) | torso |
| `lowerForeleg` | 9 | shoulder (92, 109) | torso |
| `upperForeleg` (raised) | 9 | shoulder (89, 87) | torso |
| `head` (horns, frill, skull, upper teeth, eye, brow, nostril) | 18 | top of neck (80, 44) | neck |
| `jaw` (nested in head; two pieces) | 9 | hinge (77, 55) | head |

The jaw appears twice inside the head because the upper teeth are painted
between its pieces (jaw, then upper teeth, then lower teeth and tongue).
Both copies share one pivot and always move together.

## Posing

```tsx
<Dragon pose={{ wing: { rotate: -25 }, jaw: { rotate: 18 }, torso: { y: -6 } }} />
```

A move is `{ rotate?, scale?, x?, y? }` (degrees clockwise, scale about the
pivot, shift in drawing units). Moving a part carries everything that hangs
from it: moving the torso moves the whole body; turning the head also turns
the jaw. Transforms are emitted as SVG `matrix(...)` attributes, which every
browser (including Safari on iPad) reads the same way; CSS transform-origin on
SVG elements is avoided on purpose.

`mirrored` flips the whole drawing with CSS; poses are given as if facing left.

## Joint seams

No filler shapes were added: unposed, none are needed. Parts overlap their
neighbours only slightly, so large rotations (a big wing flap, a fully tucked
leg) may open small gaps at the shoulder, hips and neck. If an animation
shows a gap, add a filler facet behind that joint in the drawing script, in a
colour matching the neighbouring facets, and rebuild.
