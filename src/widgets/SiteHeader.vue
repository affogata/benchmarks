<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAgentStore } from '@/stores/agent.store'

const agent = useAgentStore()
const open = ref(false)
</script>

<template>
  <header class="nav">
    <div class="wrap inner">
      <RouterLink to="/" class="logo">
        affogata<span>/benchmarks</span>
      </RouterLink>

      <button class="burger" type="button" aria-label="Toggle menu" @click="open = !open">☰</button>

      <nav class="links" :class="{ open }" @click="open = false">
        <RouterLink to="/browse">Browse</RouterLink>
        <RouterLink to="/compare">Compare</RouterLink>
        <RouterLink to="/tools">Agent tools</RouterLink>
        <a href="https://www.affogata.com/benchmarks/" target="_blank" rel="noopener">Source ↗</a>
        <RouterLink to="/tools" class="status" :class="{ live: agent.connected }">
          <span class="dot" />
          {{ agent.connected ? `WebMCP live · ${agent.registeredCount} tools` : 'WebMCP ready · console' }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(4, 7, 9, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}
.inner { display: flex; align-items: center; gap: 24px; height: 62px; }
.logo { font-family: var(--display); font-weight: 700; font-size: 19px; color: var(--ink); letter-spacing: -0.02em; }
.logo span { color: var(--green); }
.links { display: flex; gap: 22px; margin-left: auto; align-items: center; }
.links a { font-family: var(--display); font-weight: 500; font-size: 14.5px; color: var(--ink-2); }
.links a:hover, .links a.router-link-active { color: var(--green); }

.status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--mono) !important;
  font-size: 11px !important;
  border: 1px solid var(--line-2);
  border-radius: 999px;
  padding: 6px 12px;
  color: var(--ink-3) !important;
}
.status.live { border-color: rgba(95, 191, 127, 0.45); color: var(--green) !important; background: var(--green-soft); }
.dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.status.live .dot { box-shadow: 0 0 0 3px rgba(95, 191, 127, 0.18); }

.burger { display: none; margin-left: auto; border: 1.5px solid var(--line-2); border-radius: 7px; padding: 6px 10px; color: var(--ink); }

@media (max-width: 900px) {
  .burger { display: block; }
  .links {
    display: none;
    position: absolute;
    top: 62px;
    left: 0;
    right: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
    padding: 18px 22px;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .links.open { display: flex; }
}
</style>
