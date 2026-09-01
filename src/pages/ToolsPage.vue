<script setup lang="ts">
/**
 * The tool console.
 *
 * It renders the registered tools straight from the registry and runs them through the same
 * `invoke()` pipeline the WebMCP host uses — so what a judge sees here is exactly what an
 * agent gets, including validation errors.
 */
import { computed, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAgentStore } from '@/stores/agent.store'
import { useBenchmarksStore } from '@/stores/benchmarks.store'
import { toolRegistry } from '@/webmcp/kernel/registry'
import type { JsonSchemaProperty, ToolResult } from '@/webmcp/kernel/types'

const agent = useAgentStore()
const benchmarks = useBenchmarksStore()

const tools = computed(() => toolRegistry.list())
const readTools = computed(() => tools.value.filter((tool) => tool.group === 'read'))
const actTools = computed(() => tools.value.filter((tool) => tool.group === 'act'))

const selected = ref<string>('')
const inputs = reactive<Record<string, string>>({})
const result = ref<ToolResult | null>(null)
const running = ref(false)
const showJson = ref(false)

const activeTool = computed(() => tools.value.find((tool) => tool.name === selected.value) ?? null)

function select(name: string): void {
  selected.value = name
  result.value = null
  for (const key of Object.keys(inputs)) delete inputs[key]
  const tool = tools.value.find((item) => item.name === name)
  if (!tool) return
  for (const [key, spec] of Object.entries(tool.inputSchema.properties)) {
    inputs[key] = spec.default !== undefined ? String(spec.default) : ''
  }
}

function applyExample(example: Record<string, unknown>): void {
  for (const key of Object.keys(inputs)) inputs[key] = ''
  for (const [key, value] of Object.entries(example)) {
    inputs[key] = Array.isArray(value) ? value.join(', ') : String(value)
  }
}

async function run(): Promise<void> {
  const tool = activeTool.value
  if (!tool) return
  running.value = true
  const payload: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(inputs)) {
    if (value !== '') payload[key] = value
  }
  try {
    result.value = await toolRegistry.invoke(tool.name, payload, 'console')
  } finally {
    running.value = false
  }
}

const resultText = computed(() => result.value?.content.map((part) => part.text).join('\n') ?? '')

const placeholder = (spec: JsonSchemaProperty): string =>
  spec.enum ? spec.enum.join(' | ') : spec.type === 'array' ? 'comma, separated, values' : spec.type
</script>

<template>
  <div class="wrap">
    <header class="page-head">
      <nav class="crumbs">
        <RouterLink to="/">Benchmarks</RouterLink><span class="sep">›</span><span class="current">Agent tools</span>
      </nav>
      <h1>What an agent can do on this page</h1>
      <p class="lede">
        Every tool below is registered with the browser through
        <code>document.modelContext.registerTool()</code>. Ten of them read the benchmark corpus;
        five drive this UI, so the page moves while the agent talks. Run any of them here — the
        console calls the identical handler an agent would.
      </p>
    </header>

    <section class="status panel" :class="{ live: agent.connected }">
      <div>
        <span class="mono">Host</span>
        <b>{{ agent.capabilities?.label ?? 'detecting…' }}</b>
      </div>
      <div>
        <span class="mono">Registered</span>
        <b>{{ agent.registeredCount }} / {{ tools.length }} tools</b>
      </div>
      <div>
        <span class="mono">Calls this session</span>
        <b>{{ agent.invocations.length }} ({{ agent.agentCallCount }} from an agent)</b>
      </div>
      <div>
        <span class="mono">Dataset</span>
        <b>{{ benchmarks.titles.length }} titles · {{ benchmarks.meta?.reportWeek.label }}</b>
      </div>
    </section>

    <p v-if="!agent.connected" class="hint">
      No WebMCP host here. Open this page in ChatGPT's in-app browser, or in Chrome 149+ with
      <code>chrome://flags/#enable-webmcp-testing</code> enabled, and the same tools register
      automatically. The console below works either way.
    </p>

    <div class="layout">
      <nav class="list">
        <p class="mono group">Read · {{ readTools.length }}</p>
        <button
          v-for="tool in readTools"
          :key="tool.name"
          type="button"
          class="tool"
          :class="{ active: selected === tool.name }"
          @click="select(tool.name)"
        >
          <b>{{ tool.title }}</b>
          <code>{{ tool.name }}</code>
        </button>

        <p class="mono group">Act on the UI · {{ actTools.length }}</p>
        <button
          v-for="tool in actTools"
          :key="tool.name"
          type="button"
          class="tool act"
          :class="{ active: selected === tool.name }"
          @click="select(tool.name)"
        >
          <b>{{ tool.title }}</b>
          <code>{{ tool.name }}</code>
        </button>
      </nav>

      <section v-if="activeTool" class="detail">
        <div class="panel">
          <div class="detail-head">
            <code class="tool-name">{{ activeTool.name }}</code>
            <span class="mono badge" :class="activeTool.annotations.readOnlyHint ? 'ro' : 'rw'">
              {{ activeTool.annotations.readOnlyHint ? 'readOnlyHint' : 'mutates the view' }}
            </span>
          </div>
          <p class="desc">{{ activeTool.description }}</p>

          <div v-if="activeTool.examples?.length" class="examples">
            <span class="mono">Examples</span>
            <button
              v-for="example in activeTool.examples"
              :key="example.label"
              type="button"
              class="ex"
              @click="applyExample(example.input)"
            >
              {{ example.label }}
            </button>
          </div>

          <form class="form" @submit.prevent="run">
            <div
              v-for="(spec, key) in activeTool.inputSchema.properties"
              :key="key"
              class="field-row"
            >
              <label :for="`f-${key}`">
                {{ key }}
                <em v-if="activeTool.inputSchema.required?.includes(key)">required</em>
                <span>{{ spec.description }}</span>
              </label>
              <select v-if="spec.enum" :id="`f-${key}`" v-model="inputs[key]">
                <option value="">—</option>
                <option v-for="option in spec.enum" :key="option" :value="option">{{ option }}</option>
              </select>
              <input v-else :id="`f-${key}`" v-model="inputs[key]" :placeholder="placeholder(spec)" />
            </div>

            <p v-if="!Object.keys(activeTool.inputSchema.properties).length" class="no-args mono">
              No arguments.
            </p>

            <button class="btn btn-primary" type="submit" :disabled="running">
              {{ running ? 'Running…' : '▶ Run tool' }}
            </button>
          </form>
        </div>

        <div v-if="result" class="panel output" :class="{ error: result.isError }">
          <div class="out-head">
            <span class="mono">{{ result.isError ? 'Error result' : 'Tool result' }}</span>
            <button
              v-if="result.structuredContent"
              type="button"
              class="mono toggle"
              @click="showJson = !showJson"
            >
              {{ showJson ? 'show text' : 'show structuredContent' }}
            </button>
          </div>
          <pre v-if="showJson && result.structuredContent">{{ JSON.stringify(result.structuredContent, null, 2) }}</pre>
          <pre v-else>{{ resultText }}</pre>
        </div>
      </section>

      <section v-else class="detail empty-detail">
        <p class="empty">Pick a tool on the left to see its schema and run it.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
code { font-family: var(--mono); font-size: 0.88em; color: var(--green-deep); }

.status { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 16px; }
.status.live { border-color: rgba(95, 191, 127, 0.35); }
.status .mono { display: block; font-size: 9.5px; margin-bottom: 4px; }
.status b { font-family: var(--display); font-size: 14px; color: var(--ink); font-weight: 600; }

.hint {
  font-size: 13.5px;
  color: var(--ink-3);
  border: 1px dashed var(--line-3);
  border-radius: var(--radius);
  padding: 12px 16px;
  margin-bottom: 20px;
  line-height: 1.6;
}

.layout { display: grid; grid-template-columns: minmax(230px, 300px) minmax(0, 1fr); gap: 18px; align-items: start; }

.list { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 88px; }
.group { font-size: 9.5px; margin: 12px 0 4px; }
.tool {
  text-align: left;
  border: 1px solid var(--line-2);
  border-left: 2px solid var(--green);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  padding: 9px 12px;
}
.tool.act { border-left-color: var(--purple); }
.tool:hover { border-color: var(--line-3); }
.tool.active { background: var(--green-soft); border-color: rgba(95, 191, 127, 0.4); }
.tool b { display: block; font-family: var(--display); font-size: 13.5px; color: var(--ink); font-weight: 600; }
.tool code { font-size: 10.5px; color: var(--ink-4); }

.detail { display: flex; flex-direction: column; gap: 14px; }
.detail-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.tool-name { font-size: 14px; color: var(--ink); }
.badge { font-size: 9px; border-radius: 999px; padding: 3px 9px; border: 1px solid var(--line-2); }
.badge.ro { color: var(--green); border-color: rgba(95, 191, 127, 0.4); }
.badge.rw { color: var(--purple); border-color: rgba(216, 204, 255, 0.35); }
.desc { font-size: 14px; line-height: 1.6; color: var(--ink-2); }

.examples { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.examples .mono { font-size: 9.5px; }
.ex {
  font-family: var(--mono);
  font-size: 11px;
  border: 1px dashed rgba(95, 191, 127, 0.45);
  color: var(--green);
  border-radius: 999px;
  padding: 5px 11px;
}
.ex:hover { background: var(--green-soft); }

.form { margin-top: 16px; display: flex; flex-direction: column; gap: 12px; }
.field-row { display: grid; grid-template-columns: minmax(150px, 240px) 1fr; gap: 12px; align-items: start; }
label { font-family: var(--mono); font-size: 11.5px; color: var(--ink-2); }
label em { font-style: normal; color: var(--red); font-size: 9px; margin-left: 5px; }
label span { display: block; font-family: var(--sans); font-size: 11.5px; color: var(--ink-4); margin-top: 3px; line-height: 1.45; }
input, select {
  background: var(--bg-raised);
  border: 1px solid var(--line-2);
  border-radius: var(--radius-sm);
  padding: 8px 11px;
  font-size: 13px;
  color: var(--ink);
  width: 100%;
}
option { background: var(--bg-soft); }
.no-args { font-size: 11px; }

.output { padding: 0; overflow: hidden; }
.output.error { border-color: rgba(246, 82, 114, 0.4); }
.out-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--line-2);
  background: var(--bg-raised);
}
.out-head .mono { font-size: 9.5px; }
.toggle { font-size: 9.5px; color: var(--green); }
pre {
  margin: 0;
  padding: 16px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-2);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60vh;
  overflow: auto;
}

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .list { position: static; }
  .field-row { grid-template-columns: 1fr; }
}
</style>
