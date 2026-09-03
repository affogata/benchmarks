<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { MAX_COMPARISON, useViewStore } from '@/stores/view.store'
import { compare } from '@/domain/benchmarks/analytics'
import { findTitle, queryTitles } from '@/domain/benchmarks/selectors'
import { accentPalette } from '@/shared/lib/color'
import { fmtDelta, fmtScore } from '@/shared/lib/format'
import Breadcrumbs from '@/shared/ui/Breadcrumbs.vue'
import ScoreChart from '@/shared/ui/ScoreChart.vue'
import TitleIcon from '@/shared/ui/TitleIcon.vue'
import TopicTag from '@/shared/ui/TopicTag.vue'

const benchmarks = useBenchmarksStore()
const view = useViewStore()
const route = useRoute()
const router = useRouter()

const idsFromParam = (param: unknown): string[] => {
  const raw = Array.isArray(param) ? param.join(',') : String(param ?? '')
  return raw
    .split(',')
    .map((ref) => findTitle(benchmarks.require(), ref.trim())?.id)
    .filter((id): id is string => Boolean(id))
}

// A deep link (?titles=a,b,c) is how `benchmarks_compare_in_ui` hands off to this page.
// Watched rather than read once at mount: the query can change while this page stays
// mounted, and the selection would otherwise contradict the URL that produced it.
//
// No `titles` at all means "show whatever is in the comparison tray". A `titles` that
// resolves to nothing means an empty selection — the honest "pick at least two" state,
// not a leftover comparison the link never asked for.
watch(
  () => route.query.titles,
  (param) => {
    if (param === undefined) return
    view.setComparison(idsFromParam(param))
  },
  { immediate: true },
)

// The other direction: a chip removed by hand (or a title added from the dropdown) has to
// reach the URL too. The query string is what a person shares, what a reload restores and
// what an agent reads back off the address bar — a URL still naming a title the page no
// longer shows is a state both of them will get wrong.
//
// Runs immediately as well, so arriving from the tray (`/compare`, no query) or through a
// link written with names rather than ids leaves the URL in canonical form.
watch(
  () => view.comparison.join(','),
  (joined) => {
    const param = route.query.titles
    if (param === undefined && !joined) return
    // Compare resolved ids, not raw text: `?titles=Wise` and `?titles=wise` are the same
    // view, and rewriting one into the other on every change is churn, not a fix.
    if (param !== undefined && idsFromParam(param).join(',') === joined) return

    const query = { ...route.query }
    if (joined) query.titles = joined
    else delete query.titles
    void router.replace({ query })
  },
  { immediate: true },
)

const selected = computed(() =>
  view.comparison
    .map((id) => findTitle(benchmarks.require(), id))
    .filter((title): title is NonNullable<typeof title> => Boolean(title)),
)

const result = computed(() =>
  selected.value.length >= 2 ? compare(benchmarks.require(), selected.value) : null,
)

const pool = computed(() => queryTitles(benchmarks.require(), { sort: 'score' }))

// The store caps the selection, and a capped `add` keeps the titles already there — so a
// sixth pick from this dropdown would land nowhere and look like a broken control.
const atCapacity = computed(() => view.comparison.length >= MAX_COMPARISON)

// Same treatment the browse cards get, and on this page it earns a second job: the colour
// is what tells you which head card goes with which column of the table below.
const heads = computed(() =>
  (result.value?.titles ?? []).map((title) => ({ title, palette: accentPalette(title.accent) })),
)

/**
 * One y-window for all the head charts. Three lines each scaled to their own points look
 * equally dramatic whatever they actually did, which is the opposite of what a comparison
 * is for; on a shared axis a flat run reads as flat next to a climb.
 */
const chartDomain = computed<[number, number] | null>(() => {
  const scores = heads.value.flatMap(({ title }) => title.history.map((point) => point.score))
  if (!scores.length) return null
  const low = Math.min(...scores)
  const high = Math.max(...scores)
  const pad = Math.max(0.4, (high - low) * 0.15)
  return [
    Math.max(0, Math.floor((low - pad) * 10) / 10),
    Math.min(10, Math.ceil((high + pad) * 10) / 10),
  ]
})

const formatValue = (key: string, value: number | string | null): string => {
  if (value === null) return '—'
  if (typeof value === 'string') return value
  return ['score', 'storeRating', 'volatility'].includes(key) ? fmtScore(value) : fmtDelta(value)
}
</script>

<template>
  <div class="wrap">
    <header class="page-head">
      <Breadcrumbs :items="[{ label: 'Benchmarks', to: '/' }, { label: 'Compare' }]" />
      <h1>Side by side</h1>
      <p class="lede">
        Put up to five titles against each other across score, movement, category position and topic
        clusters. An agent can build this exact view with <code>benchmarks_compare_in_ui</code>.
      </p>
    </header>

    <div class="picker">
      <select
        class="field"
        :value="''"
        :disabled="atCapacity"
        @change="view.toggleComparison(($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>{{ atCapacity ? `${MAX_COMPARISON} is the maximum` : '+ Add a title…' }}</option>
        <option v-for="row in pool" :key="row.id" :value="row.id" :disabled="view.comparison.includes(row.id)">
          {{ row.name }} — {{ fmtScore(row.score) }} ({{ row.category.shortName }})
        </option>
      </select>

      <button
        v-for="title in selected"
        :key="title.id"
        class="pill"
        type="button"
        @click="view.toggleComparison(title.id)"
      >
        {{ title.name }} ×
      </button>

      <button v-if="selected.length" class="pill clear" type="button" @click="view.clearComparison()">
        Clear all
      </button>

      <span v-if="atCapacity" class="cap">Remove one to add another.</span>
    </div>

    <p v-if="!result" class="empty">
      Pick at least two titles to compare — from the dropdown above, from any card’s
      “+ Compare” button, or by asking an agent to run
      <code>benchmarks_compare_in_ui</code>.
    </p>

    <template v-else>
      <p class="verdict">{{ result.verdict }}</p>

      <div class="cards">
        <article
          v-for="{ title, palette } in heads"
          :key="title.id"
          class="card head-card"
          :class="{ tinted: !!palette }"
          :style="{ '--ground': palette?.gradient }"
        >
          <TitleIcon :title="title" :size="40" />
          <RouterLink class="name" :to="`/title/${title.id}`">{{ title.name }}</RouterLink>
          <span class="mono">{{ title.category.shortName }}</span>
          <div class="big">{{ fmtScore(title.score) }}</div>
          <ScoreChart
            :points="title.history"
            :fill="palette ? 'rgba(255, 255, 255, 0.45)' : undefined"
            :axis-color="palette ? 'rgba(255, 255, 255, 0.85)' : undefined"
            :domain="chartDomain"
            :width="200"
            :height="76"
            show-labels
          />
        </article>
      </div>

      <div class="scroller">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th v-for="title in result.titles" :key="title.id">{{ title.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in result.metrics" :key="metric.key">
              <th scope="row">{{ metric.label }}</th>
              <td
                v-for="entry in metric.values"
                :key="entry.titleId"
                :class="{ best: metric.best === entry.titleId }"
              >
                {{ formatValue(metric.key, entry.value) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section class="topics">
        <div class="panel">
          <span class="mono">Shared strengths</span>
          <div class="tags">
            <TopicTag v-for="topic in result.sharedGaining" :key="topic" :label="topic" tone="up" />
            <span v-if="!result.sharedGaining.length" class="none">No shared strengths.</span>
          </div>
        </div>
        <div class="panel">
          <span class="mono">Shared weaknesses</span>
          <div class="tags">
            <TopicTag v-for="topic in result.sharedSlipping" :key="topic" :label="topic" tone="down" />
            <span v-if="!result.sharedSlipping.length" class="none">No shared weaknesses.</span>
          </div>
        </div>
      </section>

      <section class="distinct">
        <div v-for="entry in result.distinctive" :key="entry.titleId" class="panel">
          <span class="mono">{{ result.titles.find((t) => t.id === entry.titleId)?.name }} — unique</span>
          <div class="tags">
            <TopicTag v-for="topic in entry.gaining" :key="`g-${topic}`" :label="topic" tone="up" />
            <TopicTag v-for="topic in entry.slipping" :key="`s-${topic}`" :label="topic" tone="down" />
            <span v-if="!entry.gaining.length && !entry.slipping.length" class="none">Nothing unique.</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
code { font-family: var(--mono); font-size: 0.88em; color: var(--green-deep); }
.picker { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 22px; }
.field {
  background: var(--bg-soft);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  font-size: 13.5px;
  color: var(--ink-2);
  min-width: 230px;
}
option { background: var(--bg-soft); }
.pill {
  font-family: var(--mono);
  font-size: 11.5px;
  border: 1px solid rgba(95, 191, 127, 0.4);
  color: var(--green);
  background: var(--green-soft);
  border-radius: 999px;
  padding: 7px 13px;
}
.pill.clear { border-color: var(--line-2); color: var(--ink-3); background: none; }
.field:disabled { opacity: 0.55; }
.cap { font-size: 12.5px; color: var(--ink-3); }

.verdict {
  font-size: 17px;
  color: var(--ink);
  border-left: 3px solid var(--green);
  padding-left: 14px;
  margin-bottom: 22px;
  line-height: 1.6;
}

.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 20px; }
.head-card { padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.head-card .name { font-family: var(--display); font-weight: 600; font-size: 16px; color: var(--ink); }
.head-card .mono { font-size: 9.5px; }
.big { font-family: var(--display); font-size: 34px; font-weight: 700; color: var(--ink); line-height: 1.1; }

/* Tinted head cards. Only type sits on this ground, so it needs less work than a browse
   card: white headline, and the label lifted off the dark-card grey it was tuned for. */
.head-card.tinted { background: var(--ground); border-color: rgba(0, 0, 0, 0.35); }
.head-card.tinted .name, .head-card.tinted .big { color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); }
.head-card.tinted .name:hover { color: #fff; text-decoration: underline; }
.head-card.tinted .mono { color: rgba(255, 255, 255, 0.85); }

.scroller { overflow-x: auto; border: 1px solid var(--line-2); border-radius: var(--radius); }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 620px; }
th {
  text-align: left;
  font-family: var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-3);
  font-weight: 400;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line-2);
  background: var(--bg-soft);
}
tbody th { text-transform: none; letter-spacing: 0.02em; font-size: 12px; color: var(--ink-2); background: transparent; border-bottom: 1px solid var(--line); }
td { padding: 11px 14px; border-bottom: 1px solid var(--line); font-family: var(--mono); font-size: 12.5px; }
td.best { color: var(--green); background: rgba(95, 191, 127, 0.06); font-weight: 700; }

.topics, .distinct { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-top: 18px; }
.topics .mono, .distinct .mono { display: block; margin-bottom: 10px; font-size: 10px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }
.none { font-size: 12.5px; color: var(--ink-4); }
</style>
