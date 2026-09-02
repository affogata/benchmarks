<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { TitleView } from '@/domain/benchmarks/models'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { bandFor } from '@/domain/benchmarks/selectors'
import { fmtDelta, fmtRating, fmtScore } from '@/shared/lib/format'
import DeltaChip from '@/shared/ui/DeltaChip.vue'
import Sparkline from '@/shared/ui/Sparkline.vue'
import TitleIcon from '@/shared/ui/TitleIcon.vue'
import TopicTag from '@/shared/ui/TopicTag.vue'

const props = defineProps<{ title: TitleView }>()

const benchmarks = useBenchmarksStore()
const view = useViewStore()

const band = computed(() =>
  bandFor(benchmarks.meta?.bands ?? [], props.title.score),
)
const bandClass = computed(() => `band-${band.value?.id ?? 'mixed'}`)
const strokeColor = computed(() =>
  band.value?.id === 'critical' ? 'var(--red)' : band.value?.id === 'mixed' ? 'var(--amber)' : 'var(--green)',
)
const basis = computed(() => (props.title.cadence === 'version' ? 'previous version' : 'last week'))
const isOpen = computed(() => view.expanded.has(props.title.id))
const inComparison = computed(() => view.comparison.includes(props.title.id))
const isHighlighted = computed(() => view.highlighted === props.title.id)
</script>

<template>
  <article
    class="card vc"
    :class="{ 'is-highlighted': isHighlighted }"
    :style="{ '--accent': title.accent }"
    :data-title-id="title.id"
  >
    <header class="head">
      <TitleIcon :title="title" />
      <div class="ident">
        <RouterLink class="name" :to="`/title/${title.id}`">{{ title.name }}</RouterLink>
        <div class="meta">
          {{ title.publisher }}
          <template v-if="title.storeRating"> · <b>{{ fmtRating(title.storeRating) }}</b></template>
          <template v-if="title.release"> · {{ title.release }}</template>
        </div>
        <RouterLink
          class="cat-pill"
          :to="`/category/${title.category.id}`"
          :style="{ color: title.category.color, borderColor: `${title.category.color}59`, background: `${title.category.color}14` }"
        >
          {{ title.category.emoji }} {{ title.category.shortName }}
        </RouterLink>
      </div>
    </header>

    <div class="score-row">
      <div>
        <div class="score" :class="bandClass">{{ fmtScore(title.score) }}</div>
        <div class="mono score-label">
          Impact /10 · current {{ title.cadence }}
          <DeltaChip :value="title.delta" size="sm" :label="`vs ${basis}`" />
        </div>
      </div>
      <Sparkline :points="title.history" :stroke="strokeColor" :width="150" :height="44" />
    </div>

    <ol class="history">
      <li v-for="(point, index) in title.history" :key="point.label" :class="{ current: index === title.history.length - 1 }">
        <span class="hs" :class="bandClass">{{ fmtScore(point.score) }}</span>
        <span v-if="point.delta !== null" class="hd" :class="point.delta >= 0 ? 'tone-up' : 'tone-down'">
          {{ fmtDelta(point.delta) }}
        </span>
        <span class="hl">{{ point.label }}</span>
      </li>
    </ol>

    <p v-if="title.aiRead" class="ai-read"><b>AI read</b>{{ title.aiRead }}</p>

    <div class="trends">
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

    <section v-if="isOpen" class="drill">
      <div class="mono drill-label">Movement</div>
      <div class="drill-grid">
        <div class="dst">
          <b>{{ fmtScore(title.movement.thisWeek) }}</b><span class="mono">this week</span>
          <i>was {{ fmtScore(title.movement.lastWeek) }} last week</i>
        </div>
        <div class="dst">
          <b :class="title.movement.wow >= 0 ? 'tone-up' : 'tone-down'">{{ fmtDelta(title.movement.wow) }}</b>
          <span class="mono">week over week</span>
          <i>#{{ title.movement.rank }} {{ title.movement.rankKind }} of {{ title.movement.pool }}</i>
        </div>
        <div class="dst">
          <b>{{ fmtDelta(title.movement.vsCategoryAvg) }}</b><span class="mono">vs category avg</span>
          <i>avg {{ fmtScore(title.movement.categoryAvg) }}</i>
        </div>
        <div class="dst">
          <b>{{ title.movement.isLeader ? 'leader' : fmtDelta(title.movement.vsLeader) }}</b>
          <span class="mono">vs category leader</span>
          <i>{{ title.movement.isLeader ? 'this title leads' : `${title.movement.leader} at ${fmtScore(title.movement.leaderScore)}` }}</i>
        </div>
      </div>
      <p v-if="title.reviewPulse" class="pulse">
        📊 Store reviews {{ title.reviewPulse.window }} (live MCP pull): {{ title.reviewPulse.reviews }} reviews
        (was {{ title.reviewPulse.prevReviews }}) · {{ title.reviewPulse.positivePct }}% positive
        (was {{ title.reviewPulse.prevPositivePct }}%) ·
        {{ title.reviewPulse.sources.map((s) => `${s.name} ${s.count}`).join(' · ') }}
      </p>
    </section>

    <footer class="foot">
      <button type="button" class="link" @click="view.toggleExpanded(title.id)">
        {{ isOpen ? '× Close drill-down' : '⚡ Open drill-down' }}
      </button>
      <button
        type="button"
        class="link"
        :class="{ active: inComparison }"
        @click="view.toggleComparison(title.id)"
      >
        {{ inComparison ? '✓ In comparison' : '+ Compare' }}
      </button>
      <RouterLink class="link" :to="`/title/${title.id}`">Full read →</RouterLink>
    </footer>
  </article>
</template>

<style scoped>
.vc {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.15s var(--ease), transform 0.15s var(--ease);
}
.vc:hover { border-color: var(--accent); transform: translateY(-2px); }

.head { display: flex; gap: 12px; align-items: flex-start; }
.ident { min-width: 0; }
.name { font-family: var(--display); font-weight: 600; font-size: 18px; color: var(--ink); }
.name:hover { color: var(--green); }
.meta { color: var(--ink-2); font-size: 13.5px; margin-top: 2px; }
.meta b { color: var(--amber); font-weight: 600; }
.cat-pill {
  display: inline-block;
  margin-top: 6px;
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-weight: 700;
  border: 1px solid;
  border-radius: 999px;
  padding: 2px 8px;
}

.score-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.score { font-family: var(--display); font-weight: 700; font-size: 40px; line-height: 1; letter-spacing: -0.02em; }
.score-label { margin-top: 4px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; text-transform: none; letter-spacing: 0.04em; }

.history { list-style: none; display: flex; gap: 6px; }
.history li {
  flex: 1;
  min-width: 0;
  text-align: center;
  background: var(--bg-soft);
  border: 1px solid var(--line-3);
  border-radius: var(--radius-sm);
  padding: 7px 4px;
}
.history li.current { border-color: rgba(95, 191, 127, 0.55); }
.hs { font-family: var(--display); font-weight: 700; font-size: 16px; }
.hd { font-family: var(--mono); font-size: 10px; margin-left: 4px; }
.hl { display: block; font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }

.ai-read {
  font-size: 14px;
  line-height: 1.55;
  color: var(--ink-2);
  padding-left: 10px;
  border-left: 2px solid var(--line-2);
}
.ai-read b {
  display: block;
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--green);
  margin-bottom: 3px;
}

.trends { display: flex; gap: 12px; border-top: 1px solid var(--line); padding-top: 12px; }
.trends > div { flex: 1; min-width: 0; }
.trends .mono { display: block; margin-bottom: 6px; font-size: 10px; }
.tags { display: flex; flex-wrap: wrap; gap: 4px; }

.drill { border-top: 1px dashed var(--line-3); padding-top: 12px; }
.drill-label { margin-bottom: 8px; font-size: 9.5px; }
.drill-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.dst { background: var(--bg-raised); border: 1px solid var(--line-3); border-radius: 10px; padding: 9px 11px; }
.dst b { display: block; font-size: 17px; font-weight: 800; color: var(--ink); font-family: var(--display); }
.dst .mono { font-size: 8.5px; }
.dst i { display: block; font-style: normal; font-size: 10.5px; color: var(--green); margin-top: 2px; }
.pulse { font-family: var(--mono); font-size: 10.5px; color: var(--ink-3); line-height: 1.65; margin-top: 10px; }

.foot {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}
.link { font-family: var(--mono); font-size: 12px; color: var(--green-deep); }
.link:hover { color: var(--green); }
.link.active { color: var(--purple); }
</style>
