<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { TitleView } from '@/domain/benchmarks/models'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { bandFor } from '@/domain/benchmarks/selectors'
import { accentPalette } from '@/shared/lib/color'
import { fmtDelta, fmtRating, fmtScore } from '@/shared/lib/format'
import DeltaChip from '@/shared/ui/DeltaChip.vue'
import ScoreChart from '@/shared/ui/ScoreChart.vue'
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

// The card carries the title's own colour, the way the published benchmarks page does it:
// 79 cards that differ at a glance, so the eye can tell them apart before it reads a word.
const palette = computed(() => accentPalette(props.title.accent))

// The pill's own colours are inline, so they win over any stylesheet rule — the tinted
// variant has to be chosen here rather than overridden in CSS. Category colour stays as
// the text (it is a different signal from the title accent); only the plate goes neutral,
// because a 14%-alpha fill of it disappears against a saturated ground.
const catPillStyle = computed(() =>
  palette.value
    ? { color: props.title.category.color, borderColor: 'rgba(255, 255, 255, 0.28)', background: 'rgba(0, 0, 0, 0.3)' }
    : {
        color: props.title.category.color,
        borderColor: `${props.title.category.color}59`,
        background: `${props.title.category.color}14`,
      },
)
</script>

<template>
  <article
    class="card vc"
    :class="{ 'is-highlighted': isHighlighted, tinted: !!palette }"
    :style="{
      '--accent': title.accent,
      '--ground': palette?.gradient,
      '--gink': palette?.ink,
      '--ginkm': palette?.inkMid,
      '--gpaper': palette?.paper,
    }"
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
        <RouterLink class="cat-pill" :to="`/category/${title.category.id}`" :style="catPillStyle">
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
      <ScoreChart
        :points="title.history"
        :stroke="strokeColor"
        :fill="palette ? 'rgba(255, 255, 255, 0.45)' : undefined"
        :axis-color="palette ? 'rgba(255, 255, 255, 0.85)' : undefined"
        :reference="{ value: title.movement.categoryAvg, label: 'cat avg' }"
        :width="210"
        :height="64"
      />
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

    <p v-if="title.aiRead" class="ai-read"><b>Affogata insight</b>{{ title.aiRead }}</p>

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

/*
 * Tinted variant. The ground carries the brand colour, so every block inside it that was
 * drawn for near-black has to move: headline type goes white, and the small surfaces that
 * were dark plates on a dark card become pale "paper" with the accent's own dark shades as
 * ink. Halfway leaves numbers sitting in muddy patches, which is worse than not tinting.
 */
.vc.tinted { background: var(--ground); border-color: rgba(0, 0, 0, 0.35); }
.vc.tinted .name, .vc.tinted .score { color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4); }
.vc.tinted .name:hover { color: #fff; text-decoration: underline; }
.vc.tinted .meta { color: rgba(255, 255, 255, 0.82); }
.vc.tinted .meta b { color: #ffd97a; }
.vc.tinted .score-label { color: rgba(255, 255, 255, 0.85); }

/* Paper chips: the release history and the drill-down tiles. */
.vc.tinted .history li,
.vc.tinted .dst { background: var(--gpaper); border-color: rgba(0, 0, 0, 0.22); }
.vc.tinted .history li.current { outline: 2px solid rgba(255, 255, 255, 0.55); }
.vc.tinted .hs, .vc.tinted .dst b { color: var(--gink); }
.vc.tinted .hl, .vc.tinted .dst .mono, .vc.tinted .dst i { color: var(--ginkm); }
/* Band and tone colours are tuned for the dark card; on paper they need the darker end. */
.vc.tinted .hs.band-mixed { color: #8a5a00; }
.vc.tinted .hs.band-critical, .vc.tinted .hd.tone-down, .vc.tinted .dst b.tone-down { color: #a82743; }
.vc.tinted .hd.tone-up, .vc.tinted .dst b.tone-up { color: #1e6b38; }

.vc.tinted .ai-read { border-left-color: rgba(255, 255, 255, 0.35); color: rgba(255, 255, 255, 0.92); }
.vc.tinted .ai-read b { color: rgba(255, 255, 255, 0.85); }

.vc.tinted .trends, .vc.tinted .foot { border-top-color: rgba(255, 255, 255, 0.18); }
.vc.tinted .drill { border-top-color: rgba(255, 255, 255, 0.24); }
.vc.tinted .drill-label, .vc.tinted .trends .mono { color: rgba(255, 255, 255, 0.85); }
.vc.tinted .trends .tone-up { color: #d7ffe3; }
.vc.tinted .trends .tone-down { color: #ffd3db; }
.vc.tinted .pulse { color: rgba(255, 255, 255, 0.8); }
.vc.tinted .link { color: #fff; }
.vc.tinted .link:hover { color: #fff; text-decoration: underline; }
.vc.tinted .link.active { color: var(--purple); }

/* TopicTag is a child component: its root element carries this scope id, so these reach it. */
.vc.tinted .tag.up { background: var(--gpaper); color: #1e6b38; border-color: rgba(0, 0, 0, 0.22); font-weight: 700; }
.vc.tinted .tag.down { background: var(--gpaper); color: #a82743; border-color: rgba(0, 0, 0, 0.22); font-weight: 700; }

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
