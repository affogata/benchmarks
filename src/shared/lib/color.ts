/**
 * Per-title card grounds, lifted from the live benchmarks page.
 *
 * That page tints every card with the title's brand colour by holding the accent's hue and
 * saturation and pinning lightness to fixed steps. Doing it that way is what lets 79
 * different accents — mint, amber, violet, red — all land at the same contrast behind the
 * same white text, instead of each card needing a judgement call of its own.
 *
 * Values below are the ones measured off the published cards, not invented here.
 */

export interface AccentPalette {
  /** The card ground: three steps of the accent hue, dark enough to carry white text. */
  gradient: string
  /** The darkest step. Ink for the pale chips that sit on that ground. */
  ink: string
  /** A mid step. Secondary ink on those chips — labels, notes. */
  inkMid: string
  /** Near-white, holding a trace of the hue: the chips themselves. */
  paper: string
}

/** Lightness stops of the ground, in order, at 0% / 55% / 100% of a 168deg sweep. */
const GROUND_TOP = 13
const GROUND_MID = 21
const GROUND_FOOT = 28
const INK = 13
const INK_MID = 36
const PAPER = 95
/** Paper keeps a trace of the hue rather than the accent's full saturation. */
const PAPER_SATURATION = 0.35

const HEX = /^#?([0-9a-f]{6})$/i

/** Hue and saturation only — lightness is discarded, since every step overrides it. */
function toHueSaturation(accent: string): [number, number] | null {
  const match = HEX.exec(accent.trim())
  if (!match) return null

  const int = Number.parseInt(match[1]!, 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const span = max - min
  // A grey accent has no hue to hold on to; 0/0 gives a neutral ground rather than a
  // hue picked by whichever channel happened to round highest.
  if (!span) return [0, 0]

  const lightness = (max + min) / 2
  const saturation = span / (lightness > 0.5 ? 2 - max - min : max + min)
  const hue =
    max === r
      ? (g - b) / span + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / span + 2
        : (r - g) / span + 4

  return [hue * 60, saturation * 100]
}

const step = (hue: number, saturation: number, lightness: number): string =>
  `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness}%)`

/** `null` for an accent this cannot read — the caller then leaves the card on its flat ground. */
export function accentPalette(accent: string): AccentPalette | null {
  const parsed = toHueSaturation(accent)
  if (!parsed) return null
  const [hue, saturation] = parsed

  return {
    gradient: `linear-gradient(168deg, ${step(hue, saturation, GROUND_TOP)}, ${step(hue, saturation, GROUND_MID)} 55%, ${step(hue, saturation, GROUND_FOOT)})`,
    ink: step(hue, saturation, INK),
    inkMid: step(hue, saturation, INK_MID),
    paper: step(hue, saturation * PAPER_SATURATION, PAPER),
  }
}
