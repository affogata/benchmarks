<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { findCategory, findIndustry, queryTitles } from '@/domain/benchmarks/selectors'
import Breadcrumbs from '@/shared/ui/Breadcrumbs.vue'
import FilterBar from '@/widgets/FilterBar.vue'
import TitleCard from '@/widgets/TitleCard.vue'
import TitleTable from '@/widgets/TitleTable.vue'

const benchmarks = useBenchmarksStore()
const view = useViewStore()
const route = useRoute()

const single = (value: unknown): string | null => {
  const raw = Array.isArray(value) ? value[0] : value
  const text = typeof raw === 'string' ? raw.trim() : ''
  return text ? text : null
}

// Deep links (?industry=gaming, ?category=travel-apps, ?topic=ads, ?search=…) land in the
// same store the on-page controls write to, so a breadcrumb, a shared link or an agent
// hand-off arrives with the filters already applied.
//
// Every change rebuilds all four of them, clearing whatever the URL no longer carries.
// Patching only the parameters that are present left /browse?industry=gaming&topic=ads
// still filtered after a plain /browse navigation — the page showing one thing and its own
// address bar claiming another. `benchmarks_set_view` puts these four in the URL for the
// same reason.
watch(
  () => route.query,
  (query) => {
    const dataset = benchmarks.require()
    const industry = single(query.industry)
    const category = single(query.category)

    const foundCategory = category ? findCategory(dataset, category) : undefined
    const foundIndustry = industry ? findIndustry(dataset, industry) : undefined

    view.patch({
      // A category is the narrower of the two, so it wins if the URL somehow carries both.
      categoryId: foundCategory?.id ?? null,
      industryId: foundCategory ? null : foundIndustry?.id ?? null,
      topic: single(query.topic),
      search: single(query.search) ?? '',
    })
  },
  { immediate: true },
)

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
      <Breadcrumbs :items="[{ label: 'Benchmarks', to: '/' }, { label: 'Browse' }]" />
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
