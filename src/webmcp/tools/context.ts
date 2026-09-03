/**
 * Everything the tool handlers are allowed to touch.
 *
 * Passing this in (instead of importing stores directly) keeps handlers unit-testable and
 * makes the blast radius of a tool explicit: it can read the corpus, change the view, and
 * navigate — nothing else.
 */
import type { Dataset } from '@/domain/benchmarks/models'
import type { ViewFilters } from '@/stores/view.store'

export interface ToolContext {
  /** Throws if called before the dataset resolves; the app registers tools after load. */
  dataset(): Dataset
  view: {
    filters(): ViewFilters
    /** Live comparison ids — what the chips on /compare show *now*, human edits included. */
    comparison(): string[]
    patch(next: Partial<ViewFilters>): ViewFilters
    reset(): void
    setComparison(ids: string[]): string[]
    highlight(id: string | null): void
    toggleExpanded(id: string, force?: boolean): boolean
  }
  navigate(path: string): void
  /** Path plus query — the shareable URL of what is on screen, not just the route. */
  currentHref(): string
}
