/**
 * Result builders.
 *
 * Tool output is written for a reader that cannot see the screen: a short verdict first,
 * then the supporting table, then a pointer to what the UI now shows. `structuredContent`
 * carries the same facts as JSON for hosts that can consume it.
 */
import type { ToolResult } from './types'

export interface OkOptions {
  /** Machine-readable mirror of the prose. */
  data?: unknown
  /** Follow-up calls worth making — real tool names, so the agent can chain them. */
  nextSteps?: string[]
  /** What changed on screen, when the tool mutated the view. */
  uiEffect?: string
}

export function ok(text: string, options: OkOptions = {}): ToolResult {
  const parts = [text.trim()]
  if (options.uiEffect) parts.push(`\n[UI] ${options.uiEffect}`)
  if (options.nextSteps?.length) parts.push(`\nNext: ${options.nextSteps.join(' · ')}`)

  const result: ToolResult = { content: [{ type: 'text', text: parts.join('\n') }] }
  if (options.data !== undefined) result.structuredContent = options.data
  return result
}

/** An error the agent can act on: what went wrong, plus how to call it correctly. */
export function fail(message: string, hints: string[] = []): ToolResult {
  const text = hints.length ? `${message}\n${hints.map((hint) => `· ${hint}`).join('\n')}` : message
  return { content: [{ type: 'text', text }], isError: true }
}
