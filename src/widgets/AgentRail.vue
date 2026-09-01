<script setup lang="ts">
/**
 * Live view of what the agent is doing to this page. Collapsed by default, it pops open
 * on the first tool call so a demo viewer can watch the calls land in real time.
 */
import { computed, ref, watch } from 'vue'
import { useAgentStore } from '@/stores/agent.store'

const agent = useAgentStore()
const open = ref(false)
const pulse = ref(false)

const recent = computed(() => agent.invocations.slice(0, 12))

watch(
  () => agent.lastEventAt,
  (value) => {
    if (!value) return
    open.value = true
    pulse.value = true
    window.setTimeout(() => (pulse.value = false), 900)
  },
)

const time = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const args = (input: Record<string, unknown>): string => {
  const entries = Object.entries(input)
  if (!entries.length) return '{}'
  return entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(', ')
}
</script>

<template>
  <aside class="rail" :class="{ open, pulse }">
    <button class="toggle" type="button" @click="open = !open">
      <span class="dot" :class="{ live: agent.connected }" />
      <span class="mono">Agent activity</span>
      <span class="count">{{ agent.invocations.length }}</span>
      <span class="chev">{{ open ? '▾' : '▴' }}</span>
    </button>

    <div v-if="open" class="body">
      <p class="mono head">
        {{ agent.capabilities?.label ?? 'Detecting host…' }}
        <template v-if="agent.registeredCount"> · {{ agent.registeredCount }} tools registered</template>
      </p>

      <ol v-if="recent.length" class="log">
        <li v-for="entry in recent" :key="entry.id" :class="{ bad: !entry.ok }">
          <div class="row">
            <span class="origin" :class="entry.origin">{{ entry.origin === 'agent' ? 'AGENT' : 'CONSOLE' }}</span>
            <code>{{ entry.tool }}</code>
            <span class="time mono">{{ time(entry.startedAt) }} · {{ entry.durationMs }}ms</span>
          </div>
          <div class="args">{{ args(entry.input) }}</div>
          <div class="summary">{{ entry.summary }}</div>
        </li>
      </ol>
      <p v-else class="empty-log">
        No calls yet. Ask a connected agent something, or run a tool from the
        <RouterLink to="/tools">tool console</RouterLink>.
      </p>

      <button v-if="recent.length" class="clear mono" type="button" @click="agent.clear()">Clear log</button>
    </div>
  </aside>
</template>

<style scoped>
.rail {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 60;
  width: min(400px, calc(100vw - 32px));
  background: rgba(8, 13, 18, 0.97);
  border: 1px solid var(--line-2);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.rail.pulse { border-color: var(--green); }

.toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 11px 14px;
  color: var(--ink-2);
}
.toggle .mono { font-size: 11px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-4); flex: none; }
.dot.live { background: var(--green); box-shadow: 0 0 0 3px rgba(95, 191, 127, 0.2); }
.count {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 10.5px;
  background: var(--bg-raised);
  border: 1px solid var(--line-2);
  border-radius: 999px;
  padding: 1px 8px;
}
.chev { font-size: 10px; color: var(--ink-4); }

.body { border-top: 1px solid var(--line); padding: 12px 14px 14px; max-height: 54vh; overflow-y: auto; }
.head { font-size: 9.5px; margin-bottom: 10px; line-height: 1.5; }

.log { list-style: none; display: flex; flex-direction: column; gap: 10px; }
.log li { border-left: 2px solid var(--green); padding-left: 10px; }
.log li.bad { border-left-color: var(--red); }
.row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.row code { font-family: var(--mono); font-size: 11.5px; color: var(--ink); }
.origin {
  font-family: var(--mono);
  font-size: 8.5px;
  letter-spacing: 0.08em;
  border-radius: 3px;
  padding: 1px 5px;
  border: 1px solid var(--line-2);
  color: var(--ink-3);
}
.origin.agent { color: var(--green); border-color: rgba(95, 191, 127, 0.4); }
.time { font-size: 9.5px; margin-left: auto; }
.args { font-family: var(--mono); font-size: 10.5px; color: var(--ink-4); margin-top: 3px; word-break: break-word; }
.summary { font-size: 12.5px; color: var(--ink-2); margin-top: 4px; line-height: 1.45; }

.empty-log { font-size: 12.5px; color: var(--ink-3); line-height: 1.6; }
.clear { margin-top: 12px; font-size: 10px; color: var(--ink-4); }
.clear:hover { color: var(--green); }
</style>
