<script setup lang="ts">
defineProps<{ label: string; tone: 'up' | 'down'; clickable?: boolean }>()
</script>

<template>
  <component :is="clickable ? 'button' : 'span'" class="tag" :class="tone" :type="clickable ? 'button' : undefined">
    {{ label }}
  </component>
</template>

<style scoped>
.tag {
  display: inline-block;
  font-size: 12.5px;
  line-height: 1.35;
  border-radius: 6px;
  padding: 4px 9px;
  border: 1px solid transparent;
  text-align: left;
}
.up { background: rgba(95, 191, 127, 0.1); color: #8fd9a6; border-color: rgba(95, 191, 127, 0.25); }
.down { background: rgba(246, 82, 114, 0.08); color: #f49cad; border-color: rgba(246, 82, 114, 0.22); }
button.tag { cursor: pointer; }
button.tag:hover { filter: brightness(1.25); }
</style>
