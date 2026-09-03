<script setup lang="ts">
/** Hand-rolled SVG trend line — no chart dependency, scales to any card width. */
import { computed, useId } from 'vue'
import type { HistoryPoint } from '@/domain/benchmarks/models'

const props = withDefaults(
  defineProps<{ points: HistoryPoint[]; width?: number; height?: number; stroke?: string }>(),
  { width: 220, height: 46, stroke: 'var(--green)' },
)

const STROKE_WIDTH = 2
const DOT_RADIUS = 3.2
/**
 * Inset for every drawn coordinate.
 *
 * Sized from the ink rather than picked by eye: the end dot reaches `DOT_RADIUS` past its
 * centre and a round line cap reaches half a stroke past its endpoint, so this is the
 * smallest padding that keeps the whole drawing inside the viewBox at any scale.
 */
const PAD = DOT_RADIUS + STROKE_WIDTH / 2 + 0.5

/**
 * The area gradient is referenced by id, and ids are document-global.
 *
 * Deriving one from the history labels produced `fade-Wk 31Wk 32Wk 33`: duplicated across
 * every card showing the same weeks, and — because the labels contain spaces — not a valid
 * fragment. `url(#fade-Wk 31...)` cannot be parsed, so the browser falls back to the
 * initial `fill` and paints the area solid black. A per-instance `useId()` is unique and
 * always a legal identifier.
 */
const gradientId = `fade-${useId()}`

const geometry = computed(() => {
  const scores = props.points.map((point) => point.score)
  if (scores.length < 2) return null

  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const stepX = (props.width - PAD * 2) / (scores.length - 1)

  const coords = scores.map((score, index) => ({
    x: PAD + index * stepX,
    y: PAD + (1 - (score - min) / range) * (props.height - PAD * 2),
  }))

  const line = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ')

  // The fill closes on the same baseline the lowest point sits on, not on the bottom of the
  // box. Running it to the full height gave the area a hard edge flush with the edge of the
  // svg, which reads as the chart breaking out of the card around it.
  const floor = (props.height - PAD).toFixed(1)
  const first = coords[0]!
  const last = coords[coords.length - 1]!
  const area = `${line} L${last.x.toFixed(1)},${floor} L${first.x.toFixed(1)},${floor} Z`

  return { coords, line, area, last }
})
</script>

<template>
  <svg
    v-if="geometry"
    class="spark"
    :viewBox="`0 0 ${props.width} ${props.height}`"
    :width="props.width"
    :height="props.height"
    role="img"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="props.stroke" stop-opacity="0.28" />
        <stop offset="100%" :stop-color="props.stroke" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="geometry.area" :fill="`url(#${gradientId})`" />
    <path
      :d="geometry.line"
      fill="none"
      :stroke="props.stroke"
      :stroke-width="STROKE_WIDTH"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle :cx="geometry.last.x" :cy="geometry.last.y" :r="DOT_RADIUS" :fill="props.stroke" />
  </svg>
</template>

<style scoped>
/*
 * `height: auto` against `width: 100%` keeps the used size at the viewBox aspect ratio, so
 * the drawing scales uniformly and needs no `preserveAspectRatio` override. Overflow is
 * left at the UA default (hidden) as a backstop: `PAD` already keeps the ink inside, and
 * anything that escapes should be clipped rather than painted over a card border.
 */
.spark { display: block; width: 100%; height: auto; }
</style>
