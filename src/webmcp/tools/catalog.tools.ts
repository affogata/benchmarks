/** Read tools: browse the corpus, resolve a title, search topic clusters. */
import { defineTool } from '../kernel/defineTool'
import { fail, ok } from '../kernel/result'
import type { ToolSpec } from '../kernel/types'
import type { ToolContext } from './context'
import { categoryAnalytics, volatility } from '@/domain/benchmarks/analytics'
import {
  findCategory,
  findIndustry,
  findTitle,
  queryTitles,
  SORT_KEYS,
  suggestTitles,
  toView,
  type SortKey,
} from '@/domain/benchmarks/selectors'
import { fmtDelta, fmtRating, fmtScore, textTable } from '@/shared/lib/format'

export function createCatalogTools(ctx: ToolContext): Array<ToolSpec<never>> {
  const listCategories = defineTool<{ industry?: string }>({
    name: 'benchmarks_list_categories',
    title: 'List categories',
    group: 'read',
    description:
      'List every benchmark category (16 across 8 industries) with its title count, average customer-voice score and current leader. Start here when you do not yet know which category a brand belongs to.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        industry: {
          type: 'string',
          description:
            'Optional industry filter, e.g. "Gaming", "Fintech", "Travel & Mobility". Omit for all 16 categories.',
        },
      },
    },
    examples: [
      { label: 'All categories', input: {} },
      { label: 'Gaming only', input: { industry: 'Gaming' } },
    ],
    handler: ({ industry }) => {
      const dataset = ctx.dataset()
      const scope = industry ? findIndustry(dataset, industry) : null
      if (industry && !scope) {
        return fail(`No industry matches "${industry}".`, [
          `Known industries: ${dataset.industries.map((item) => item.name).join(', ')}`,
        ])
      }

      const categories = scope
        ? dataset.categories.filter((category) => category.industryId === scope.id)
        : dataset.categories

      const rows = categories.map((category) => {
        const stats = categoryAnalytics(dataset, category)
        return {
          id: category.id,
          name: category.name,
          industry: dataset.industries.find((item) => item.id === category.industryId)?.name ?? '',
          titles: stats.titleCount,
          average: stats.average,
          leader: stats.leader?.name ?? '—',
          leaderScore: stats.leader?.score ?? null,
          laggard: stats.laggard?.name ?? '—',
        }
      })

      const table = textTable(
        ['category_id', 'Category', 'Titles', 'Avg', 'Leader', 'Score'],
        rows.map((row) => [
          row.id,
          row.name,
          row.titles,
          fmtScore(row.average),
          row.leader,
          row.leaderScore === null ? '—' : fmtScore(row.leaderScore),
        ]),
      )

      return ok(
        `${rows.length} ${scope ? `${scope.name} ` : ''}categories.\n\n${table}`,
        {
          data: { categories: rows },
          nextSteps: [
            'benchmarks_list_titles({ category })',
            'benchmarks_open_category({ category }) to show it on screen',
          ],
        },
      )
    },
  })

  const listTitles = defineTool<{
    category?: string
    industry?: string
    search?: string
    min_score?: number
    sort?: SortKey
    limit?: number
  }>({
    name: 'benchmarks_list_titles',
    title: 'List titles',
    group: 'read',
    description:
      'List benchmarked games and apps with their current score, change on the latest release and week-over-week move. Filter by category, industry, free text or minimum score, and sort by score, delta, momentum or volatility.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category id or name, e.g. "trading-apps" or "Match-3 & Puzzle".' },
        industry: { type: 'string', description: 'Industry name, e.g. "Gaming" or "Fintech".' },
        search: { type: 'string', description: 'Free text over title name, publisher and topic clusters.' },
        min_score: { type: 'number', minimum: 0, maximum: 10, description: 'Only titles scoring at least this (0-10).' },
        sort: {
          type: 'string',
          enum: SORT_KEYS,
          default: 'score',
          description:
            'score = current impact, delta = change on latest release, momentum = size of the weekly move, volatility = spread across the tracked window.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 79, default: 20, description: 'Maximum rows to return.' },
      },
    },
    examples: [
      { label: 'Worst-scoring 10', input: { sort: 'score', limit: 10 } },
      { label: 'Fintech leaders', input: { industry: 'Fintech', limit: 11 } },
      { label: 'Search "paywall"', input: { search: 'paywall' } },
    ],
    handler: ({ category, industry, search, min_score, sort, limit }) => {
      const dataset = ctx.dataset()

      const resolvedCategory = category ? findCategory(dataset, category) : null
      if (category && !resolvedCategory) {
        return fail(`No category matches "${category}".`, [
          `Try benchmarks_list_categories. Known ids: ${dataset.categories.map((item) => item.id).join(', ')}`,
        ])
      }
      const resolvedIndustry = industry ? findIndustry(dataset, industry) : null
      if (industry && !resolvedIndustry) {
        return fail(`No industry matches "${industry}".`, [
          `Known industries: ${dataset.industries.map((item) => item.name).join(', ')}`,
        ])
      }

      const rows = queryTitles(dataset, {
        ...(resolvedCategory ? { categoryId: resolvedCategory.id } : {}),
        ...(resolvedIndustry ? { industryId: resolvedIndustry.id } : {}),
        ...(search ? { search } : {}),
        ...(typeof min_score === 'number' ? { minScore: min_score } : {}),
        sort: sort ?? 'score',
        limit: limit ?? 20,
      })

      if (!rows.length) {
        return ok('No titles match those filters.', {
          data: { titles: [] },
          nextSteps: ['benchmarks_list_categories()', 'benchmarks_list_titles({}) for everything'],
        })
      }

      const table = textTable(
        ['title_id', 'Title', 'Category', 'Score', 'Δ release', 'Δ week'],
        rows.map((row) => [
          row.id,
          row.name,
          row.category.shortName,
          fmtScore(row.score),
          fmtDelta(row.delta),
          fmtDelta(row.movement.wow),
        ]),
      )

      const scope = resolvedCategory?.name ?? resolvedIndustry?.name ?? 'all industries'
      return ok(
        `${rows.length} title(s) in ${scope}, sorted by ${sort ?? 'score'}.\n\n${table}`,
        {
          data: {
            scope,
            sort: sort ?? 'score',
            titles: rows.map((row) => ({
              id: row.id,
              name: row.name,
              publisher: row.publisher,
              category: row.category.name,
              score: row.score,
              deltaOnRelease: row.delta,
              weekOverWeek: row.movement.wow,
              gaining: row.gaining,
              slipping: row.slipping,
            })),
          },
          nextSteps: [
            'benchmarks_get_title({ title }) for the full read',
            'benchmarks_compare_titles({ titles })',
          ],
        },
      )
    },
  })

  const getTitle = defineTool<{ title: string }>({
    name: 'benchmarks_get_title',
    title: 'Get title detail',
    group: 'read',
    description:
      'Full customer-voice profile for one game or app: current score, release history, the topic clusters pushing it up and down, the analyst read, movement against its category, and store-review volume where a live pull exists.',
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title id or name, e.g. "revolut" or "Royal Match".' },
      },
      required: ['title'],
    },
    examples: [
      { label: 'Revolut', input: { title: 'Revolut' } },
      { label: 'Baldur’s Gate 3', input: { title: 'baldurs-gate-3' } },
    ],
    handler: ({ title }) => {
      const dataset = ctx.dataset()
      const found = findTitle(dataset, title)
      if (!found) {
        const suggestions = suggestTitles(dataset, title)
        return fail(`No benchmarked title matches "${title}".`, [
          suggestions.length
            ? `Did you mean: ${suggestions.map((item) => item.name).join(', ')}?`
            : 'Call benchmarks_list_titles to see all 79 tracked titles.',
        ])
      }

      const view = toView(dataset, found)
      const { movement } = view
      const basis = view.cadence === 'version' ? 'previous version' : 'last week'

      const history = view.history
        .map((point) => `${point.label} ${fmtScore(point.score)}${point.delta === null ? '' : ` (${fmtDelta(point.delta)})`}`)
        .join('  →  ')

      const lines = [
        `${view.name} — ${fmtScore(view.score)}/10 (${fmtDelta(view.delta)} vs ${basis})`,
        `${view.category.name} · ${view.publisher}${view.release ? ` · ${view.release}` : ''}${view.storeRating ? ` · ${fmtRating(view.storeRating)}` : ''}`,
        '',
        `History: ${history}`,
        `Gaining: ${view.gaining.join(', ')}`,
        `Slipping: ${view.slipping.join(', ')}`,
        '',
        `Movement: ${fmtDelta(movement.wow)} week over week, #${movement.rank} ${movement.rankKind} of ${movement.pool}.`,
        `Category: ${fmtDelta(movement.vsCategoryAvg)} vs the ${fmtScore(movement.categoryAvg)} average; ${
          movement.isLeader
            ? 'this title leads its category.'
            : `${fmtDelta(movement.vsLeader)} vs leader ${movement.leader} (${fmtScore(movement.leaderScore)}).`
        }`,
        `Volatility across the window: ${fmtScore(volatility(view))} points.`,
      ]

      if (view.aiRead) lines.push('', `Analyst read: ${view.aiRead}`)
      if (view.reviewPulse) {
        const pulse = view.reviewPulse
        lines.push(
          '',
          `Store reviews ${pulse.window} (live MCP pull): ${pulse.reviews} reviews (was ${pulse.prevReviews}), ${pulse.positivePct}% positive (was ${pulse.prevPositivePct}%), review impact ${fmtScore(pulse.reviewImpact)} (was ${fmtScore(pulse.prevReviewImpact)}). Sources: ${pulse.sources.map((source) => `${source.name} ${source.count}`).join(', ')}.`,
        )
      }

      return ok(lines.join('\n'), {
        data: {
          id: view.id,
          name: view.name,
          publisher: view.publisher,
          category: { id: view.category.id, name: view.category.name },
          industry: view.industry.name,
          score: view.score,
          deltaOnRelease: view.delta,
          cadence: view.cadence,
          storeRating: view.storeRating,
          release: view.release,
          history: view.history,
          gaining: view.gaining,
          slipping: view.slipping,
          analystRead: view.aiRead,
          movement,
          reviewPulse: view.reviewPulse,
          volatility: volatility(view),
        },
        nextSteps: [
          `benchmarks_open_title({ title: "${view.id}" }) to show it on screen`,
          `benchmarks_compare_titles({ titles: ["${view.id}", "${movement.leader}"] })`,
        ],
      })
    },
  })

  const findByTopic = defineTool<{ topic: string; side?: 'gaining' | 'slipping' | 'both'; limit?: number }>({
    name: 'benchmarks_find_by_topic',
    title: 'Find titles by topic',
    group: 'read',
    description:
      'Search the topic clusters across all 79 titles to find who is being praised or punished for a given theme — "paywall", "support", "ads", "bugs", "pay to win". This is the cross-category view a per-brand lookup cannot give you.',
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Theme to search for, e.g. "support", "paywall", "ads", "odds".' },
        side: {
          type: 'string',
          enum: ['gaining', 'slipping', 'both'],
          default: 'both',
          description: 'gaining = praised for it, slipping = punished for it.',
        },
        limit: { type: 'integer', minimum: 1, maximum: 79, default: 25, description: 'Maximum rows.' },
      },
      required: ['topic'],
    },
    examples: [
      { label: 'Who is punished for paywalls', input: { topic: 'paywall', side: 'slipping' } },
      { label: 'Support problems', input: { topic: 'support', side: 'slipping' } },
    ],
    handler: ({ topic, side, limit }) => {
      const dataset = ctx.dataset()
      const which = side ?? 'both'
      const needle = topic.toLowerCase()

      const matches = dataset.titles
        .map((item) => {
          const gaining = item.gaining.filter((cluster) => cluster.toLowerCase().includes(needle))
          const slipping = item.slipping.filter((cluster) => cluster.toLowerCase().includes(needle))
          return { title: toView(dataset, item), gaining, slipping }
        })
        .filter((row) =>
          which === 'gaining'
            ? row.gaining.length
            : which === 'slipping'
              ? row.slipping.length
              : row.gaining.length || row.slipping.length,
        )
        .sort((a, b) => a.title.score - b.title.score)
        .slice(0, limit ?? 25)

      if (!matches.length) {
        return ok(`No topic cluster mentions "${topic}".`, {
          data: { topic, matches: [] },
          nextSteps: ['Try a broader word such as "support", "ads", "price", "bugs".'],
        })
      }

      const table = textTable(
        ['title_id', 'Title', 'Category', 'Score', 'Matched clusters'],
        matches.map((row) => [
          row.title.id,
          row.title.name,
          row.title.category.shortName,
          fmtScore(row.title.score),
          [
            ...row.gaining.map((cluster) => `▲ ${cluster}`),
            ...row.slipping.map((cluster) => `▼ ${cluster}`),
          ].join(', '),
        ]),
      )

      const averageScore =
        Math.round((matches.reduce((sum, row) => sum + row.title.score, 0) / matches.length) * 10) / 10

      return ok(
        `${matches.length} title(s) where customers talk about "${topic}" (${which}). Their average score is ${fmtScore(averageScore)} against a corpus average of ${fmtScore(
          Math.round((dataset.titles.reduce((sum, item) => sum + item.score, 0) / dataset.titles.length) * 10) / 10,
        )}.\n\n${table}`,
        {
          data: {
            topic,
            side: which,
            averageScore,
            matches: matches.map((row) => ({
              id: row.title.id,
              name: row.title.name,
              category: row.title.category.name,
              score: row.title.score,
              gaining: row.gaining,
              slipping: row.slipping,
            })),
          },
          nextSteps: ['benchmarks_set_view({ topic }) to filter the page to these titles'],
        },
      )
    },
  })

  return [listCategories, listTitles, getTitle, findByTopic] as unknown as Array<ToolSpec<never>>
}
