<script setup lang="ts">
defineProps<{ value: string; label: string; note?: string; tone?: 'up' | 'down' | 'flat' }>()
</script>

<template>
  <div class="tile">
    <b :class="tone ? `tone-${tone}` : ''">{{ value }}</b>
    <span class="mono">{{ label }}</span>
    <i v-if="note">{{ note }}</i>
  </div>
</template>

<style scoped>
.tile {
  background: var(--bg-raised);
  border: 1px solid var(--line-3);
  border-radius: 10px;
  padding: 12px 14px;
}
b { display: block; font-family: var(--display); font-size: 24px; font-weight: 700; color: var(--ink); line-height: 1.1; }
span { display: block; margin-top: 4px; font-size: 9.5px; }
i { display: block; font-style: normal; font-size: 11.5px; color: var(--green-deep); margin-top: 3px; }
</style>
