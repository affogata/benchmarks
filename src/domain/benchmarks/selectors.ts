/**
 * Pure query functions over the corpus. Every read the UI or a WebMCP tool performs
 * goes through here, so a filter fix lands in both at once.
 */
import type { Category, Dataset, Industry, ScoreBand, Title, TitleView, Tone } from './models'

export interface TitleQuery {
  categoryId?: string
  industryId?: string
  /** Free text over name, publisher, and topic clusters. */
  search?: string
  /** Only titles whose gaining/slipping clusters mention this topic. */
  topic?: string
  minScore?: number
  maxScore?: number
  sort?: SortKey
  order?: 'asc' | 'desc'
  limit?: number
}

export type SortKey = 'score' | 'delta' | 'momentum' | 'name' | 'category' | 'volatility'

export const SORT_KEYS: SortKey[] = ['score', 'delta', 'momentum', 'name', 'category', 'volatility']

const norm = (value: string): string => value.trim().toLowerCase()

export function bandFor(bands: ScoreBand[], score: number): ScoreBand {
  return bands.find((band) => score >= band.min && score <= band.max) ?? bands[bands.length - 1]!
}

export function toneFor(bands: ScoreBand[], score: number): Tone {
  return bandFor(bands, score).tone
}

export function findCategory(dataset: Dataset, ref: string): Category | undefined {
  const needle = norm(ref)
  return dataset.categories.find(
    (category) =>
      norm(category.id) === needle ||
      norm(category.name) === needle ||
      norm(category.shortName) === needle ||
      norm(category.name).includes(needle) ||
      norm(category.shortName).includes(needle),
  )
}

export function findIndustry(dataset: Dataset, ref: string): Industry | undefined {
  const needle = norm(ref)
  return dataset.industries.find(
    (industry) => norm(industry.id) === needle || norm(industry.name).includes(needle),
  )
}

/** Resolve a title by id, exact name, or a forgiving partial match. */
export function findTitle(dataset: Dataset, ref: string): Title | undefined {
  const needle = norm(ref)
  const exact = dataset.titles.find(
    (title) => norm(title.id) === needle || norm(title.name) === needle,
  )
  if (exact) return exact
  const slug = needle.replace(/[^a-z0-9]+/g, '-')
  return dataset.titles.find(
    (title) =>
      norm(title.id) === slug ||
      norm(title.name).includes(needle) ||
      norm(title.publisher).includes(needle),
  )
}

/** Every close-enough candidate, so a tool can say "did you mean…" instead of failing flat. */
export function suggestTitles(dataset: Dataset, ref: string, limit = 5): Title[] {
  const needle = norm(ref)
  if (!needle) return []
  const head = needle.slice(0, 3)
  return dataset.titles
    .filter((title) => norm(title.name).includes(head) || norm(title.publisher).includes(head))
    .slice(0, limit)
}

export function toView(dataset: Dataset, title: Title): TitleView {
  const category = dataset.categories.find((item) => item.id === title.categoryId)!
  const industry = dataset.industries.find((item) => item.id === category.industryId)!
  return { ...title, category, industry }
}

/** Absolute week-over-week move — how much noise this title is generating. */
export const momentum = (title: Title): number => Math.abs(title.movement.wow)

/** Spread between the best and worst point of the tracked window. */
export function volatility(title: Title): number {
  const scores = title.history.map((point) => point.score)
  if (!scores.length) return 0
  return round1(Math.max(...scores) - Math.min(...scores))
}

export function matchesTopic(title: Title, topic: string): boolean {
  const needle = norm(topic)
  return [...title.gaining, ...title.slipping].some((cluster) => norm(cluster).includes(needle))
}

export function queryTitles(dataset: Dataset, query: TitleQuery = {}): TitleView[] {
  const { categoryId, industryId, search, topic, minScore, maxScore, limit } = query
  const sort = query.sort ?? 'score'
  const order = query.order ?? (sort === 'name' || sort === 'category' ? 'asc' : 'desc')

  const industryCategoryIds = industryId
    ? new Set(dataset.industries.find((item) => item.id === industryId)?.categoryIds ?? [])
    : null

  const needle = search ? norm(search) : null

  let rows = dataset.titles.filter((title) => {
    if (categoryId && title.categoryId !== categoryId) return false
    if (industryCategoryIds && !industryCategoryIds.has(title.categoryId)) return false
    if (typeof minScore === 'number' && title.score < minScore) return false
    if (typeof maxScore === 'number' && title.score > maxScore) return false
    if (topic && !matchesTopic(title, topic)) return false
    if (needle) {
      const haystack = [title.name, title.publisher, ...title.gaining, ...title.slipping]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  const direction = order === 'asc' ? 1 : -1
  rows = [...rows].sort((a, b) => direction * compareBy(sort, a, b, dataset))

  const views = rows.map((title) => toView(dataset, title))
  return typeof limit === 'number' ? views.slice(0, Math.max(0, limit)) : views
}

function compareBy(sort: SortKey, a: Title, b: Title, dataset: Dataset): number {
  switch (sort) {
    case 'delta':
      return a.delta - b.delta
    case 'momentum':
      return momentum(a) - momentum(b)
    case 'volatility':
      return volatility(a) - volatility(b)
    case 'name':
      return a.name.localeCompare(b.name)
    case 'category': {
      const byCategory = catName(dataset, a).localeCompare(catName(dataset, b))
      return byCategory !== 0 ? byCategory : b.score - a.score
    }
    case 'score':
    default:
      return a.score - b.score
  }
}

const catName = (dataset: Dataset, title: Title): string =>
  dataset.categories.find((category) => category.id === title.categoryId)?.name ?? ''

export const titlesInCategory = (dataset: Dataset, categoryId: string): TitleView[] =>
  queryTitles(dataset, { categoryId, sort: 'score' })

export const categoriesInIndustry = (dataset: Dataset, industryId: string): Category[] =>
  dataset.categories.filter((category) => category.industryId === industryId)

export const round1 = (value: number): number => Math.round(value * 10) / 10
