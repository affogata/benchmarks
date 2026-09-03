<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Title } from '@/domain/benchmarks/models'

const props = withDefaults(defineProps<{ title: Title; size?: number }>(), { size: 44 })
const broken = ref(false)
/**
 * The initial is a placeholder for artwork that has not arrived, not a backdrop for it.
 * Every `contain` icon is a transparent PNG, so leaving the letter underneath painted it
 * through the logo — the plate should show the accent colour there, nothing else.
 */
const loaded = ref(false)

// The component is reused across titles as lists re-render, so both flags have to follow
// the src: a stale `loaded` would suppress the letter of a title whose icon never arrives.
watch(
  () => props.title.icon,
  () => {
    broken.value = false
    loaded.value = false
  },
)
</script>

<template>
  <div
    class="icon"
    :style="{
      width: `${props.size}px`,
      height: `${props.size}px`,
      background: props.title.accent,
      fontSize: `${Math.round(props.size * 0.42)}px`,
    }"
    aria-hidden="true"
  >
    <span v-if="!loaded">{{ props.title.name.charAt(0) }}</span>
    <img
      v-if="props.title.icon && !broken"
      :src="props.title.icon"
      alt=""
      loading="lazy"
      :style="{ objectFit: props.title.iconFit ?? 'cover', padding: props.title.iconFit === 'contain' ? '3px' : '0' }"
      @load="loaded = true"
      @error="broken = true"
    />
  </div>
</template>

<style scoped>
.icon {
  position: relative;
  flex: none;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-weight: 700;
  color: #0a0f14;
}
img { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
