/**
 * Derived analytics. Everything here is computed from the corpus rather than stored,
 * so the UI charts and the agent's answers are guaranteed to agree.
 */
import type { Category, Dataset, Title, TitleView } from './models'
import { momentum, queryTitles, round1, toView, volatility } from './selectors'

export interface Distribution {
  strong: number
  mixed: number
  critical: number
}

export interface CategoryAnalytics {
  category: Category
  titleCount: number
  average: number
  median: number
  /** Average published by Affogata for the category; kept alongside the computed one. */
  publishedAverage: number
  spread: number
  leader: TitleView | null
  laggard: TitleView | null
  distribution: Distribution
  topGainers: TitleView[]
  topDroppers: TitleView[]
  risingTopics: TopicCount[]
  fallingTopics: TopicCount[]
}

export interface TopicCount {
  topic: string
  count: number
  titles: string[]
}

export interface MoverRow {
  title: TitleView
  wow: number
}

export interface ComparisonMetric {
  key: string
  label: string
  values: Array<{ titleId: string; value: number | string | null }>
  /** Id of the title that wins this metric, when a winner is meaningful. */
  best: string | null
}

export interface Comparison {
  titles: TitleView[]
  metrics: ComparisonMetric[]
  sharedGaining: string[]
  sharedSlipping: string[]
  /** Topics that appear for exactly one of the compared titles. */
  distinctive: Array<{ titleId: string; gaining: string[]; slipping: string[] }>
  verdict: string
}

export function mean(values: number[]): number {
  if (!values.length) return 0
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const value =
    sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
  return round1(value)
}

export function distribution(dataset: Dataset, titles: Title[]): Distribution {
  const result: Distribution = { strong: 0, mixed: 0, critical: 0 }
  for (const title of titles) {
    const band = dataset.meta.bands.find((b) => title.score >= b.min && title.score <= b.max)
    if (band?.id === 'strong') result.strong += 1
    else if (band?.id === 'mixed') result.mixed += 1
    else result.critical += 1
  }
  return result
}

/** Count how often a topic cluster shows up, and in which titles. */
export function topicCounts(titles: Title[], side: 'gaining' | 'slipping'): TopicCount[] {
  const index = new Map<string, { topic: string; titles: string[] }>()
  for (const title of titles) {
    for (const topic of title[side]) {
      const key = topic.toLowerCase()
      const entry = index.get(key) ?? { topic, titles: [] }
      entry.titles.push(title.name)
      index.set(key, entry)
    }
  }
  return [...index.values()]
    .map((entry) => ({ topic: entry.topic, count: entry.titles.length, titles: entry.titles }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
}

export function categoryAnalytics(dataset: Dataset, category: Category): CategoryAnalytics {
  const views = queryTitles(dataset, { categoryId: category.id, sort: 'score' })
  const scores = views.map((view) => view.score)
  const byWow = [...views].sort((a, b) => b.movement.wow - a.movement.wow)

  return {
    category,
    titleCount: views.length,
    average: mean(scores),
    median: median(scores),
    publishedAverage: category.categoryAvg,
    spread: scores.length ? round1(Math.max(...scores) - Math.min(...scores)) : 0,
    leader: views[0] ?? null,
    laggard: views[views.length - 1] ?? null,
    distribution: distribution(dataset, views),
    topGainers: byWow.filter((view) => view.movement.wow > 0).slice(0, 3),
    topDroppers: byWow.filter((view) => view.movement.wow < 0).reverse().slice(0, 3),
    risingTopics: topicCounts(views, 'gaining').slice(0, 6),
    fallingTopics: topicCounts(views, 'slipping').slice(0, 6),
  }
}

export function movers(
  dataset: Dataset,
  direction: 'gainers' | 'droppers',
  options: { categoryId?: string; limit?: number } = {},
): MoverRow[] {
  const limit = options.limit ?? 5
  const rows = queryTitles(dataset, {
    ...(options.categoryId ? { categoryId: options.categoryId } : {}),
  })
    .map((title) => ({ title, wow: title.movement.wow }))
    .filter((row) => (direction === 'gainers' ? row.wow > 0 : row.wow < 0))
    .sort((a, b) => (direction === 'gainers' ? b.wow - a.wow : a.wow - b.wow))
  return rows.slice(0, limit)
}

/** Corpus-wide headline numbers used by the landing page and the overview tool. */
export function overview(dataset: Dataset) {
  const views = queryTitles(dataset, { sort: 'score' })
  const scores = views.map((view) => view.score)
  return {
    titleCount: views.length,
    categoryCount: dataset.categories.length,
    industryCount: dataset.industries.length,
    average: mean(scores),
    median: median(scores),
    distribution: distribution(dataset, views),
    happiest: views[0] ?? null,
    unhappiest: views[views.length - 1] ?? null,
    biggestGainer: movers(dataset, 'gainers', { limit: 1 })[0] ?? null,
    biggestDropper: movers(dataset, 'droppers', { limit: 1 })[0] ?? null,
    risingTopics: topicCounts(views, 'gaining').slice(0, 8),
    fallingTopics: topicCounts(views, 'slipping').slice(0, 8),
  }
}

export type Overview = ReturnType<typeof overview>

const intersect = (lists: string[][]): string[] => {
  if (!lists.length) return []
  const [first, ...rest] = lists as [string[], ...string[][]]
  return first.filter((item) =>
    rest.every((list) => list.some((other) => other.toLowerCase() === item.toLowerCase())),
  )
}

export function compare(dataset: Dataset, titles: Title[]): Comparison {
  const views = titles.map((title) => toView(dataset, title))

  const numeric = (
    key: string,
    label: string,
    pick: (view: TitleView) => number | null,
    higherIsBetter = true,
  ): ComparisonMetric => {
    const values = views.map((view) => ({ titleId: view.id, value: pick(view) }))
    const scored = values.filter(
      (entry): entry is { titleId: string; value: number } => typeof entry.value === 'number',
    )

    // A tie has no winner. Marking the first of two identical scores as "best" is a claim
    // the numbers do not support, and it is the row the UI puts a badge on.
    const target = scored.length
      ? scored.reduce(
          (winner, entry) =>
            higherIsBetter ? Math.max(winner, entry.value) : Math.min(winner, entry.value),
          scored[0]!.value,
        )
      : null
    const winners = scored.filter((entry) => entry.value === target)
    const best = winners.length === 1 ? winners[0]!.titleId : null

    return { key, label, values, best }
  }

  const metrics: ComparisonMetric[] = [
    numeric('score', 'Impact score', (view) => view.score),
    numeric('delta', 'Change on latest point', (view) => view.delta),
    numeric('wow', 'Week over week', (view) => view.movement.wow),
    numeric('vsCategoryAvg', 'vs category average', (view) => view.movement.vsCategoryAvg),
    numeric('vsLeader', 'vs category leader', (view) => view.movement.vsLeader),
    numeric('storeRating', 'Store rating', (view) => view.storeRating),
    numeric('volatility', 'Volatility across window', (view) => volatility(view), false),
    {
      key: 'category',
      label: 'Category',
      values: views.map((view) => ({ titleId: view.id, value: view.category.name })),
      best: null,
    },
  ]

  const sharedGaining = intersect(views.map((view) => view.gaining))
  const sharedSlipping = intersect(views.map((view) => view.slipping))

  const distinctive = views.map((view) => ({
    titleId: view.id,
    gaining: view.gaining.filter(
      (topic) =>
        !views.some(
          (other) =>
            other.id !== view.id &&
            other.gaining.some((item) => item.toLowerCase() === topic.toLowerCase()),
        ),
    ),
    slipping: view.slipping.filter(
      (topic) =>
        !views.some(
          (other) =>
            other.id !== view.id &&
            other.slipping.some((item) => item.toLowerCase() === topic.toLowerCase()),
        ),
    ),
  }))

  const ranked = [...views].sort((a, b) => b.score - a.score)
  const top = ranked[0]
  const bottom = ranked[ranked.length - 1]
  // "Both" is only true of a pair; three to five titles need a different subject.
  const subject = views.length === 2 ? 'Both are' : 'All of them are'
  const verdict =
    top && bottom && top.id !== bottom.id
      ? `${top.name} leads at ${top.score.toFixed(1)}, ${round1(top.score - bottom.score)} ahead of ${bottom.name} at ${bottom.score.toFixed(1)}.` +
        (sharedSlipping.length
          ? ` ${subject} dragged by ${sharedSlipping.join(' and ').toLowerCase()}.`
          : '')
      : top
        ? `${top.name} scores ${top.score.toFixed(1)}.`
        : 'Nothing to compare.'

  return { titles: views, metrics, sharedGaining, sharedSlipping, distinctive, verdict }
}

export { momentum, volatility }
