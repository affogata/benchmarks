<script setup lang="ts">
/**
 * The comparison tray — the missing half of the compare feature.
 *
 * Marking a title wrote to `useViewStore.comparison` and nothing else happened: no page
 * acknowledged the click, and the only route to `/compare` was the top-nav link, which
 * reads as unrelated to the "+ Compare" button you just pressed. The comparison itself
 * worked the whole time; it was simply unreachable from the pages that build it.
 *
 * So this appears the moment anything is marked, names what is queued, and puts the
 * comparison one click from where the marking happens. It hides itself on `/compare`,
 * where the page's own controls already do this job.
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { findTitle } from '@/domain/benchmarks/selectors'

const benchmarks = useBenchmarksStore()
const view = useViewStore()
const route = useRoute()

const picked = computed(() =>
  view.comparison
    .map((id) => findTitle(benchmarks.require(), id))
    .filter((title): title is NonNullable<typeof title> => Boolean(title)),
)

/** The comparison needs two. One marked title is a start, not a dead end — say so. */
const ready = computed(() => picked.value.length >= 2)
</script>

<template>
  <aside v-if="picked.length && route.name !== 'compare'" class="tray" aria-label="Comparison tray">
    <span class="mono label">Comparing</span>

    <ul class="chips">
      <li v-for="title in picked" :key="title.id">
        <button
          type="button"
          class="chip"
          :aria-label="`Remove ${title.name} from the comparison`"
          @click="view.toggleComparison(title.id)"
        >
          {{ title.name }} <span aria-hidden="true">×</span>
        </button>
      </li>
    </ul>

    <button type="button" class="clear mono" @click="view.clearComparison()">Clear</button>

    <RouterLink v-if="ready" class="btn btn-primary btn-sm go" to="/compare">
      Compare {{ picked.length }} →
    </RouterLink>
    <span v-else class="mono hint go">Pick one more</span>
  </aside>
</template>

<style scoped>
.tray {
  position: fixed;
  z-index: 61;
  left: 16px;
  bottom: 16px;
  /* Clears the agent rail, which is docked bottom-right at up to 400px wide. */
  right: 432px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(8, 13, 18, 0.97);
  border: 1px solid var(--line-2);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.label { font-size: 10px; color: var(--ink-3); }

.chips { display: flex; flex-wrap: wrap; gap: 6px; list-style: none; margin: 0; padding: 0; }
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ink);
  background: var(--bg-raised);
  border: 1px solid var(--line-2);
  border-radius: 999px;
  padding: 4px 10px;
}
.chip:hover { border-color: var(--red); color: var(--red); }

.clear { font-size: 10.5px; color: var(--ink-3); }
.clear:hover { color: var(--ink); }

.go { margin-left: auto; }
.hint { font-size: 10.5px; color: var(--ink-3); }

@media (max-width: 900px) {
  /* The agent rail goes full width down here, so the tray stacks above it. */
  .tray { right: 16px; bottom: 76px; }
}
</style>
