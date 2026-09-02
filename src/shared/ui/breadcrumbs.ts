/** One step in a breadcrumb trail. A crumb without `to` renders as plain text. */
import type { RouteLocationRaw } from 'vue-router'

export interface Crumb {
  label: string
  to?: RouteLocationRaw
}
