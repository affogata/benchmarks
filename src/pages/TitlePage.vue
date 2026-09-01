<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { bandFor, findTitle, queryTitles, toView, volatility } from '@/domain/benchmarks/selectors'
import { fmtDelta, fmtRating, fmtScore } from '@/shared/lib/format'
import DeltaChip from '@/shared/ui/DeltaChip.vue'
import Sparkline from '@/shared/ui/Sparkline.vue'
import StatTile from '@/shared/ui/StatTile.vue'
import TitleIcon from '@/shared/ui/TitleIcon.vue'
import TopicTag from '@/shared/ui/TopicTag.vue'

const props = defineProps<{ titleId: string }>()
const benchmarks = useBenchmarksStore()
const view = useViewStore()

const title = computed(() => {
  const found = findTitle(benchmarks.require(), props.titleId)
  return found ? toView(benchmarks.require(), found) : null
})

const band = computed(() =>
  title.value ? bandFor(benchmarks.meta?.bands ?? [], title.value.score) : null,
)
const bandClass = computed(() => `band-${band.value?.id ?? 'mixed'}`)
const strokeColor = computed(() =>
  band.value?.id === 'critical' ? 'var(--red)' : band.value?.id === 'mixed' ? 'var(--amber)' : 'var(--green)',
)

const peers = computed(() =>
  title.value
    ? queryTitles(benchmarks.require(), { categoryId: title.value.category.id, sort: 'score' })
    : [],
)
const basis = computed(() => (title.value?.cadence === 'version' ? 'previous version' : 'last week'))
</script>

<template>
  <div v-if="title" class="wrap">
    <header class="page-head">
      <nav class="crumbs">
        <RouterLink to="/">Benchmarks</RouterLink><span class="sep">›</span>
        <RouterLink :to="`/category/${title.category.id}`">{{ title.category.shortName }}</RouterLink>
        <span class="sep">›</span><span class="current">{{ title.name }}</span>
      </nav>

      <div class="masthead">
        <TitleIcon :title="title" :size="72" />
        <div>
          <h1>{{ title.name }}</h1>
          <p class="sub">
            {{ title.publisher }}
            <template v-if="title.storeRating"> · <b>{{ fmtRating(title.storeRating) }}</b></template>
            <template v-if="title.release"> · {{ title.release }}</template>
            ·
            <RouterLink :to="`/category/${title.category.id}`" :style="{ color: title.category.color }">
              {{ title.category.emoji }} {{ title.category.name }}
            </RouterLink>
          </p>
        </div>
        <div class="score-block">
          <div class="score" :class="bandClass">{{ fmtScore(title.score) }}</div>
          <div class="mono">Impact /10 · {{ band?.label }}</div>
          <DeltaChip :value="title.delta" :label="`vs ${basis}`" />
        </div>
      </div>
    </header>

    <section class="cols">
      <div class="main">
        <div class="panel chart">
          <div class="mono">Score across the tracked window</div>
          <Sparkline :points="title.history" :stroke="strokeColor" :width="640" :height="120" />
          <ol class="axis">
            <li v-for="point in title.history" :key="point.label">
              <b :class="bandClass">{{ fmtScore(point.score) }}</b>
              <DeltaChip v-if="point.delta !== null" :value="point.delta" size="sm" />
              <span class="mono">{{ point.label }}</span>
            </li>
          </ol>
        </div>

        <p v-if="title.aiRead" class="panel ai">
          <b class="mono">AI read</b>{{ title.aiRead }}
        </p>

        <div class="panel">
          <div class="topic-cols">
            <div>
              <span class="mono tone-up">▲ Gaining</span>
              <div class="tags">
                <TopicTag v-for="topic in title.gaining" :key="topic" :label="topic" tone="up" />
              </div>
            </div>
            <div>
              <span class="mono tone-down">▼ Slipping</span>
              <div class="tags">
                <TopicTag v-for="topic in title.slipping" :key="topic" :label="topic" tone="down" />
              </div>
            </div>
          </div>
        </div>

        <div v-if="title.reviewPulse" class="panel pulse">
          <div class="mono">Store reviews · {{ title.reviewPulse.window }} · live MCP pull</div>
          <div class="pulse-grid">
            <StatTile
              :value="String(title.reviewPulse.reviews)"
              label="Reviews"
              :note="`was ${title.reviewPulse.prevReviews}`"
            />
            <StatTile
              :value="`${title.reviewPulse.positivePct}%`"
              label="Positive"
              :note="`was ${title.reviewPulse.prevPositivePct}%`"
              :tone="title.reviewPulse.positivePct >= title.reviewPulse.prevPositivePct ? 'up' : 'down'"
            />
            <StatTile
              :value="fmtScore(title.reviewPulse.reviewImpact)"
              label="Review impact"
              :note="`was ${fmtScore(title.reviewPulse.prevReviewImpact)}`"
            />
            <StatTile
              :value="title.reviewPulse.sources.map((s) => s.count).reduce((a, b) => a + b, 0).toString()"
              label="By source"
              :note="title.reviewPulse.sources.map((s) => `${s.name} ${s.count}`).join(' · ')"
            />
          </div>
        </div>
      </div>

      <aside class="side">
        <div class="panel">
          <div class="mono">Movement · {{ benchmarks.meta?.movementWindow }}</div>
          <div class="tiles">
            <StatTile
              :value="fmtDelta(title.movement.wow)"
              label="Week over week"
              :note="`#${title.movement.rank} ${title.movement.rankKind} of ${title.movement.pool}`"
              :tone="title.movement.wow >= 0 ? 'up' : 'down'"
            />
            <StatTile
              :value="fmtDelta(title.movement.vsCategoryAvg)"
              label="vs category avg"
              :note="`avg ${fmtScore(title.movement.categoryAvg)}`"
            />
            <StatTile
              :value="title.movement.isLeader ? 'leads' : fmtDelta(title.movement.vsLeader)"
              label="vs category leader"
              :note="title.movement.isLeader ? 'this title leads' : `${title.movement.leader} ${fmtScore(title.movement.leaderScore)}`"
            />
            <StatTile :value="fmtScore(volatility(title))" label="Volatility" note="high minus low" />
          </div>
        </div>

        <div class="panel">
          <div class="mono">Category ladder</div>
          <ol class="ladder">
            <li v-for="peer in peers" :key="peer.id" :class="{ self: peer.id === title.id }">
              <RouterLink :to="`/title/${peer.id}`">{{ peer.name }}</RouterLink>
              <b :class="`band-${bandFor(benchmarks.meta?.bands ?? [], peer.score).id}`">{{ fmtScore(peer.score) }}</b>
            </li>
          </ol>
        </div>

        <button class="btn btn-ghost full" type="button" @click="view.toggleComparison(title.id)">
          {{ view.comparison.includes(title.id) ? '✓ In comparison' : '+ Add to comparison' }}
        </button>
        <RouterLink class="btn btn-ghost full" to="/compare">Open comparison →</RouterLink>
      </aside>
    </section>
  </div>

  <div v-else class="wrap boot">
    <h1>Title not found</h1>
    <p class="lede">
      Nothing matches “{{ titleId }}”. <RouterLink to="/browse">Browse all titles</RouterLink>.
    </p>
  </div>
</template>

<style scoped>
.masthead { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.sub { color: var(--ink-2); font-size: 14.5px; margin-top: 4px; }
.sub b { color: var(--amber); }
.score-block { margin-left: auto; text-align: right; }
.score { font-family: var(--display); font-weight: 700; font-size: 58px; line-height: 1; letter-spacing: -0.03em; }
.score-block .mono { font-size: 10px; margin: 4px 0 2px; }

.cols { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(280px, 1fr); gap: 20px; align-items: start; }
.main { display: flex; flex-direction: column; gap: 16px; }
.side { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 88px; }

.chart .mono { font-size: 10px; margin-bottom: 12px; }
.axis { list-style: none; display: flex; gap: 10px; margin-top: 12px; }
.axis li {
  flex: 1;
  text-align: center;
  border: 1px solid var(--line-3);
  border-radius: 10px;
  padding: 9px 6px;
  background: var(--bg-raised);
}
.axis b { font-family: var(--display); font-size: 20px; display: block; }
.axis .mono { font-size: 10px; display: block; margin-top: 3px; }

.ai { font-size: 15px; line-height: 1.65; border-left: 3px solid var(--green); }
.ai b { display: block; font-size: 9px; color: var(--green); margin-bottom: 5px; }

.topic-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.topic-cols .mono { display: block; margin-bottom: 8px; font-size: 10px; }
.tags { display: flex; flex-wrap: wrap; gap: 5px; }

.pulse .mono { font-size: 10px; margin-bottom: 12px; }
.pulse-grid, .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.side .mono { font-size: 10px; margin-bottom: 12px; display: block; }

.ladder { list-style: none; display: flex; flex-direction: column; gap: 6px; }
.ladder li { display: flex; justify-content: space-between; gap: 10px; font-size: 13.5px; padding: 5px 8px; border-radius: 6px; }
.ladder li.self { background: var(--green-soft); }
.ladder a { color: var(--ink-2); }
.ladder a:hover { color: var(--green); }
.ladder b { font-family: var(--display); }

.full { width: 100%; justify-content: center; }
.boot { padding: 80px 32px; text-align: center; }

@media (max-width: 980px) {
  .cols { grid-template-columns: 1fr; }
  .side { position: static; }
}
</style>
