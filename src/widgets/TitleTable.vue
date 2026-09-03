<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { TitleView } from '@/domain/benchmarks/models'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { bandFor } from '@/domain/benchmarks/selectors'
import { fmtDelta, fmtScore } from '@/shared/lib/format'
import DeltaChip from '@/shared/ui/DeltaChip.vue'

defineProps<{ rows: TitleView[] }>()
const benchmarks = useBenchmarksStore()
const view = useViewStore()

const bandClass = (score: number): string => `band-${bandFor(benchmarks.meta?.bands ?? [], score).id}`
</script>

<template>
  <div class="scroller">
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Category</th>
          <th class="num">Score</th>
          <!-- Not "Δ release": half the corpus is scored per week, and this column carries
               whichever cadence the row uses. -->
          <th class="num" title="Change against the previous version, or the previous week for weekly-cadence titles">
            Δ latest
          </th>
          <th class="num">Δ week</th>
          <th class="num">vs avg</th>
          <th>Top complaint</th>
          <th />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.id"
          :class="{ 'is-highlighted': view.highlighted === row.id }"
          :data-title-id="row.id"
        >
          <td>
            <RouterLink :to="`/title/${row.id}`" class="name">{{ row.name }}</RouterLink>
            <span class="pub">{{ row.publisher }}</span>
          </td>
          <td>
            <RouterLink :to="`/category/${row.category.id}`" :style="{ color: row.category.color }">
              {{ row.category.shortName }}
            </RouterLink>
          </td>
          <td class="num"><b :class="bandClass(row.score)">{{ fmtScore(row.score) }}</b></td>
          <td class="num"><DeltaChip :value="row.delta" size="sm" /></td>
          <td class="num"><DeltaChip :value="row.movement.wow" size="sm" /></td>
          <td class="num mono">{{ fmtDelta(row.movement.vsCategoryAvg) }}</td>
          <td class="topic">{{ row.slipping[0] }}</td>
          <td class="num">
            <button type="button" class="cmp" :class="{ on: view.comparison.includes(row.id) }" @click="view.toggleComparison(row.id)">
              {{ view.comparison.includes(row.id) ? '✓' : '+' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.scroller { overflow-x: auto; border: 1px solid var(--line-2); border-radius: var(--radius); }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 780px; }
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
  position: sticky;
  top: 0;
}
td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(95, 191, 127, 0.04); }
.num { text-align: right; white-space: nowrap; }
.num b { font-family: var(--display); font-size: 15px; font-weight: 700; }
.name { display: block; color: var(--ink); font-weight: 600; }
.name:hover { color: var(--green); }
.pub { display: block; font-size: 11.5px; color: var(--ink-4); }
.topic { color: var(--ink-3); font-size: 12.5px; }
.cmp { border: 1px solid var(--line-2); border-radius: 6px; padding: 3px 9px; color: var(--ink-3); font-size: 12px; }
.cmp.on { border-color: var(--green); color: var(--green); }
</style>
