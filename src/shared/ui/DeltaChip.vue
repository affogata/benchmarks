<script setup lang="ts">
import { computed } from 'vue'
import { arrow, deltaTone, fmtDelta } from '@/shared/lib/format'

const props = defineProps<{ value: number; label?: string; size?: 'sm' | 'md' }>()

const tone = computed(() => deltaTone(props.value))
const text = computed(() => `${arrow(props.value)} ${fmtDelta(props.value)}`)
</script>

<template>
  <span class="chip" :class="[`tone-${tone}`, size === 'sm' ? 'sm' : '']">
    {{ text }}<span v-if="label" class="label">{{ label }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.chip.sm { font-size: 10.5px; }
.label { color: var(--ink-4); font-size: 0.92em; }
</style>
