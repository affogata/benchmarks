<script setup lang="ts">
/** Hand-rolled SVG trend line — no chart dependency, scales to any card width. */
import { computed } from 'vue'
import type { HistoryPoint } from '@/domain/benchmarks/models'

const props = withDefaults(
  defineProps<{ points: HistoryPoint[]; width?: number; height?: number; stroke?: string }>(),
  { width: 220, height: 46, stroke: 'var(--green)' },
)

const geometry = computed(() => {
  const scores = props.points.map((point) => point.score)
  if (scores.length < 2) return null

  const pad = 4
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const stepX = (props.width - pad * 2) / (scores.length - 1)

  const coords = scores.map((score, index) => ({
    x: pad + index * stepX,
    y: pad + (1 - (score - min) / range) * (props.height - pad * 2),
  }))

  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1]!.x.toFixed(1)},${props.height} L${coords[0]!.x.toFixed(1)},${props.height} Z`

  return { coords, line, area, last: coords[coords.length - 1]! }
})
</script>

<template>
  <svg
    v-if="geometry"
    class="spark"
    :viewBox="`0 0 ${props.width} ${props.height}`"
    :width="props.width"
    :height="props.height"
    preserveAspectRatio="none"
    role="img"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="`fade-${props.points.map((p) => p.label).join('')}`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" :stop-color="props.stroke" stop-opacity="0.28" />
        <stop offset="100%" :stop-color="props.stroke" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path :d="geometry.area" :fill="`url(#fade-${props.points.map((p) => p.label).join('')})`" />
    <path :d="geometry.line" fill="none" :stroke="props.stroke" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle :cx="geometry.last.x" :cy="geometry.last.y" r="3.2" :fill="props.stroke" />
  </svg>
</template>

<style scoped>
.spark { display: block; width: 100%; height: auto; overflow: visible; }
</style>
