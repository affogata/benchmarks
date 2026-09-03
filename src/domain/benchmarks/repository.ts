/**
 * Data access boundary. The app talks to `BenchmarkRepository`, never to a resource or a
 * transport, so swapping the public API for another feed is a one-class change.
 *
 * The repository's own job is narrow: fetch the corpus and refuse to hand up a broken one.
 * Everything about *how* it is fetched lives in `@/resources`.
 */
import { benchmarksApi, type BenchmarksApi } from '@/resources'
import type { Dataset, Title } from './models'

export interface BenchmarkRepository {
  load(): Promise<Dataset>
}

/** A number the arithmetic downstream can survive — NaN and Infinity are not. */
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Structural check with actionable errors — cheaper than a schema dependency.
 *
 * It has to be thorough about references, not just presence: `toView()` joins a title to
 * its category and that category to its industry, and every consumer above it treats both
 * as non-null. A partially deployed API that drops one industry would otherwise surface as
 * `undefined.name` deep inside a component, or as a `TitleView` whose `industry` is quietly
 * missing. Better to refuse the corpus here, where the message can name the offender.
 */
export function assertDataset(value: unknown): asserts value is Dataset {
  const dataset = value as Partial<Dataset>
  if (!dataset || typeof dataset !== 'object') throw new Error('Dataset is not an object')
  if (!Array.isArray(dataset.titles) || !dataset.titles.length) throw new Error('Dataset has no titles')
  if (!Array.isArray(dataset.categories) || !dataset.categories.length)
    throw new Error('Dataset has no categories')
  if (!Array.isArray(dataset.industries) || !dataset.industries.length)
    throw new Error('Dataset has no industries')
  if (!dataset.meta?.bands?.length) throw new Error('Dataset is missing score bands')

  for (const band of dataset.meta.bands) {
    if (!finite(band.min) || !finite(band.max)) {
      throw new Error(`Score band "${band.id}" has a non-numeric range`)
    }
  }

  const industryIds = new Set(dataset.industries.map((industry) => industry.id))
  const categoryIds = new Set(dataset.categories.map((category) => category.id))

  for (const category of dataset.categories) {
    if (!industryIds.has(category.industryId)) {
      throw new Error(`Category "${category.id}" points at unknown industry "${category.industryId}"`)
    }
  }

  // Both directions of the industry/category link are load-bearing: `queryTitles` filters by
  // `Industry.categoryIds`, while `toView` walks `Category.industryId`. They have to agree,
  // or a title can be visible under one path and invisible under the other.
  for (const industry of dataset.industries) {
    if (!Array.isArray(industry.categoryIds)) {
      throw new Error(`Industry "${industry.id}" has no categoryIds`)
    }
    for (const id of industry.categoryIds) {
      const category = dataset.categories.find((item) => item.id === id)
      if (!category) throw new Error(`Industry "${industry.id}" lists unknown category "${id}"`)
      if (category.industryId !== industry.id) {
        throw new Error(
          `Category "${id}" is listed under industry "${industry.id}" but claims "${category.industryId}"`,
        )
      }
    }
  }

  for (const title of dataset.titles) {
    if (!categoryIds.has(title.categoryId)) {
      throw new Error(`Title "${title.id}" points at unknown category "${title.categoryId}"`)
    }
    if (!finite(title.score) || !finite(title.delta)) {
      throw new Error(`Title "${title.id}" has a non-numeric score or delta`)
    }
    if (!Array.isArray(title.history) || title.history.some((point) => !finite(point.score))) {
      throw new Error(`Title "${title.id}" has a malformed history`)
    }
    const movement = title.movement as Partial<Title['movement']> | undefined
    if (!movement || !finite(movement.wow) || !finite(movement.categoryAvg)) {
      throw new Error(`Title "${title.id}" has malformed movement figures`)
    }
  }
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
