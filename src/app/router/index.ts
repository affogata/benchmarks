import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
  type RouteRecordRaw,
  type Router,
} from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), meta: { title: 'Benchmarks' } },
  { path: '/browse', name: 'browse', component: () => import('@/pages/BrowsePage.vue'), meta: { title: 'Browse all titles' } },
  {
    path: '/category/:categoryId',
    name: 'category',
    component: () => import('@/pages/CategoryPage.vue'),
    props: true,
  },
  { path: '/title/:titleId', name: 'title', component: () => import('@/pages/TitlePage.vue'), props: true },
  { path: '/compare', name: 'compare', component: () => import('@/pages/ComparePage.vue') },
  { path: '/tools', name: 'tools', component: () => import('@/pages/ToolsPage.vue'), meta: { title: 'Agent tools' } },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
]

/**
 * History mode by default (clean URLs; the build emits a 404.html so S3 website hosting
 * serves deep links). Set VITE_ROUTER_MODE=hash for buckets without an error document.
 */
export function createAppRouter(): Router {
  const useHash = import.meta.env.VITE_ROUTER_MODE === 'hash'
  const base = import.meta.env.BASE_URL

  return createRouter({
    history: useHash ? createWebHashHistory(base) : createWebHistory(base),
    routes,
    scrollBehavior(to, _from, saved) {
      if (saved) return saved
      if (to.hash) return { el: to.hash, behavior: 'smooth' }
      return { top: 0 }
    },
  })
}
