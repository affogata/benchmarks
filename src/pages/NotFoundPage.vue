<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="wrap boot">
    <h1>Page not found</h1>
    <p class="lede">
      That route does not exist. <RouterLink to="/">Back to the benchmarks</RouterLink> or
      <RouterLink to="/browse">browse every title</RouterLink>.
    </p>
  </div>
</template>

<style scoped>
.boot { padding: 90px 32px; text-align: center; }
.lede { margin: 12px auto 0; }
</style>
