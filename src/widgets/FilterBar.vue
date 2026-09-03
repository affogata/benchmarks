<script setup lang="ts">
/** Human-facing twin of `benchmarks_set_view` — both write to the same store. */
import { computed } from 'vue'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { SORT_KEYS, type SortKey } from '@/domain/benchmarks/selectors'

const benchmarks = useBenchmarksStore()
const view = useViewStore()

const SORT_LABELS: Record<SortKey, string> = {
  score: 'Impact score',
  delta: 'Change on latest point',
  momentum: 'Weekly momentum',
  volatility: 'Volatility',
  name: 'Name',
  category: 'Category',
}

const matched = defineProps<{ count: number }>()
const isFiltered = computed(
  () =>
    Boolean(view.filters.search) ||
    Boolean(view.filters.topic) ||
    Boolean(view.filters.categoryId) ||
    Boolean(view.filters.industryId) ||
    view.filters.minScore !== null,
)
</script>

<template>
  <div class="bar">
    <input
      class="field search"
      type="search"
      placeholder="Search titles, publishers, topics…"
      :value="view.filters.search"
      @input="view.patch({ search: ($event.target as HTMLInputElement).value })"
    />

    <select
      class="field"
      :value="view.filters.categoryId ?? ''"
      @change="view.patch({ categoryId: ($event.target as HTMLSelectElement).value || null, industryId: null })"
    >
      <option value="">All categories</option>
      <option v-for="category in benchmarks.categories" :key="category.id" :value="category.id">
        {{ category.emoji }} {{ category.name }}
      </option>
    </select>

    <select
      class="field"
      :value="view.filters.industryId ?? ''"
      @change="view.patch({ industryId: ($event.target as HTMLSelectElement).value || null, categoryId: null })"
    >
      <option value="">All industries</option>
      <option v-for="industry in benchmarks.industries" :key="industry.id" :value="industry.id">
        {{ industry.emoji }} {{ industry.name }}
      </option>
    </select>

    <select
      class="field"
      :value="view.filters.sort"
      @change="view.patch({ sort: ($event.target as HTMLSelectElement).value as SortKey })"
    >
      <option v-for="key in SORT_KEYS" :key="key" :value="key">Sort: {{ SORT_LABELS[key] }}</option>
    </select>

    <button
      class="field toggle"
      type="button"
      :title="view.filters.order === 'desc' ? 'Highest first' : 'Lowest first'"
      @click="view.patch({ order: view.filters.order === 'desc' ? 'asc' : 'desc' })"
    >
      {{ view.filters.order === 'desc' ? '↓ High first' : '↑ Low first' }}
    </button>

    <div class="modes">
      <button
        v-for="mode in (['grid', 'table'] as const)"
        :key="mode"
        type="button"
        class="mode"
        :class="{ active: view.filters.mode === mode }"
        @click="view.patch({ mode })"
      >
        {{ mode === 'grid' ? '▦' : '☰' }}
      </button>
    </div>

    <span class="count mono">{{ matched.count }} of {{ benchmarks.titles.length }}</span>

    <button v-if="view.filters.topic" class="chip" type="button" @click="view.patch({ topic: null })">
      topic: {{ view.filters.topic }} ×
    </button>
    <button v-if="isFiltered" class="chip reset" type="button" @click="view.reset()">Reset all</button>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
  padding: 14px 0 20px;
}
.field {
  background: var(--bg-soft);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  color: var(--ink-2);
  font-size: 13.5px;
  padding: 9px 12px;
  max-width: 100%;
}
.field:hover { border-color: var(--line-3); }
.search { flex: 1 1 240px; min-width: 180px; }
select.field { cursor: pointer; }
option { background: var(--bg-soft); }
.toggle { cursor: pointer; white-space: nowrap; font-family: var(--mono); font-size: 12px; }

.modes { display: flex; gap: 4px; }
.mode {
  border: 1px solid var(--line-2);
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  color: var(--ink-3);
  font-size: 13px;
}
.mode.active { border-color: var(--green); color: var(--green); background: var(--green-soft); }

.count { margin-left: auto; font-size: 11px; white-space: nowrap; }

.chip {
  font-family: var(--mono);
  font-size: 11px;
  border: 1px dashed rgba(95, 191, 127, 0.5);
  color: var(--green);
  border-radius: 999px;
  padding: 6px 12px;
}
.chip:hover { background: var(--green-soft); }
.chip.reset { border-color: var(--line-2); color: var(--ink-3); }
</style>
