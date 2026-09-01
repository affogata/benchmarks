/**
 * Data access boundary. The app talks to `BenchmarkRepository`, never to the JSON file,
 * so swapping the bundled snapshot for a live Affogata MCP feed is a one-class change.
 */
import raw from '@/data/benchmarks.dataset.json'
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

/** Reads the snapshot compiled into the bundle. No network, so it works offline. */
export class StaticBenchmarkRepository implements BenchmarkRepository {
  async load(): Promise<Dataset> {
    const dataset = raw as unknown
    assertDataset(dataset)
    return dataset
  }
}

export const benchmarkRepository: BenchmarkRepository = new StaticBenchmarkRepository()
