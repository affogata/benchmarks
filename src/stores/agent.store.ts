/**
 * Observability for agent activity.
 *
 * Every tool call — whether it arrived over WebMCP or from the in-app console — lands here
 * and is rendered in the activity rail. An agent operating a page invisibly is impossible
 * to trust or debug; this makes each call, its arguments and its outcome legible.
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { HostCapabilities } from '@/webmcp/kernel/adapter'
import type { RegistrationReport } from '@/webmcp/kernel/registry'
import type { ToolInvocation } from '@/webmcp/kernel/types'

const MAX_LOG = 60

export const useAgentStore = defineStore('agent', () => {
  const capabilities = ref<HostCapabilities | null>(null)
  const registration = ref<RegistrationReport | null>(null)
  const invocations = ref<ToolInvocation[]>([])
  /** Pulses when a call lands, so the UI can flash the rail. */
  const lastEventAt = ref(0)

  function record(invocation: ToolInvocation): void {
    invocations.value = [invocation, ...invocations.value].slice(0, MAX_LOG)
    lastEventAt.value = Date.now()
  }

  const clear = (): void => {
    invocations.value = []
  }

  const connected = computed(() => Boolean(capabilities.value?.available))
  const registeredCount = computed(() => registration.value?.registered.length ?? 0)
  const agentCallCount = computed(
    () => invocations.value.filter((invocation) => invocation.origin === 'agent').length,
  )

  return {
    capabilities,
    registration,
    invocations,
    lastEventAt,
    record,
    clear,
    connected,
    registeredCount,
    agentCallCount,
  }
})
