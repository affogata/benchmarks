<script setup lang="ts">
import { computed } from 'vue'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { queryTitles } from '@/domain/benchmarks/selectors'
import FilterBar from '@/widgets/FilterBar.vue'
import TitleCard from '@/widgets/TitleCard.vue'
import TitleTable from '@/widgets/TitleTable.vue'

const benchmarks = useBenchmarksStore()
const view = useViewStore()

const rows = computed(() => {
  const filters = view.filters
  return queryTitles(benchmarks.require(), {
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.industryId ? { industryId: filters.industryId } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.topic ? { topic: filters.topic } : {}),
    ...(filters.minScore !== null ? { minScore: filters.minScore } : {}),
    sort: filters.sort,
    order: filters.order,
  })
})
</script>

<template>
  <div class="wrap">
    <header class="page-head">
      <nav class="crumbs">
        <RouterLink to="/">Benchmarks</RouterLink><span class="sep">›</span><span class="current">Browse</span>
      </nav>
      <h1>Every tracked title</h1>
      <p class="lede">
        All {{ benchmarks.titles.length }} games and apps, filterable by category, industry, topic and score.
        An agent can set any of these filters with <code>benchmarks_set_view</code>.
      </p>
    </header>

    <FilterBar :count="rows.length" />

    <p v-if="!rows.length" class="empty">
      Nothing matches those filters. Try clearing the search or lowering the minimum score.
    </p>

    <TitleTable v-else-if="view.filters.mode === 'table'" :rows="rows" />

    <div v-else class="grid-cards">
      <TitleCard v-for="row in rows" :key="row.id" :title="row" />
    </div>
  </div>
</template>

<style scoped>
code { font-family: var(--mono); font-size: 0.88em; color: var(--green-deep); }
</style>
