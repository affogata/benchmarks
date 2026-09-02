/**
 * Data access boundary. The app talks to `BenchmarkRepository`, never to a resource or a
 * transport, so swapping the public API for another feed is a one-class change.
 *
 * The repository's own job is narrow: fetch the corpus and refuse to hand up a broken one.
 * Everything about *how* it is fetched lives in `@/resources`.
 */
import { benchmarksApi, type BenchmarksApi } from '@/resources'
import type { Dataset } from './models'

export interface BenchmarkRepository {
  load(): Promise<Dataset>
}

/** Structural check with actionable errors — cheaper than a schema dependency. */
export function assertDataset(value: unknown): asserts value is Dataset {
  const dataset = value as Partial<Dataset>
  if (!dataset || typeof dataset !== 'object') throw new Error('Dataset is not an object')
  if (!Array.isArray(dataset.titles) || !dataset.titles.length) throw new Error('Dataset has no titles')
  if (!Array.isArray(dataset.categories) || !dataset.categories.length)
    throw new Error('Dataset has no categories')
  if (!Array.isArray(dataset.industries) || !dataset.industries.length)
    throw new Error('Dataset has no industries')
  if (!dataset.meta?.bands?.length) throw new Error('Dataset is missing score bands')

  const categoryIds = new Set(dataset.categories.map((category) => category.id))
  const orphan = dataset.titles.find((title) => !categoryIds.has(title.categoryId))
  if (orphan) throw new Error(`Title "${orphan.id}" points at unknown category "${orphan.categoryId}"`)
}

/**
 * Assembles the corpus from the four entity endpoints, then asserts it before releasing it.
 *
 * The requests are issued together rather than in sequence, so the boot cost is one round
 * trip, not four. `Promise.all` also gives the right failure behaviour: every part is
 * required to make a `Dataset`, so the first rejection is the one worth reporting — and the
 * `ApiError` it carries names the endpoint that actually failed.
 */
export class HttpBenchmarkRepository implements BenchmarkRepository {
  constructor(private readonly api: BenchmarksApi = benchmarksApi) {}

  async load(): Promise<Dataset> {
    const [meta, industries, categories, titles] = await Promise.all([
      this.api.meta.get(),
      this.api.industries.list(),
      this.api.categories.list(),
      this.api.titles.list(),
    ])

    const dataset = { meta, industries, categories, titles }
    assertDataset(dataset)
    return dataset
  }
}

export const benchmarkRepository: BenchmarkRepository = new HttpBenchmarkRepository()
