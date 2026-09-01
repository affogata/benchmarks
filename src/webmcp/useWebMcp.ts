/**
 * Composition root for the WebMCP layer.
 *
 * Must be called synchronously from `setup()`: `useRouter()` and `onBeforeUnmount()` both
 * depend on the active component instance, which is gone after the first `await`. The
 * returned `start()` is what waits for the dataset, so tools are only offered to an agent
 * once every one of them can answer.
 */
import { onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { useViewStore } from '@/stores/view.store'
import { useAgentStore } from '@/stores/agent.store'
import { describeHost } from './kernel/adapter'
import { toolRegistry, type RegistrationReport } from './kernel/registry'
import { createAllTools, type ToolContext } from './tools'

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

  const stopListening = toolRegistry.onInvocation((invocation) => agent.record(invocation))

  onBeforeUnmount(() => {
    stopListening()
    toolRegistry.unregister()
  })

  async function start(): Promise<RegistrationReport> {
    await benchmarks.load()
    toolRegistry.add(createAllTools(context))
    agent.capabilities = describeHost()
    const report = await toolRegistry.register()
    agent.registration = report
    return report
  }

  return { registry: toolRegistry, start }
}
