/**
 * The view model both the human and the agent manipulate.
 *
 * Every filter a person can set with a click is also reachable from a WebMCP tool, and
 * both paths land in this one store — that is what makes agent actions visible on screen.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SortKey } from '@/domain/benchmarks/selectors'

export type ViewMode = 'grid' | 'table'

/** How many titles the comparison holds. The table stops being readable past this. */
export const MAX_COMPARISON = 5

export interface ViewFilters {
  categoryId: string | null
  industryId: string | null
  search: string
  topic: string | null
  minScore: number | null
  sort: SortKey
  order: 'asc' | 'desc'
  mode: ViewMode
}

const DEFAULTS: ViewFilters = {
  categoryId: null,
  industryId: null,
  search: '',
  topic: null,
  minScore: null,
  sort: 'score',
  order: 'desc',
  mode: 'grid',
}

export const useViewStore = defineStore('view', () => {
  const filters = ref<ViewFilters>({ ...DEFAULTS })
  /** Titles pinned into the comparison tray. */
  const comparison = ref<string[]>([])
  /** Title the UI should scroll to and flash — set by tools and by deep links. */
  const highlighted = ref<string | null>(null)
  /** Title ids with their drill-down panel expanded. */
  const expanded = ref<Set<string>>(new Set())

  function patch(next: Partial<ViewFilters>): ViewFilters {
    filters.value = { ...filters.value, ...next }
    return filters.value
  }

  function reset(): void {
    filters.value = { ...DEFAULTS }
    highlighted.value = null
    expanded.value = new Set()
  }

  function toggleComparison(titleId: string): string[] {
    const list = new Set(comparison.value)
    if (list.has(titleId)) list.delete(titleId)
    else list.add(titleId)
    comparison.value = [...list].slice(0, MAX_COMPARISON)
    return comparison.value
  }

  function setComparison(titleIds: string[]): string[] {
    comparison.value = [...new Set(titleIds)].slice(0, MAX_COMPARISON)
    return comparison.value
  }

  const clearComparison = (): void => {
    comparison.value = []
  }

  function highlight(titleId: string | null): void {
    highlighted.value = titleId
    if (titleId) {
      window.setTimeout(() => {
        if (highlighted.value === titleId) highlighted.value = null
      }, 2600)
    }
  }

  function toggleExpanded(titleId: string, force?: boolean): boolean {
    const next = new Set(expanded.value)
    const shouldOpen = force ?? !next.has(titleId)
    if (shouldOpen) next.add(titleId)
    else next.delete(titleId)
    expanded.value = next
    return shouldOpen
  }

  return {
    filters,
    comparison,
    highlighted,
    expanded,
    patch,
    reset,
    toggleComparison,
    setComparison,
    clearComparison,
    highlight,
    toggleExpanded,
  }
})
