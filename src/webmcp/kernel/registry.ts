/**
 * Tool registry.
 *
 * Responsibilities:
 *  - wrap every handler in one pipeline: validate → execute → observe → normalise errors;
 *  - register with the host under a single AbortController, which is how the current spec
 *    unregisters (`provideContext`/`unregisterTool` were removed from the draft);
 *  - expose `invoke()` so the in-app console drives the exact same pipeline as the agent,
 *    meaning the demo can never diverge from real behaviour.
 *
 * Registration deliberately does not wait for the corpus. A host that reads the tool list
 * on load must not see an empty page just because four API calls are still in flight, so
 * the tools go up immediately and `setReadyGate()` holds each *invocation* until the data
 * it needs has arrived.
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

/** A call the caller withdrew before it ran — never a page bug, so it says so plainly. */
const aborted = (name: string): ToolResult =>
  fail(`"${name}" was cancelled before it ran.`, ['Nothing on the page changed.'])

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
  private gate: (() => Promise<unknown>) | null = null

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
   * Gate every invocation behind a promise — the corpus load. Registration happens at boot
   * so the host sees the full surface straight away; the wait moves to the first call,
   * where it is a few hundred milliseconds instead of a missing tool.
   */
  setReadyGate(gate: () => Promise<unknown>): this {
    this.gate = gate
    return this
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
    const startedAt = Date.now()
    const result = await this.run(name, input, signal)

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

  private async run(
    name: string,
    input: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const spec = this.specs.get(name)
    if (!spec) {
      return fail(`Unknown tool "${name}".`, [
        `Available tools: ${[...this.specs.keys()].join(', ')}`,
      ])
    }

    // Checked here and again after the gate: an agent that cancels mid-wait must not have
    // its `open_category` land on screen a second later. Handlers themselves run
    // synchronously, so nothing can be aborted part-way through one.
    if (signal?.aborted) return aborted(name)

    if (this.gate) {
      // `.then(onOk, onErr)` rather than try/catch: a gate rejection is a data problem with
      // its own message, not the handler bug the catch below reports.
      const blocked = await this.gate().then(
        () => null,
        (cause: unknown) => (cause instanceof Error ? cause.message : String(cause)),
      )
      if (blocked) {
        return fail(`"${name}" cannot answer yet — the page has no benchmark data.`, [
          blocked,
          'Reload the page and try again.',
        ])
      }
    }

    if (signal?.aborted) return aborted(name)

    try {
      const validation = validateInput(spec.inputSchema, input)
      return validation.ok
        ? await spec.handler(validation.value as never, signal ? { signal } : {})
        : fail(`Invalid arguments for "${name}".`, validation.errors)
    } catch (cause) {
      return fail(
        `"${name}" failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        ['This is a bug in the page, not in your arguments. Try a different tool or reload.'],
      )
    }
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

  /**
   * Which of this page's tools the host still reports.
   *
   * `null` means "cannot be asked" (no host, or no `getTools`), which is not the same as
   * an empty list: only a host that answers and omits our tools is evidence that the
   * registration was lost and has to be redone.
   */
  async verify(): Promise<string[] | null> {
    const { host } = resolveHost()
    if (!host?.getTools) return null

    try {
      const tools = (await host.getTools()) as Array<{ name?: unknown }>
      return tools
        .map((tool) => (typeof tool?.name === 'string' ? tool.name : ''))
        .filter((name) => this.specs.has(name))
    } catch {
      return null
    }
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
