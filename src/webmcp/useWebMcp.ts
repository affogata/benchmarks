/**
 * Composition root for the WebMCP layer.
 *
 * Must be called synchronously from `setup()`: `useRouter()` and `onBeforeUnmount()` both
 * depend on the active component instance, which is gone after the first `await`.
 *
 * Two things this has to survive, both seen in the wild:
 *
 *  1. **A host that is not there yet.** Extension-injected hosts (the nekuda WebMCP
 *     Workbench among them) can define `modelContext` after the page has booted, and a
 *     one-shot registration at mount silently registers nothing. So the host is polled,
 *     and registration is redone whenever the object identity changes — appearing,
 *     vanishing or being swapped for a new one.
 *  2. **A host that drops the registration.** `toolchange` plus the same poll re-check that
 *     the host still lists our tools, and re-register when it does not.
 *
 * `start()` no longer waits for the corpus. Registering 15 tools behind four API calls left
 * a window of several hundred milliseconds in which a host reading the tool list saw an
 * empty page — the tools are up immediately and the registry's ready gate makes the first
 * *call* wait instead.
 */
import { onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { useAgentStore } from '@/stores/agent.store'
import { describeHost, resolveHost } from './kernel/adapter'
import { toolRegistry, type RegistrationReport } from './kernel/registry'
import type { ModelContextHost } from './kernel/types'
import { createAllTools, type ToolContext } from './tools'

/** How often the host is re-checked. Cheap enough to run for the life of the page. */
const HOST_POLL_MS = 4000

export interface WebMcpHandle {
  registry: typeof toolRegistry
  start(): Promise<RegistrationReport>
}

export function useWebMcp(): WebMcpHandle {
  const benchmarks = useBenchmarksStore()
  const view = useViewStore()
  const agent = useAgentStore()
  const router = useRouter()

  const context: ToolContext = {
    dataset: () => benchmarks.require(),
    view: {
      filters: () => view.filters,
      patch: (next) => view.patch(next),
      reset: () => view.reset(),
      setComparison: (ids) => view.setComparison(ids),
      highlight: (id) => view.highlight(id),
      toggleExpanded: (id, force) => view.toggleExpanded(id, force),
    },
    navigate: (path) => {
      void router.push(path)
    },
    currentPath: () => router.currentRoute.value.path,
  }

  /** The host the current registration belongs to — `null` is a meaningful value here. */
  let knownHost: ModelContextHost | null = null
  let listeningTo: ModelContextHost | null = null
  let inFlight: Promise<RegistrationReport> | null = null
  let poll = 0

  const onToolChange = (): void => {
    void reconcile()
  }

  /** Keep the `toolchange` listener on whichever host object is current. */
  function listen(host: ModelContextHost | null): void {
    if (host === listeningTo) return
    listeningTo?.removeEventListener?.('toolchange', onToolChange)
    host?.addEventListener?.('toolchange', onToolChange)
    listeningTo = host
  }

  /** Re-registers the whole set and republishes what the UI badge reports. */
  function register(): Promise<RegistrationReport> {
    if (inFlight) return inFlight

    inFlight = (async () => {
      const { host } = resolveHost()
      knownHost = host
      listen(host)
      agent.capabilities = describeHost()
      const report = await toolRegistry.register()
      agent.registration = report
      return report
    })().finally(() => {
      inFlight = null
    })

    return inFlight
  }

  async function reconcile(): Promise<void> {
    if (inFlight) return

    const { host } = resolveHost()
    // A different object (or one that has just appeared) never carries our registration.
    if (host !== knownHost) {
      await register()
      return
    }
    if (!host) return

    const live = await toolRegistry.verify()
    if (live && live.length < toolRegistry.list().length) await register()
  }

  const stopListening = toolRegistry.onInvocation((invocation) => agent.record(invocation))

  onBeforeUnmount(() => {
    window.clearInterval(poll)
    listen(null)
    stopListening()
    toolRegistry.unregister()
  })

  async function start(): Promise<RegistrationReport> {
    toolRegistry.add(createAllTools(context))
    // Handlers read the corpus synchronously, so every call waits on this first.
    toolRegistry.setReadyGate(() => benchmarks.load())

    const report = await register()
    poll = window.setInterval(() => void reconcile(), HOST_POLL_MS)
    return report
  }

  return { registry: toolRegistry, start }
}
