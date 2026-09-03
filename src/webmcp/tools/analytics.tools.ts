/** Read tools that compute rather than look up: category stats, movers, comparison, export. */
import { defineTool } from '../kernel/defineTool'
import { fail, ok } from '../kernel/result'
import type { ToolSpec } from '../kernel/types'
import type { ToolContext } from './context'
import { categoryAnalytics, compare, movers, overview } from '@/domain/benchmarks/analytics'
import type { Title } from '@/domain/benchmarks/models'
import { distinctTitles, findCategory, findIndustry, findTitle, queryTitles, suggestTitles } from '@/domain/benchmarks/selectors'
import { fmtDelta, fmtScore, textTable } from '@/shared/lib/format'

export function createAnalyticsTools(ctx: ToolContext): Array<ToolSpec<never>> {
  const getOverview = defineTool<Record<string, never>>({
    name: 'benchmarks_get_overview',
    title: 'Corpus overview',
    group: 'read',
    description:
      'Headline state of the whole benchmark: how many titles are strong, mixed or critical this week, the happiest and unhappiest customer bases, the biggest weekly mover, and the topics rising and falling across the whole corpus.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    examples: [{ label: 'This week at a glance', input: {} }],
    handler: () => {
      const dataset = ctx.dataset()
      const stats = overview(dataset)
      const { distribution: dist } = stats

      const lines = [
        `${stats.titleCount} titles across ${stats.categoryCount} categories and ${stats.industryCount} industries. Corpus average ${fmtScore(stats.average)}, median ${fmtScore(stats.median)}.`,
        `Distribution: ${dist.strong} strong (7+), ${dist.mixed} mixed (4-7), ${dist.critical} critical (under 4).`,
        '',
        stats.happiest ? `Happiest customers: ${stats.happiest.name} (${stats.happiest.category.name}) at ${fmtScore(stats.happiest.score)}.` : '',
        stats.unhappiest ? `Needs the most love: ${stats.unhappiest.name} (${stats.unhappiest.category.name}) at ${fmtScore(stats.unhappiest.score)}.` : '',
        stats.biggestGainer
          ? `Biggest weekly gain: ${stats.biggestGainer.title.name} ${fmtDelta(stats.biggestGainer.wow)}.`
          : '',
        stats.biggestDropper
          ? `Biggest weekly drop: ${stats.biggestDropper.title.name} ${fmtDelta(stats.biggestDropper.wow)}.`
          : '',
        '',
        `Topics lifting scores: ${stats.risingTopics.slice(0, 5).map((topic) => `${topic.topic} (${topic.count})`).join(', ')}.`,
        `Topics dragging scores: ${stats.fallingTopics.slice(0, 5).map((topic) => `${topic.topic} (${topic.count})`).join(', ')}.`,
      ].filter(Boolean)

      return ok(lines.join('\n'), {
        data: {
          totals: dataset.meta.totals,
          average: stats.average,
          median: stats.median,
          distribution: dist,
          happiest: stats.happiest && { id: stats.happiest.id, name: stats.happiest.name, score: stats.happiest.score },
          unhappiest:
            stats.unhappiest && { id: stats.unhappiest.id, name: stats.unhappiest.name, score: stats.unhappiest.score },
          biggestGainer:
            stats.biggestGainer && { id: stats.biggestGainer.title.id, name: stats.biggestGainer.title.name, wow: stats.biggestGainer.wow },
          biggestDropper:
            stats.biggestDropper && { id: stats.biggestDropper.title.id, name: stats.biggestDropper.title.name, wow: stats.biggestDropper.wow },
          risingTopics: stats.risingTopics,
          fallingTopics: stats.fallingTopics,
        },
        nextSteps: ['benchmarks_get_movers({ direction: "droppers" })', 'benchmarks_list_categories()'],
      })
    },
  })

  const getCategoryAnalytics = defineTool<{ category: string }>({
    name: 'benchmarks_get_category_analytics',
    title: 'Category analytics',
    group: 'read',
    description:
      'Deep read on one category: average and median score, spread, leader and laggard, the strong/mixed/critical split, this week’s gainers and droppers, and the topic clusters most often lifting or dragging titles in that category.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category id or name, e.g. "dating-apps" or "Social Casino".' },
      },
      required: ['category'],
    },
    examples: [
      { label: 'Dating & Social', input: { category: 'dating-apps' } },
      { label: 'Match-3 & Puzzle', input: { category: 'match-3' } },
    ],
    handler: ({ category }) => {
      const dataset = ctx.dataset()
      const found = findCategory(dataset, category)
      if (!found) {
        return fail(`No category matches "${category}".`, [
          `Known ids: ${dataset.categories.map((item) => item.id).join(', ')}`,
        ])
      }

      const stats = categoryAnalytics(dataset, found)
      const table = textTable(
        ['title_id', 'Title', 'Score', 'Δ week', 'vs avg'],
        queryTitles(dataset, { categoryId: found.id, sort: 'score' }).map((row) => [
          row.id,
          row.name,
          fmtScore(row.score),
          fmtDelta(row.movement.wow),
          fmtDelta(row.movement.vsCategoryAvg),
        ]),
      )

      const lines = [
        `${found.name} — ${stats.titleCount} titles, average ${fmtScore(stats.average)}, median ${fmtScore(stats.median)}, spread ${fmtScore(stats.spread)} points.`,
        stats.leader && stats.laggard
          ? `Leader ${stats.leader.name} at ${fmtScore(stats.leader.score)}; weakest ${stats.laggard.name} at ${fmtScore(stats.laggard.score)}.`
          : '',
        `Split: ${stats.distribution.strong} strong / ${stats.distribution.mixed} mixed / ${stats.distribution.critical} critical.`,
        '',
        stats.topGainers.length
          ? `Gaining this week: ${stats.topGainers.map((row) => `${row.name} ${fmtDelta(row.movement.wow)}`).join(', ')}.`
          : 'No title gained ground this week.',
        stats.topDroppers.length
          ? `Dropping this week: ${stats.topDroppers.map((row) => `${row.name} ${fmtDelta(row.movement.wow)}`).join(', ')}.`
          : 'No title lost ground this week.',
        '',
        `Most common praise: ${stats.risingTopics.slice(0, 4).map((topic) => `${topic.topic} (${topic.count})`).join(', ')}.`,
        `Most common complaint: ${stats.fallingTopics.slice(0, 4).map((topic) => `${topic.topic} (${topic.count})`).join(', ')}.`,
        '',
        table,
      ].filter(Boolean)

      return ok(lines.join('\n'), {
        data: {
          category: { id: found.id, name: found.name, audience: found.audience },
          average: stats.average,
          median: stats.median,
          publishedAverage: stats.publishedAverage,
          spread: stats.spread,
          distribution: stats.distribution,
          leader: stats.leader && { id: stats.leader.id, name: stats.leader.name, score: stats.leader.score },
          laggard: stats.laggard && { id: stats.laggard.id, name: stats.laggard.name, score: stats.laggard.score },
          topGainers: stats.topGainers.map((row) => ({ id: row.id, name: row.name, wow: row.movement.wow })),
          topDroppers: stats.topDroppers.map((row) => ({ id: row.id, name: row.name, wow: row.movement.wow })),
          risingTopics: stats.risingTopics,
          fallingTopics: stats.fallingTopics,
        },
        nextSteps: [`benchmarks_open_category({ category: "${found.id}" }) to show this on screen`],
      })
    },
  })

  const getMovers = defineTool<{ direction?: 'gainers' | 'droppers'; category?: string; limit?: number }>({
    name: 'benchmarks_get_movers',
    title: 'Weekly movers',
    group: 'read',
    description:
      'Rank titles by week-over-week movement to find what changed since the last report — the fastest way to spot a release that just went wrong or a fix that landed.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['gainers', 'droppers'],
          default: 'droppers',
          description: 'gainers = improving, droppers = deteriorating.',
        },
        category: { type: 'string', description: 'Optional category id or name to scope the ranking.' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: 'How many rows.' },
      },
    },
    examples: [
      { label: 'Biggest drops', input: { direction: 'droppers', limit: 5 } },
      { label: 'Gaming gainers', input: { direction: 'gainers', category: 'rpg-gacha' } },
    ],
    handler: ({ direction, category, limit }) => {
      const dataset = ctx.dataset()
      const which = direction ?? 'droppers'
      const found = category ? findCategory(dataset, category) : null
      if (category && !found) {
        return fail(`No category matches "${category}".`, [
          `Known ids: ${dataset.categories.map((item) => item.id).join(', ')}`,
        ])
      }

      const rows = movers(dataset, which, {
        ...(found ? { categoryId: found.id } : {}),
        limit: limit ?? 5,
      })

      if (!rows.length) {
        return ok(`No ${which} ${found ? `in ${found.name} ` : ''}this week.`, { data: { movers: [] } })
      }

      const table = textTable(
        ['title_id', 'Title', 'Category', 'Δ week', 'Now', 'Was'],
        rows.map((row) => [
          row.title.id,
          row.title.name,
          row.title.category.shortName,
          fmtDelta(row.wow),
          fmtScore(row.title.movement.thisWeek),
          fmtScore(row.title.movement.lastWeek),
        ]),
      )

      const worst = rows[0]!
      const headline =
        which === 'droppers'
          ? `${worst.title.name} fell the hardest (${fmtDelta(worst.wow)}), driven by ${worst.title.slipping.slice(0, 2).join(' and ').toLowerCase()}.`
          : `${worst.title.name} gained the most (${fmtDelta(worst.wow)}), driven by ${worst.title.gaining.slice(0, 2).join(' and ').toLowerCase()}.`

      return ok(
        `Top ${rows.length} ${which}${found ? ` in ${found.name}` : ''}.\n${headline}\n\n${table}`,
        {
          data: {
            direction: which,
            category: found?.id ?? null,
            movers: rows.map((row) => ({
              id: row.title.id,
              name: row.title.name,
              category: row.title.category.name,
              wow: row.wow,
              thisWeek: row.title.movement.thisWeek,
              lastWeek: row.title.movement.lastWeek,
              slipping: row.title.slipping,
              gaining: row.title.gaining,
            })),
          },
          nextSteps: ['benchmarks_get_title({ title }) to see why'],
        },
      )
    },
  })

  const compareTitles = defineTool<{ titles: string[] }>({
    name: 'benchmarks_compare_titles',
    title: 'Compare titles',
    group: 'read',
    description:
      'Compare 2 to 5 titles side by side across score, release delta, weekly movement, category position, store rating and volatility, plus the topic clusters they share and the ones unique to each. Works across categories.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        titles: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5,
          description: 'Two to five title ids or names, e.g. ["tinder", "hinge", "bumble"].',
        },
      },
      required: ['titles'],
    },
    examples: [
      { label: 'Dating big three', input: { titles: ['tinder', 'hinge', 'bumble'] } },
      { label: 'Robinhood vs Trading 212', input: { titles: ['robinhood', 'trading-212'] } },
    ],
    handler: ({ titles }) => {
      const dataset = ctx.dataset()
      const resolved: Title[] = []
      const missing: string[] = []

      for (const ref of titles) {
        const found = findTitle(dataset, ref)
        if (found) resolved.push(found)
        else missing.push(ref)
      }

      if (missing.length) {
        return fail(`Could not resolve: ${missing.join(', ')}.`, [
          ...missing.map((ref) => {
            const hints = suggestTitles(dataset, ref)
            return hints.length
              ? `"${ref}" → did you mean ${hints.map((item) => item.name).join(', ')}?`
              : `"${ref}" has no close match.`
          }),
          'Call benchmarks_list_titles to see valid ids.',
        ])
      }

      // Dedupe before the count, not after: ["paypal", "paypal"] is one title, and a
      // comparison of a title with itself is a table of zeroes dressed up as a finding.
      const unique = distinctTitles(resolved)
      if (unique.length < 2) {
        return fail('Give at least two distinct titles to compare.', [
          `Resolved to: ${unique.map((item) => item.name).join(', ') || 'nothing'}.`,
        ])
      }

      const result = compare(dataset, unique)
      const table = textTable(
        ['Metric', ...result.titles.map((view) => view.name)],
        result.metrics.map((metric) => [
          metric.label,
          ...metric.values.map((entry) =>
            entry.value === null
              ? '—'
              : typeof entry.value === 'number'
                ? metric.key === 'score' || metric.key === 'storeRating' || metric.key === 'volatility'
                  ? fmtScore(entry.value)
                  : fmtDelta(entry.value)
                : String(entry.value),
          ),
        ]),
      )

      const lines = [
        result.verdict,
        '',
        table,
        '',
        result.sharedGaining.length ? `Shared strengths: ${result.sharedGaining.join(', ')}.` : 'No strength is shared by all of them.',
        result.sharedSlipping.length ? `Shared weaknesses: ${result.sharedSlipping.join(', ')}.` : 'No weakness is shared by all of them.',
        '',
        ...result.distinctive
          .filter((entry) => entry.gaining.length || entry.slipping.length)
          .map((entry) => {
            const view = result.titles.find((item) => item.id === entry.titleId)!
            const bits: string[] = []
            if (entry.gaining.length) bits.push(`only it is praised for ${entry.gaining.join(', ').toLowerCase()}`)
            if (entry.slipping.length) bits.push(`only it is hit on ${entry.slipping.join(', ').toLowerCase()}`)
            return `${view.name}: ${bits.join('; ')}.`
          }),
      ]

      return ok(lines.join('\n'), {
        data: {
          verdict: result.verdict,
          titles: result.titles.map((view) => ({
            id: view.id,
            name: view.name,
            category: view.category.name,
            score: view.score,
            delta: view.delta,
            weekOverWeek: view.movement.wow,
            gaining: view.gaining,
            slipping: view.slipping,
          })),
          metrics: result.metrics,
          sharedGaining: result.sharedGaining,
          sharedSlipping: result.sharedSlipping,
          distinctive: result.distinctive,
        },
        nextSteps: [
          `benchmarks_compare_in_ui({ titles: [${result.titles.map((view) => `"${view.id}"`).join(', ')}] }) to put this on screen`,
        ],
      })
    },
  })

  const exportDataset = defineTool<{ category?: string; industry?: string; limit?: number; include_history?: boolean }>({
    name: 'benchmarks_export_dataset',
    title: 'Export dataset',
    group: 'read',
    description:
      'Return the raw benchmark rows as structured JSON so you can run your own analysis — correlations, cohort comparisons, charts, or a written report. Filter by category or industry to keep the payload small.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional category id or name.' },
        industry: { type: 'string', description: 'Optional industry name.' },
        limit: { type: 'integer', minimum: 1, description: 'Maximum rows. Omit for the whole corpus.' },
        include_history: {
          type: 'boolean',
          default: true,
          description: 'Include the three-point release/week history for each title.',
        },
      },
    },
    examples: [
      { label: 'Everything', input: {} },
      { label: 'Gaming only', input: { industry: 'Gaming' } },
    ],
    handler: ({ category, industry, limit, include_history }) => {
      const dataset = ctx.dataset()
      const found = category ? findCategory(dataset, category) : null
      if (category && !found) {
        return fail(`No category matches "${category}".`, [
          `Known ids: ${dataset.categories.map((item) => item.id).join(', ')}`,
        ])
      }

      const scopeIndustry = industry ? findIndustry(dataset, industry) : null
      if (industry && !scopeIndustry) {
        return fail(`No industry matches "${industry}".`, [
          `Known industries: ${dataset.industries.map((item) => item.name).join(', ')}`,
        ])
      }

      const rows = queryTitles(dataset, {
        ...(found ? { categoryId: found.id } : {}),
        ...(scopeIndustry ? { industryId: scopeIndustry.id } : {}),
        sort: 'score',
        ...(typeof limit === 'number' ? { limit } : {}),
      }).map((view) => ({
        id: view.id,
        name: view.name,
        publisher: view.publisher,
        category: view.category.name,
        categoryId: view.category.id,
        industry: view.industry.name,
        score: view.score,
        delta: view.delta,
        cadence: view.cadence,
        weekOverWeek: view.movement.wow,
        vsCategoryAvg: view.movement.vsCategoryAvg,
        categoryAvg: view.movement.categoryAvg,
        storeRating: view.storeRating,
        release: view.release,
        gaining: view.gaining,
        slipping: view.slipping,
        ...(include_history === false ? {} : { history: view.history }),
      }))

      return ok(
        `Exported ${rows.length} rows. Fields: ${Object.keys(rows[0] ?? {}).join(', ')}. The JSON payload is attached as structured content; scoring scale is ${dataset.meta.scale.min}-${dataset.meta.scale.max} (${dataset.meta.scale.name}).`,
        {
          data: {
            meta: {
              source: dataset.meta.source,
              scale: dataset.meta.scale,
              disclaimer: dataset.meta.disclaimer,
            },
            rowCount: rows.length,
            rows,
          },
          nextSteps: ['benchmarks_explain_methodology() before quoting these numbers'],
        },
      )
    },
  })

  const explainMethodology = defineTool<Record<string, never>>({
    name: 'benchmarks_explain_methodology',
    title: 'Explain methodology',
    group: 'read',
    description:
      'Explain what the score means, where the data comes from, what the score bands are, and what its limits are. Call this before presenting any number to a user so the framing is accurate.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    examples: [{ label: 'How is this scored?', input: {} }],
    handler: () => {
      const dataset = ctx.dataset()
      const { meta } = dataset
      const text = [
        `${meta.scale.name} score, ${meta.scale.min}-${meta.scale.max}. ${meta.scale.description}`,
        '',
        `Coverage: ${meta.totals.titles} titles, ${meta.totals.categories} categories, ${meta.totals.industries} industries.`,
        '',
        `Bands: ${meta.bands.map((band) => `${band.label} ${band.min}-${band.max}`).join(', ')}.`,
        'Titles shipping frequent releases are scored per version; the rest are scored per week. Each title carries its own `cadence`, and its `delta` always means "against the previous point of that cadence" — a release for one title, a week for another. Do not describe it as a release change without checking the cadence.',
        '',
        `Limits: ${meta.disclaimer}`,
        `Source of record: ${meta.source}`,
      ].join('\n')

      return ok(text, { data: meta })
    },
  })

  return [
    getOverview,
    getCategoryAnalytics,
    getMovers,
    compareTitles,
    exportDataset,
    explainMethodology,
  ] as unknown as Array<ToolSpec<never>>
}
