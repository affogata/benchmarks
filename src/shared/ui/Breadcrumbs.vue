<script setup lang="ts">
/**
 * One breadcrumb trail for every page.
 *
 * Callers hand over the trail as data, so a crumb that has nowhere to point (an industry
 * with no page of its own, a title still loading) is simply left out of the array rather
 * than rendered as dead text with a stray separator next to it. Every crumb but the last
 * is a real RouterLink; the last one is the current page, so it stays plain text and
 * carries aria-current instead.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Crumb } from './breadcrumbs'

const props = defineProps<{ items: Crumb[] }>()

/** Drop blank labels so a missing lookup never leaves an empty crumb behind. */
const crumbs = computed(() => props.items.filter((item) => Boolean(item.label?.trim())))

const isLast = (index: number): boolean => index === crumbs.value.length - 1
</script>

<template>
  <nav v-if="crumbs.length" class="crumbs" aria-label="Breadcrumb">
    <ol>
      <li v-for="(crumb, index) in crumbs" :key="`${crumb.label}-${index}`">
        <span v-if="index > 0" class="sep" aria-hidden="true">›</span>
        <RouterLink v-if="crumb.to && !isLast(index)" :to="crumb.to">{{ crumb.label }}</RouterLink>
        <span
          v-else
          :class="{ current: isLast(index) }"
          :aria-current="isLast(index) ? 'page' : undefined"
          >{{ crumb.label }}</span
        >
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.crumbs {
  font-size: 13px;
  color: var(--ink-4);
  margin-bottom: 14px;
}

ol {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
}

a {
  color: var(--ink-4);
  text-decoration: none;
}
a:hover,
a:focus-visible {
  color: var(--green);
  text-decoration: underline;
}

.sep { color: #3a4756; }
.current { color: var(--green-deep); font-weight: 600; }
</style>
