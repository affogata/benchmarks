<script setup lang="ts">
/**
 * The score across the tracked window — a real chart, not a decorative squiggle.
 *
 * The line on its own could not be read: it auto-scaled to the three points it was given,
 * so a 0.1 wobble drew the same dramatic climb as a five-point jump, and nothing on screen
 * said which. What it needed was the frame a reader checks a line against — a labelled
 * y-axis, the period each point belongs to, and a marker on every point rather than a lone
 * dot at the end. The category average goes in as a dashed line because "is this good?" is
 * the question the number is actually being asked.
 */
import { computed, useId } from 'vue'
import type { HistoryPoint } from '@/domain/benchmarks/models'
import { fmtScore } from '@/shared/lib/format'

const props = withDefaults(
  defineProps<{
    points: HistoryPoint[]
    width?: number
    height?: number
    stroke?: string
    /**
     * Colour of the area wash under the line. Defaults to the stroke, which disappears
     * into a near-black card; on a card tinted with a brand colour the same wash reads as
     * a coloured block, so those callers pass a neutral instead.
     */
    fill?: string
    /** Ink for axis rules and labels. Callers on a tinted ground pass a light value. */
    axisColor?: string
    /** Dashed context line — the category average. Drawn only when it lands in view. */
    reference?: { value: number; label: string } | null
    /** Period labels along the bottom. Off where the caller already lists them below. */
    showLabels?: boolean
    /**
     * Fixed y-window, already padded. Charts meant to be read against each other pass a
     * shared one; without it each chart scales to its own points, which is honest per card
     * but makes a flat run and a steep climb draw the same shape side by side.
     */
    domain?: [number, number] | null
  }>(),
  {
    width: 220,
    height: 64,
    stroke: 'var(--green)',
    fill: undefined,
    axisColor: 'rgba(157, 174, 192, 0.9)',
    reference: null,
    showLabels: false,
    domain: null,
  },
)

const STROKE_WIDTH = 2
const DOT_RADIUS = 2.4
const LAST_DOT_RADIUS = 3.4
/** Room for the y-axis numbers, and for the period labels when they are shown. */
const GUTTER_LEFT = 26
const GUTTER_TOP = 6
/** The end dot and a round line cap both overhang their point; keep them inside the box. */
const GUTTER_RIGHT = LAST_DOT_RADIUS + STROKE_WIDTH / 2 + 0.5

const fillColor = computed(() => props.fill ?? props.stroke)

/**
 * The id is document-global, so it is per-instance: deriving one from the history labels
 * repeated it on every card showing the same weeks, and — labels contain spaces — produced
 * a reference the browser could not parse, painting the area solid black.
 */
const gradientId = `fade-${useId()}`

const geometry = computed(() => {
  const scores = props.points.map((point) => point.score)
  if (scores.length < 2) return null

  const low = Math.min(...scores)
  const high = Math.max(...scores)

  /*
   * The window is padded rather than clamped to the data, so a flat run reads as flat
   * instead of being stretched to fill the box. It is not the full 0-10 either: three
   * points inside a tenth of the scale would draw a line no one could tell from noise.
   * Whatever it lands on is printed on the axis, so the reader can see the scale they are
   * being shown.
   */
  const reference = props.reference
  const pad = Math.max(0.4, (high - low) * 0.35)
  const min = props.domain
    ? props.domain[0]
    : Math.max(0, Math.floor((Math.min(low, reference?.value ?? low) - pad) * 10) / 10)
  const max = props.domain
    ? props.domain[1]
    : Math.min(10, Math.ceil((Math.max(high, reference?.value ?? high) + pad) * 10) / 10)
  const span = max - min || 1

  const plotLeft = GUTTER_LEFT
  const plotRight = props.width - GUTTER_RIGHT
  const plotTop = GUTTER_TOP
  const plotBottom = props.height - (props.showLabels ? 14 : 4)
  const plotHeight = plotBottom - plotTop
  const stepX = (plotRight - plotLeft) / (scores.length - 1)
  const y = (score: number): number => plotTop + (1 - (score - min) / span) * plotHeight

  const coords = props.points.map((point, index) => ({
    x: plotLeft + index * stepX,
    y: y(point.score),
    label: point.label,
    score: point.score,
  }))

  const line = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')

  const first = coords[0]!
  const last = coords[coords.length - 1]!
  const area = `${line} L${last.x.toFixed(1)},${plotBottom.toFixed(1)} L${first.x.toFixed(1)},${plotBottom.toFixed(1)} Z`

  return {
    coords,
    line,
    area,
    last,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    min,
    max,
    // Off-window references are dropped rather than pinned to an edge, which would put the
    // line somewhere it is not.
    referenceY: reference && reference.value >= min && reference.value <= max ? y(reference.value) : null,
    // The label goes on whichever side of the dashed line the series is not: a title above
    // its category average is drawn in the space above it, so the caption sits below.
    referenceBelow: reference ? last.score >= reference.value : false,
  }
})

/** Screen readers get the series as text; the drawing itself carries no extra meaning. */
const summary = computed(() =>
  props.points.map((point) => `${point.label} ${fmtScore(point.score)}`).join(', '),
)
</script>

<template>
  <svg
    v-if="geometry"
    class="chart"
    :viewBox="`0 0 ${props.width} ${props.height}`"
    :width="props.width"
    :height="props.height"
    role="img"
    :aria-label="`Impact score by ${props.showLabels ? 'period' : 'tracked point'}: ${summary}`"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="fillColor" stop-opacity="0.28" />
        <stop offset="100%" :stop-color="fillColor" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- Axis: the top and bottom of the window, printed so the slope can be judged. -->
    <g :stroke="props.axisColor" stroke-opacity="0.28">
      <line :x1="geometry.plotLeft" :y1="geometry.plotTop" :x2="geometry.plotRight" :y2="geometry.plotTop" />
      <line :x1="geometry.plotLeft" :y1="geometry.plotBottom" :x2="geometry.plotRight" :y2="geometry.plotBottom" />
    </g>
    <g class="tick" :fill="props.axisColor" text-anchor="end">
      <text :x="geometry.plotLeft - 5" :y="geometry.plotTop + 3">{{ fmtScore(geometry.max) }}</text>
      <text :x="geometry.plotLeft - 5" :y="geometry.plotBottom + 3">{{ fmtScore(geometry.min) }}</text>
    </g>

    <g v-if="geometry.referenceY !== null && props.reference">
      <line
        :x1="geometry.plotLeft"
        :y1="geometry.referenceY"
        :x2="geometry.plotRight"
        :y2="geometry.referenceY"
        :stroke="props.axisColor"
        stroke-opacity="0.55"
        stroke-dasharray="3 3"
      />
      <text
        class="tick"
        :x="geometry.plotRight"
        :y="geometry.referenceY + (geometry.referenceBelow ? 9 : -4)"
        :fill="props.axisColor"
        text-anchor="end"
      >
        {{ props.reference.label }} {{ fmtScore(props.reference.value) }}
      </text>
    </g>

    <path :d="geometry.area" :fill="`url(#${gradientId})`" />
    <path
      :d="geometry.line"
      fill="none"
      :stroke="props.stroke"
      :stroke-width="STROKE_WIDTH"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle
      v-for="point in geometry.coords"
      :key="point.label"
      :cx="point.x"
      :cy="point.y"
      :r="point === geometry.last ? LAST_DOT_RADIUS : DOT_RADIUS"
      :fill="props.stroke"
    />

    <g v-if="props.showLabels" class="tick" :fill="props.axisColor">
      <text
        v-for="(point, index) in geometry.coords"
        :key="point.label"
        :x="point.x"
        :y="props.height - 3"
        :text-anchor="index === 0 ? 'start' : index === geometry.coords.length - 1 ? 'end' : 'middle'"
      >
        {{ point.label }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
/*
 * `height: auto` against `width: 100%` keeps the used size at the viewBox aspect ratio, so
 * the drawing scales uniformly and needs no `preserveAspectRatio` override. Overflow is
 * left at the UA default (hidden) as a backstop: the gutters already keep the ink inside,
 * and anything that escapes should be clipped rather than painted over a card border.
 */
.chart { display: block; width: 100%; height: auto; }
.tick { font-family: var(--mono); font-size: 8.5px; letter-spacing: 0.02em; }
</style>
