import type { ToolSpec } from '../kernel/types'
import type { ToolContext } from './context'
import { createCatalogTools } from './catalog.tools'
import { createAnalyticsTools } from './analytics.tools'
import { createNavigationTools } from './navigation.tools'

/** The full surface this page offers an agent: 10 read tools and 5 that drive the UI. */
export function createAllTools(ctx: ToolContext): Array<ToolSpec<never>> {
  return [...createCatalogTools(ctx), ...createAnalyticsTools(ctx), ...createNavigationTools(ctx)]
}

export type { ToolContext }
