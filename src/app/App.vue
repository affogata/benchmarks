<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { useWebMcp } from '@/webmcp/useWebMcp'
import SiteHeader from '@/widgets/SiteHeader.vue'
import AgentRail from '@/widgets/AgentRail.vue'

const benchmarks = useBenchmarksStore()
const view = useViewStore()
const route = useRoute()
const ready = ref(false)

// Wired up synchronously so the tool layer keeps a live router handle; `start()` then waits
// for the corpus, so an agent never sees a tool that would fail on its first call.
const webmcp = useWebMcp()

onMounted(async () => {
  await benchmarks.load()
  ready.value = true
  await webmcp.start()
})

// Scroll a title into view when a tool (or a deep link) highlights it.
watch(
  () => view.highlighted,
  async (id) => {
    if (!id) return
    await new Promise((resolve) => window.setTimeout(resolve, 60))
    document
      .querySelector(`[data-title-id="${id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  },
)

watch(
  () => route.meta.title,
  (title) => {
    document.title = title
      ? `${String(title)} · Affogata Benchmarks`
      : 'Affogata Benchmarks — customer voice scored by version'
  },
  { immediate: true },
)
</script>

<template>
  <SiteHeader />

  <main>
    <RouterView v-if="ready" v-slot="{ Component }">
      <component :is="Component" />
    </RouterView>

    <div v-else-if="benchmarks.status === 'error'" class="wrap boot">
      <h1>Could not load the benchmark data</h1>
      <p class="lede">{{ benchmarks.error }}</p>
    </div>

    <div v-else class="wrap boot">
      <p class="mono">Loading 79 titles…</p>
    </div>
  </main>

  <footer class="site-foot">
    <div class="wrap">
      <p class="mono">
        Affogata Benchmarks · customer voice scored by version · data mirrored from
        <a href="https://www.affogata.com/benchmarks/" target="_blank" rel="noopener">affogata.com/benchmarks</a>
      </p>
      <p class="disclaimer">{{ benchmarks.meta?.disclaimer }}</p>
    </div>
  </footer>

  <AgentRail v-if="ready" />
</template>

<style scoped>
main { min-height: 70vh; }
.boot { padding: 90px 32px; text-align: center; }
.site-foot {
  margin-top: 60px;
  padding: 34px 0 90px;
  border-top: 1px solid var(--line);
  background: #030608;
}
.site-foot .mono { font-size: 10.5px; line-height: 1.7; }
.disclaimer { margin-top: 8px; font-size: 12px; color: var(--ink-4); max-width: 80ch; }
</style>
