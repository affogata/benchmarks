/**
 * Minimal typings for the WebMCP surface (`navigator.modelContext` / `document.modelContext`),
 * per the W3C Web Machine Learning CG draft as implemented in Chrome 149+ and the ChatGPT
 * in-app browser. Typed locally so the app builds anywhere, including browsers without it.
 *
 * @see https://github.com/webmachinelearning/webmcp
 * @see https://developer.chrome.com/docs/ai/webmcp
 */

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array'
  description?: string
  enum?: readonly string[]
  default?: unknown
  minimum?: number
  maximum?: number
  minItems?: number
  maxItems?: number
  items?: { type: 'string' | 'number' }
}

export interface JsonSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
}

export interface ToolAnnotations {
  /** True when the tool only reads state. Agents use this to skip confirmation prompts. */
  readOnlyHint?: boolean
  /** True when the tool returns content authored by third parties (reviews, posts…). */
  untrustedContentHint?: boolean
}

export interface ToolTextContent {
  type: 'text'
  text: string
}

export interface ToolResult {
  content: ToolTextContent[]
  /** Machine-readable payload alongside the prose. Ignored by hosts that do not support it. */
  structuredContent?: unknown
  isError?: boolean
}

export interface ToolExecuteOptions {
  signal?: AbortSignal
}

export interface WebMcpToolDefinition {
  name: string
  description: string
  inputSchema: JsonSchema
  annotations?: ToolAnnotations
  execute(input: Record<string, unknown>, options?: ToolExecuteOptions): Promise<ToolResult>
}

export interface RegisterToolOptions {
  signal?: AbortSignal
  exposedTo?: string[]
}

export interface ModelContextHost {
  registerTool(definition: WebMcpToolDefinition, options?: RegisterToolOptions): Promise<unknown>
  getTools?(options?: { fromOrigins?: string[] }): Promise<unknown[]>
  addEventListener?(type: 'toolchange', listener: () => void): void
  removeEventListener?(type: 'toolchange', listener: () => void): void
}

declare global {
  interface Document {
    modelContext?: ModelContextHost
  }
  interface Navigator {
    modelContext?: ModelContextHost
  }
}

/**
 * A tool as this app defines it: the WebMCP definition plus the metadata the in-app
 * console needs to render and replay it.
 */
export interface ToolSpec<TInput = Record<string, unknown>> {
  name: string
  /** Human label for the in-app tool console. */
  title: string
  description: string
  inputSchema: JsonSchema
  annotations: ToolAnnotations
  /** Grouping for the console UI. */
  group: 'read' | 'act'
  /** Ready-to-run example arguments, shown as one-click samples in the console. */
  examples?: Array<{ label: string; input: Record<string, unknown> }>
  handler(input: TInput, options: ToolExecuteOptions): Promise<ToolResult> | ToolResult
}

export interface ToolInvocation {
  id: string
  tool: string
  input: Record<string, unknown>
  /** Where the call came from: the agent through WebMCP, or the in-app console. */
  origin: 'agent' | 'console'
  startedAt: number
  durationMs: number
  ok: boolean
  summary: string
}
