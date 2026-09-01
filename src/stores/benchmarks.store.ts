/** Owns the corpus. One load, shared by every page and every WebMCP tool. */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { benchmarkRepository } from '@/domain/benchmarks/repository'
import type { Dataset } from '@/domain/benchmarks/models'
import { overview as buildOverview } from '@/domain/benchmarks/analytics'

export const useBenchmarksStore = defineStore('benchmarks', () => {
  const dataset = shallowRef<Dataset | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref<string | null>(null)

  async function load(): Promise<Dataset> {
    if (dataset.value) return dataset.value
    status.value = 'loading'
    try {
      const loaded = await benchmarkRepository.load()
      dataset.value = loaded
      status.value = 'ready'
      return loaded
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      status.value = 'error'
      throw cause
    }
  }

  /** Non-null accessor for code that runs after `load()` — i.e. everything under the router. */
  const require = (): Dataset => {
    if (!dataset.value) throw new Error('Benchmark dataset accessed before load()')
    return dataset.value
  }

  const meta = computed(() => dataset.value?.meta ?? null)
  const categories = computed(() => dataset.value?.categories ?? [])
  const industries = computed(() => dataset.value?.industries ?? [])
  const titles = computed(() => dataset.value?.titles ?? [])
  const overview = computed(() => (dataset.value ? buildOverview(dataset.value) : null))

  return { dataset, status, error, load, require, meta, categories, industries, titles, overview }
})
