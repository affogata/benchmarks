/** Identity helper that pins a tool's input type to its schema at the definition site. */
import type { ToolSpec } from './types'

export function defineTool<TInput extends Record<string, unknown>>(
  spec: ToolSpec<TInput>,
): ToolSpec<TInput> {
  return spec
}
