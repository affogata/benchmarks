/**
 * Host detection.
 *
 * WebMCP is served from `document.modelContext`, with `navigator.modelContext` kept as a
 * fallback for earlier builds. Everything below degrades to a plain website when neither
 * exists, so the same bundle works in Safari, Firefox and stock Chrome.
 */
import type { ModelContextHost } from './types'

export type HostKind = 'document' | 'navigator' | 'none'

export interface HostCapabilities {
  available: boolean
  kind: HostKind
  canRegister: boolean
  canListTools: boolean
  canObserveChanges: boolean
  /** Short sentence for the UI badge. */
  label: string
}

export function resolveHost(): { host: ModelContextHost | null; kind: HostKind } {
  if (typeof document !== 'undefined' && document.modelContext) {
    return { host: document.modelContext, kind: 'document' }
  }
  if (typeof navigator !== 'undefined' && navigator.modelContext) {
    return { host: navigator.modelContext, kind: 'navigator' }
  }
  return { host: null, kind: 'none' }
}

export function describeHost(): HostCapabilities {
  const { host, kind } = resolveHost()
  if (!host) {
    return {
      available: false,
      kind: 'none',
      canRegister: false,
      canListTools: false,
      canObserveChanges: false,
      label: 'No WebMCP host — tools run in the built-in console',
    }
  }
  return {
    available: true,
    kind,
    canRegister: typeof host.registerTool === 'function',
    canListTools: typeof host.getTools === 'function',
    canObserveChanges: typeof host.addEventListener === 'function',
    label: `WebMCP host detected on ${kind}.modelContext`,
  }
}
