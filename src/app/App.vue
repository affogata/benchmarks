<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { useWebMcp } from '@/webmcp/useWebMcp'
import SiteHeader from '@/widgets/SiteHeader.vue'
import AgentRail from '@/widgets/AgentRail.vue'
import CompareTray from '@/widgets/CompareTray.vue'

const benchmarks = useBenchmarksStore()
const view = useViewStore()
const route = useRoute()

// Derived from the store, never latched locally: a first load can fail and a later retry —
// a WebMCP call reaching the ready gate, say — can succeed, and the shell has to follow.
const ready = computed(() => benchmarks.status === 'ready')

// Wired up synchronously so the tool layer keeps a live router handle.
const webmcp = useWebMcp()

onMounted(() => {
  // Tools go up before the corpus is fetched, not after: a host that reads the tool list on
  // load must not catch the page mid-request and conclude it offers nothing. The registry's
  // ready gate holds the first *call* until the data lands.
  void webmcp.start()

  benchmarks.load().catch(() => {
    // The store keeps the message; the boot panel below renders it.
  })
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
      <p class="mono">Loading the benchmark corpus…</p>
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

  <!-- Both read the corpus on render, so neither mounts before it is loaded. -->
  <CompareTray v-if="ready" />
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
