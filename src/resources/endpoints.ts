/**
 * Paths of the public benchmarks API, mirroring `namespace :public` in the backend's
 * `config/routes/api.rb`. Kept in one file so a route rename is a single-line change here.
 */
export const BENCHMARKS_ROOT = '/api/v1/public/benchmarks'

export const ENDPOINTS = {
  snapshot: BENCHMARKS_ROOT,
  meta: `${BENCHMARKS_ROOT}/meta`,
  industries: `${BENCHMARKS_ROOT}/industries`,
  categories: `${BENCHMARKS_ROOT}/categories`,
  titles: `${BENCHMARKS_ROOT}/titles`,
} as const
