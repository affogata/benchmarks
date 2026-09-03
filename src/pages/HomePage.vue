<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useAgentStore } from '@/stores/agent.store'
import { categoryAnalytics, movers } from '@/domain/benchmarks/analytics'
import { fmtDelta, fmtScore } from '@/shared/lib/format'
import DeltaChip from '@/shared/ui/DeltaChip.vue'
import StatTile from '@/shared/ui/StatTile.vue'
import TitleIcon from '@/shared/ui/TitleIcon.vue'

const benchmarks = useBenchmarksStore()
const agent = useAgentStore()

const dataset = computed(() => benchmarks.require())
const stats = computed(() => benchmarks.overview!)
const gainers = computed(() => movers(dataset.value, 'gainers', { limit: 5 }))
const droppers = computed(() => movers(dataset.value, 'droppers', { limit: 5 }))

const industries = computed(() =>
  dataset.value.industries.map((industry) => ({
    industry,
    categories: dataset.value.categories
      .filter((category) => category.industryId === industry.id)
      .map((category) => categoryAnalytics(dataset.value, category)),
  })),
)

const distribution = computed(() => {
  const dist = stats.value.distribution
  const total = dist.strong + dist.mixed + dist.critical || 1
  return [
    { id: 'strong', label: 'Strong 7+', count: dist.strong, pct: (dist.strong / total) * 100, color: 'var(--green)' },
    { id: 'mixed', label: 'Mixed 4–7', count: dist.mixed, pct: (dist.mixed / total) * 100, color: 'var(--amber)' },
    { id: 'critical', label: 'Critical <4', count: dist.critical, pct: (dist.critical / total) * 100, color: 'var(--red)' },
  ]
})

const PROMPTS = [
  'Which app lost the most customer goodwill this week, and why?',
  'Open the dating apps category and tell me what all three big players get wrong.',
  'Compare Revolut, PayPal and Wise, then put them side by side on screen.',
  'Who is being punished for paywalls across every category?',
  'Export the gaming rows so you can find what correlates with a falling score.',
]
</script>

<template>
  <div class="wrap">
    <section class="hero">
      <div class="hero-main">
        <span class="badge mono">⚡ Powered by WebMCP · {{ agent.registeredCount || 16 }} live agent tools</span>
        <h1>
          Customer voice for every game and app,
          <span class="accent">scored by version.</span>
        </h1>
        <p class="lede">
          Real reviews from app stores, Steam and social — {{ dataset.meta.totals.titles }} titles across
          {{ dataset.meta.totals.industries }} industries and {{ dataset.meta.totals.categories }} categories,
          scored 0 to 10 per release. Browse it yourself, or let your AI agent read, filter and
          drive this page directly through WebMCP.
        </p>
        <div class="cta">
          <RouterLink class="btn btn-primary" to="/browse">Browse all {{ dataset.meta.totals.titles }} titles →</RouterLink>
          <RouterLink class="btn btn-ghost" to="/tools">⚡ See the agent tools</RouterLink>
        </div>
      </div>

      <aside class="hero-side panel">
        <h3>Ask your agent</h3>
        <p class="side-note">
          Open this page in ChatGPT's browser or Chrome with WebMCP enabled, then try:
        </p>
        <ul class="prompts">
          <li v-for="prompt in PROMPTS" :key="prompt">“{{ prompt }}”</li>
        </ul>
        <p class="side-foot mono">
          {{ agent.connected ? 'Host detected — tools are registered.' : 'No host detected — run the same tools from the console.' }}
        </p>
      </aside>
    </section>

    <section class="section">
      <div class="tiles">
        <StatTile :value="fmtScore(stats.average)" label="Corpus average" :note="`median ${fmtScore(stats.median)}`" />
        <StatTile
          v-if="stats.happiest"
          :value="fmtScore(stats.happiest.score)"
          label="Happiest customers"
          :note="stats.happiest.name"
          tone="up"
        />
        <StatTile
          v-if="stats.unhappiest"
          :value="fmtScore(stats.unhappiest.score)"
          label="Needs the most love"
          :note="stats.unhappiest.name"
          tone="down"
        />
        <StatTile
          v-if="stats.biggestGainer"
          :value="fmtDelta(stats.biggestGainer.wow)"
          label="Biggest weekly gain"
          :note="stats.biggestGainer.title.name"
          tone="up"
        />
        <StatTile
          v-if="stats.biggestDropper"
          :value="fmtDelta(stats.biggestDropper.wow)"
          label="Biggest weekly drop"
          :note="stats.biggestDropper.title.name"
          tone="down"
        />
      </div>

      <div class="dist">
        <div class="dist-bar">
          <span
            v-for="segment in distribution"
            :key="segment.id"
            :style="{ width: `${segment.pct}%`, background: segment.color }"
            :title="`${segment.label}: ${segment.count}`"
          />
        </div>
        <div class="dist-legend">
          <span v-for="segment in distribution" :key="segment.id" class="mono">
            <i :style="{ background: segment.color }" />{{ segment.label }} · {{ segment.count }}
          </span>
        </div>
      </div>
    </section>

    <section class="section movers">
      <div>
        <h2>Gaining ground</h2>
        <ol class="mover-list">
          <li v-for="row in gainers" :key="row.title.id">
            <TitleIcon :title="row.title" :size="34" />
            <RouterLink :to="`/title/${row.title.id}`">{{ row.title.name }}</RouterLink>
            <span class="cat mono">{{ row.title.category.shortName }}</span>
            <DeltaChip :value="row.wow" />
          </li>
        </ol>
      </div>
      <div>
        <h2>Losing ground</h2>
        <ol class="mover-list">
          <li v-for="row in droppers" :key="row.title.id">
            <TitleIcon :title="row.title" :size="34" />
            <RouterLink :to="`/title/${row.title.id}`">{{ row.title.name }}</RouterLink>
            <span class="cat mono">{{ row.title.category.shortName }}</span>
            <DeltaChip :value="row.wow" />
          </li>
        </ol>
      </div>
    </section>

    <section v-for="group in industries" :key="group.industry.id" class="section industry">
      <h2 class="ind-head" :style="{ color: group.industry.color }">
        {{ group.industry.emoji }} {{ group.industry.name }}
      </h2>
      <div class="cat-grid">
        <RouterLink
          v-for="stat in group.categories"
          :key="stat.category.id"
          class="card cat-card"
          :to="`/category/${stat.category.id}`"
          :style="{ '--c': stat.category.color }"
        >
          <div class="cat-top">
            <span class="cat-name">{{ stat.category.emoji }} {{ stat.category.name }}</span>
            <span class="mono">{{ stat.titleCount }} titles</span>
          </div>
          <div class="cat-avg">
            <b>{{ fmtScore(stat.average) }}</b>
            <span class="mono">avg impact</span>
          </div>
          <p v-if="stat.leader" class="cat-lead">
            <b>{{ stat.leader.name }}</b> leads at {{ fmtScore(stat.leader.score) }}
            <template v-if="stat.laggard && stat.laggard.id !== stat.leader.id">
              · {{ stat.laggard.name }} trails at {{ fmtScore(stat.laggard.score) }}
            </template>
          </p>
          <p class="cat-topics mono">▼ {{ stat.fallingTopics.slice(0, 3).map((t) => t.topic).join(' · ') }}</p>
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr);
  gap: 34px;
  padding: 46px 0 20px;
  align-items: start;
}
.badge {
  display: inline-block;
  color: var(--green-deep);
  border: 1px solid rgba(95, 191, 127, 0.35);
  background: var(--green-soft);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 10px;
  margin-bottom: 16px;
}
h1 { max-width: 16ch; }
.accent { color: var(--green); }
.hero .lede { margin-top: 14px; }
.cta { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 22px; }

.hero-side h3 { font-size: 16px; margin-bottom: 6px; }
.side-note { font-size: 13px; color: var(--ink-3); }
.prompts { list-style: none; margin-top: 12px; display: flex; flex-direction: column; gap: 9px; }
.prompts li {
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--ink-2);
  border-left: 2px solid var(--line-3);
  padding-left: 10px;
}
.side-foot { margin-top: 14px; font-size: 9.5px; }

.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }

.dist { margin-top: 20px; }
.dist-bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--bg-soft); }
.dist-legend { display: flex; gap: 18px; margin-top: 10px; flex-wrap: wrap; }
.dist-legend .mono { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; }
.dist-legend i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }

.movers { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
.movers h2 { font-size: 20px; margin-bottom: 12px; }
.mover-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.mover-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-soft);
  border: 1px solid var(--line-2);
  border-radius: 10px;
  padding: 9px 12px;
}
.mover-list a { color: var(--ink); font-weight: 600; font-size: 14.5px; }
.mover-list a:hover { color: var(--green); }
.mover-list .cat { margin-left: auto; font-size: 9.5px; }

.ind-head { font-family: var(--mono); font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 800; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 16px; }
.cat-card { padding: 16px; display: block; transition: border-color 0.15s var(--ease), transform 0.15s var(--ease); }
.cat-card:hover { border-color: var(--c); transform: translateY(-2px); }
.cat-top { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
.cat-name { font-family: var(--display); font-weight: 600; font-size: 15.5px; color: var(--c); }
.cat-top .mono { font-size: 9.5px; }
.cat-avg { display: flex; align-items: baseline; gap: 8px; margin-top: 10px; }
.cat-avg b { font-family: var(--display); font-size: 28px; font-weight: 700; color: var(--ink); }
.cat-avg .mono { font-size: 9.5px; }
.cat-lead { font-size: 13px; color: var(--ink-2); margin-top: 8px; }
.cat-lead b { color: var(--ink); }
.cat-topics { font-size: 10px; margin-top: 8px; color: var(--ink-4); text-transform: none; letter-spacing: 0.03em; }

@media (max-width: 980px) {
  .hero { grid-template-columns: 1fr; }
  .movers { grid-template-columns: 1fr; }
}
</style>
