<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { categoryAnalytics } from '@/domain/benchmarks/analytics'
import { findCategory, queryTitles } from '@/domain/benchmarks/selectors'
import { fmtDelta, fmtScore } from '@/shared/lib/format'
import Breadcrumbs from '@/shared/ui/Breadcrumbs.vue'
import type { Crumb } from '@/shared/ui/breadcrumbs'
import StatTile from '@/shared/ui/StatTile.vue'
import TitleCard from '@/widgets/TitleCard.vue'
import TopicTag from '@/shared/ui/TopicTag.vue'

const props = defineProps<{ categoryId: string }>()
const benchmarks = useBenchmarksStore()
const view = useViewStore()

const category = computed(() => findCategory(benchmarks.require(), props.categoryId) ?? null)
const stats = computed(() => (category.value ? categoryAnalytics(benchmarks.require(), category.value) : null))
const rows = computed(() =>
  category.value ? queryTitles(benchmarks.require(), { categoryId: category.value.id, sort: 'score' }) : [],
)
const industry = computed(() =>
  category.value
    ? benchmarks.industries.find((item) => item.id === category.value!.industryId) ?? null
    : null,
)

// An industry has no page of its own, so its crumb points at the browse page filtered
// down to that industry — the same state benchmarks_set_view({ industry }) produces.
const crumbs = computed<Crumb[]>(() => [
  { label: 'Benchmarks', to: '/' },
  ...(industry.value
    ? [{ label: industry.value.name, to: { path: '/browse', query: { industry: industry.value.id } } }]
    : []),
  ...(category.value ? [{ label: category.value.shortName }] : []),
])

// Keep the shared filter state in step, so switching category here and switching it from a
// tool call leave the app in the same state.
watch(
  category,
  (value) => {
    if (value) view.patch({ categoryId: value.id, industryId: null })
  },
  { immediate: true },
)

const filterByTopic = (topic: string): void => {
  view.patch({ topic })
}
</script>

<template>
  <div v-if="category && stats" class="wrap">
    <header class="page-head">
      <Breadcrumbs :items="crumbs" />
      <h1 :style="{ color: category.color }">{{ category.emoji }} {{ category.name }}</h1>
      <p class="lede">
        {{ stats.titleCount }} titles scored on how their {{ category.audience }} actually talk about them.
      </p>
    </header>

    <section class="tiles">
      <StatTile :value="fmtScore(stats.average)" label="Category average" :note="`median ${fmtScore(stats.median)}`" />
      <StatTile :value="fmtScore(stats.spread)" label="Spread" note="best minus worst" />
      <StatTile
        v-if="stats.leader"
        :value="fmtScore(stats.leader.score)"
        label="Leader"
        :note="stats.leader.name"
        tone="up"
      />
      <StatTile
        v-if="stats.laggard"
        :value="fmtScore(stats.laggard.score)"
        label="Weakest"
        :note="stats.laggard.name"
        tone="down"
      />
      <StatTile
        :value="`${stats.distribution.strong}/${stats.distribution.mixed}/${stats.distribution.critical}`"
        label="Strong / mixed / critical"
      />
    </section>

    <section class="topics panel">
      <div>
        <span class="mono tone-up">▲ Most common praise</span>
        <div class="tags">
          <TopicTag
            v-for="topic in stats.risingTopics"
            :key="topic.topic"
            :label="`${topic.topic} · ${topic.count}`"
            tone="up"
            clickable
            @click="filterByTopic(topic.topic)"
          />
        </div>
      </div>
      <div>
        <span class="mono tone-down">▼ Most common complaint</span>
        <div class="tags">
          <TopicTag
            v-for="topic in stats.fallingTopics"
            :key="topic.topic"
            :label="`${topic.topic} · ${topic.count}`"
            tone="down"
            clickable
            @click="filterByTopic(topic.topic)"
          />
        </div>
      </div>
    </section>

    <section v-if="stats.topGainers.length || stats.topDroppers.length" class="movement">
      <p v-if="stats.topGainers.length" class="line">
        <b class="tone-up">Gaining:</b>
        <span v-for="row in stats.topGainers" :key="row.id">
          {{ row.name }} {{ fmtDelta(row.movement.wow) }}
        </span>
      </p>
      <p v-if="stats.topDroppers.length" class="line">
        <b class="tone-down">Dropping:</b>
        <span v-for="row in stats.topDroppers" :key="row.id">
          {{ row.name }} {{ fmtDelta(row.movement.wow) }}
        </span>
      </p>
    </section>

    <section class="grid-cards">
      <TitleCard v-for="row in rows" :key="row.id" :title="row" />
    </section>
  </div>

  <div v-else class="wrap boot">
    <h1>Category not found</h1>
    <p class="lede">
      No category matches “{{ categoryId }}”. <RouterLink to="/">Back to the benchmarks</RouterLink>.
    </p>
  </div>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.topics { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
.topics .mono { display: block; margin-bottom: 8px; font-size: 10px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.movement { margin-bottom: 22px; }
.line { font-size: 13.5px; color: var(--ink-2); display: flex; gap: 10px; flex-wrap: wrap; }
.line b { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; }
.boot { padding: 80px 32px; text-align: center; }
@media (max-width: 760px) { .topics { grid-template-columns: 1fr; } }
</style>
