/**
 * Tool registry.
 *
 * Responsibilities:
 *  - wrap every handler in one pipeline: validate → execute → observe → normalise errors;
 *  - register with the host under a single AbortController, which is how the current spec
 *    unregisters (`provideContext`/`unregisterTool` were removed from the draft);
 *  - expose `invoke()` so the in-app console drives the exact same pipeline as the agent,
 *    meaning the demo can never diverge from real behaviour.
 */
import { resolveHost } from './adapter'
import { fail } from './result'
import type {
  ToolInvocation,
  ToolResult,
  ToolSpec,
  WebMcpToolDefinition,
} from './types'
import { validateInput } from './validate'

export type InvocationListener = (invocation: ToolInvocation) => void

export interface RegistrationReport {
  registered: string[]
  failed: Array<{ name: string; reason: string }>
  hostKind: string
}

let counter = 0
const nextId = (): string => `call_${Date.now().toString(36)}_${(counter += 1)}`

/** First line of a result — enough for a log row without dumping the whole payload. */
function summarise(result: ToolResult): string {
  const text = result.content[0]?.text ?? ''
  const firstLine = text.split('\n').find((line) => line.trim().length) ?? ''
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine
}

export class ToolRegistry {
  private readonly specs = new Map<string, ToolSpec<never>>()
  private readonly listeners = new Set<InvocationListener>()
  private controller: AbortController | null = null

  add(specs: Array<ToolSpec<never>>): this {
    for (const spec of specs) this.specs.set(spec.name, spec)
    return this
  }

  list(): Array<ToolSpec<never>> {
    return [...this.specs.values()]
  }

  get(name: string): ToolSpec<never> | undefined {
    return this.specs.get(name)
  }

  onInvocation(listener: InvocationListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(invocation: ToolInvocation): void {
    for (const listener of this.listeners) listener(invocation)
  }

  /**
   * Run a tool by name. Never throws: a thrown handler becomes an `isError` result so the
   * agent gets a readable explanation instead of an opaque host-level failure.
   */
  async invoke(
    name: string,
    input: Record<string, unknown> = {},
    origin: ToolInvocation['origin'] = 'console',
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const spec = this.specs.get(name)
    const startedAt = Date.now()

    if (!spec) {
      const result = fail(`Unknown tool "${name}".`, [
        `Available tools: ${[...this.specs.keys()].join(', ')}`,
      ])
      this.emit({
        id: nextId(),
        tool: name,
        input,
        origin,
        startedAt,
        durationMs: 0,
        ok: false,
        summary: summarise(result),
      })
      return result
    }

    let result: ToolResult
    try {
      const validation = validateInput(spec.inputSchema, input)
      result = validation.ok
        ? await spec.handler(validation.value as never, signal ? { signal } : {})
        : fail(`Invalid arguments for "${name}".`, validation.errors)
    } catch (cause) {
      result = fail(
        `"${name}" failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ['This is a bug in the page, not in your arguments. Try a different tool or reload.'],
      )
    }

    this.emit({
      id: nextId(),
      tool: name,
      input,
      origin,
      startedAt,
      durationMs: Date.now() - startedAt,
      ok: !result.isError,
      summary: summarise(result),
    })
    return result
  }

  /** Register every known tool with the host. Idempotent: re-registering replaces the set. */
  async register(): Promise<RegistrationReport> {
    const { host, kind } = resolveHost()
    this.unregister()

    const report: RegistrationReport = { registered: [], failed: [], hostKind: kind }
    if (!host?.registerTool) return report

    this.controller = new AbortController()
    const { signal } = this.controller

    for (const spec of this.specs.values()) {
      const definition: WebMcpToolDefinition = {
        name: spec.name,
        description: spec.description,
        inputSchema: spec.inputSchema,
        annotations: spec.annotations,
        execute: (input, options) =>
          this.invoke(spec.name, input ?? {}, 'agent', options?.signal),
      }
      try {
        await host.registerTool(definition, { signal })
        report.registered.push(spec.name)
      } catch (cause) {
        report.failed.push({
          name: spec.name,
          reason: cause instanceof Error ? cause.message : String(cause),
        })
      }
    }
    return report
  }

  /** Aborting the registration signal is how tools are withdrawn in the current spec. */
  unregister(): void {
    this.controller?.abort()
    this.controller = null
  }

  get isRegistered(): boolean {
    return this.controller !== null && !this.controller.signal.aborted
  }
}

export const toolRegistry = new ToolRegistry()
