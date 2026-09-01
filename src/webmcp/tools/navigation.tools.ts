/**
 * Act tools — the half that makes this a WebMCP app rather than a JSON endpoint.
 *
 * Each one drives the same store the human's clicks drive, so when the agent switches
 * category or builds a comparison, the page visibly moves with it. Every result reports
 * what changed on screen, which is what lets the agent narrate its own actions.
 */
import { defineTool } from '../kernel/defineTool'
import { fail, ok } from '../kernel/result'
import type { ToolSpec } from '../kernel/types'
import type { ToolContext } from './context'
import {
  findCategory,
  findIndustry,
  findTitle,
  queryTitles,
  SORT_KEYS,
  suggestTitles,
  type SortKey,
} from '@/domain/benchmarks/selectors'
import { fmtDelta, fmtScore } from '@/shared/lib/format'

export function createNavigationTools(ctx: ToolContext): Array<ToolSpec<never>> {
  const openCategory = defineTool<{ category: string }>({
    name: 'benchmarks_open_category',
    title: 'Open a category',
    group: 'act',
    description:
      'Switch the page to a benchmark category and show its titles. Use this whenever the user asks to see, open or switch to a category — the browser view follows along instead of the answer living only in chat.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category id or name, e.g. "travel-apps", "Social Casino", "Education".',
        },
      },
      required: ['category'],
    },
    examples: [
      { label: 'Open Travel & Mobility', input: { category: 'travel-apps' } },
      { label: 'Open Dating & Social', input: { category: 'Dating & Social' } },
    ],
    handler: ({ category }) => {
      const dataset = ctx.dataset()
      const found = findCategory(dataset, category)
      if (!found) {
        return fail(`No category matches "${category}".`, [
          `Known categories: ${dataset.categories.map((item) => `${item.id} (${item.name})`).join(', ')}`,
        ])
      }

      ctx.view.patch({ categoryId: found.id, industryId: null })
      ctx.navigate(`/category/${found.id}`)

      const rows = queryTitles(dataset, { categoryId: found.id, sort: 'score' })
      const leader = rows[0]
      const laggard = rows[rows.length - 1]

      return ok(
        `Opened ${found.name} — ${rows.length} titles, average ${fmtScore(found.categoryAvg)}.` +
          (leader && laggard
            ? ` ${leader.name} leads at ${fmtScore(leader.score)}; ${laggard.name} trails at ${fmtScore(laggard.score)}.`
            : ''),
        {
          data: {
            categoryId: found.id,
            name: found.name,
            route: `/category/${found.id}`,
            titles: rows.map((row) => ({ id: row.id, name: row.name, score: row.score })),
          },
          uiEffect: `The page now shows the ${found.name} category.`,
          nextSteps: [
            `benchmarks_get_category_analytics({ category: "${found.id}" })`,
            'benchmarks_open_title({ title })',
          ],
        },
      )
    },
  })

  const openTitle = defineTool<{ title: string }>({
    name: 'benchmarks_open_title',
    title: 'Open a title',
    group: 'act',
    description:
      'Open the detail page for one game or app, showing its score history, topic clusters and movement. Use it to put a specific brand in front of the user after you have talked about it.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title id or name, e.g. "duolingo" or "Genshin Impact".' },
      },
      required: ['title'],
    },
    examples: [
      { label: 'Open Duolingo', input: { title: 'duolingo' } },
      { label: 'Open Ryanair', input: { title: 'Ryanair' } },
    ],
    handler: ({ title }) => {
      const dataset = ctx.dataset()
      const found = findTitle(dataset, title)
      if (!found) {
        const hints = suggestTitles(dataset, title)
        return fail(`No title matches "${title}".`, [
          hints.length
            ? `Did you mean: ${hints.map((item) => item.name).join(', ')}?`
            : 'Call benchmarks_list_titles for the full list.',
        ])
      }

      ctx.navigate(`/title/${found.id}`)
      ctx.view.highlight(found.id)

      return ok(
        `Opened ${found.name} — ${fmtScore(found.score)}/10, ${fmtDelta(found.delta)} on the current ${found.cadence === 'version' ? 'release' : 'week'}. Slipping on ${found.slipping.join(', ').toLowerCase()}.`,
        {
          data: { titleId: found.id, name: found.name, route: `/title/${found.id}`, score: found.score },
          uiEffect: `The page now shows the ${found.name} detail view.`,
          nextSteps: [`benchmarks_get_title({ title: "${found.id}" }) for the full numbers`],
        },
      )
    },
  })

  const setView = defineTool<{
    search?: string
    topic?: string
    industry?: string
    min_score?: number
    sort?: SortKey
    order?: 'asc' | 'desc'
    mode?: 'grid' | 'table'
  }>({
    name: 'benchmarks_set_view',
    title: 'Filter and sort the page',
    group: 'act',
    description:
      'Change what the browsing page shows: free-text search, a topic filter, an industry, a minimum score, the sort order, and grid or table layout. This is the agent equivalent of the on-page controls, so the user ends up looking at exactly the slice you are describing.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Free text over name, publisher and topic clusters. Pass "" to clear.' },
        topic: { type: 'string', description: 'Only titles whose clusters mention this topic, e.g. "ads". Pass "" to clear.' },
        industry: { type: 'string', description: 'Industry name, e.g. "Gaming". Pass "" to clear.' },
        min_score: { type: 'number', minimum: 0, maximum: 10, description: 'Hide titles scoring below this.' },
        sort: { type: 'string', enum: SORT_KEYS, description: 'Sort key for the list.' },
        order: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.' },
        mode: { type: 'string', enum: ['grid', 'table'], description: 'Card grid or dense table.' },
      },
    },
    examples: [
      { label: 'Worst first, table view', input: { sort: 'score', order: 'asc', mode: 'table' } },
      { label: 'Only titles hit on ads', input: { topic: 'ads' } },
    ],
    handler: ({ search, topic, industry, min_score, sort, order, mode }) => {
      const dataset = ctx.dataset()
      const patch: Parameters<ToolContext['view']['patch']>[0] = {}

      if (search !== undefined) patch.search = search
      if (topic !== undefined) patch.topic = topic === '' ? null : topic
      if (min_score !== undefined) patch.minScore = min_score
      if (sort !== undefined) patch.sort = sort
      if (order !== undefined) patch.order = order
      if (mode !== undefined) patch.mode = mode

      if (industry !== undefined) {
        if (industry === '') patch.industryId = null
        else {
          const found = findIndustry(dataset, industry)
          if (!found) {
            return fail(`No industry matches "${industry}".`, [
              `Known industries: ${dataset.industries.map((item) => item.name).join(', ')}`,
            ])
          }
          patch.industryId = found.id
          patch.categoryId = null
        }
      }

      if (!Object.keys(patch).length) {
        return fail('Nothing to change.', [
          'Pass at least one of: search, topic, industry, min_score, sort, order, mode.',
        ])
      }

      const filters = ctx.view.patch(patch)
      if (!ctx.currentPath().startsWith('/browse')) ctx.navigate('/browse')

      const matched = queryTitles(dataset, {
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.industryId ? { industryId: filters.industryId } : {}),
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.topic ? { topic: filters.topic } : {}),
        ...(filters.minScore !== null ? { minScore: filters.minScore } : {}),
        sort: filters.sort,
        order: filters.order,
      })

      const described = [
        filters.search ? `search "${filters.search}"` : null,
        filters.topic ? `topic "${filters.topic}"` : null,
        filters.industryId ? `industry ${dataset.industries.find((item) => item.id === filters.industryId)?.name}` : null,
        filters.minScore !== null ? `score ≥ ${filters.minScore}` : null,
        `sorted by ${filters.sort} ${filters.order}`,
        `${filters.mode} layout`,
      ]
        .filter(Boolean)
        .join(', ')

      return ok(
        `View updated: ${described}. ${matched.length} of ${dataset.titles.length} titles match.` +
          (matched.length ? ` Top of the list: ${matched.slice(0, 3).map((row) => `${row.name} ${fmtScore(row.score)}`).join(', ')}.` : ''),
        {
          data: {
            filters,
            matchCount: matched.length,
            titles: matched.slice(0, 20).map((row) => ({ id: row.id, name: row.name, score: row.score })),
          },
          uiEffect: `The browse page is now filtered to ${matched.length} title(s).`,
          nextSteps: ['benchmarks_reset_view() to clear the filters'],
        },
      )
    },
  })

  const compareInUi = defineTool<{ titles: string[] }>({
    name: 'benchmarks_compare_in_ui',
    title: 'Show a comparison',
    group: 'act',
    description:
      'Put 2 to 5 titles side by side on the comparison page so the user can see the difference rather than read it. Pair this with benchmarks_compare_titles when you want both the numbers and the visual.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        titles: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          maxItems: 5,
          description: 'Two to five title ids or names.',
        },
      },
      required: ['titles'],
    },
    examples: [
      { label: 'Streaming showdown', input: { titles: ['netflix', 'disney-plus', 'hbo-max'] } },
      { label: 'Payments', input: { titles: ['revolut', 'paypal'] } },
    ],
    handler: ({ titles }) => {
      const dataset = ctx.dataset()
      const resolved = []
      const missing: string[] = []
      for (const ref of titles) {
        const found = findTitle(dataset, ref)
        if (found) resolved.push(found)
        else missing.push(ref)
      }
      if (missing.length) {
        return fail(`Could not resolve: ${missing.join(', ')}.`, [
          'Call benchmarks_list_titles to see valid ids.',
        ])
      }
      if (resolved.length < 2) return fail('Give at least two distinct titles.')

      const ids = resolved.map((item) => item.id)
      ctx.view.setComparison(ids)
      ctx.navigate(`/compare?titles=${ids.join(',')}`)

      const ranked = [...resolved].sort((a, b) => b.score - a.score)
      return ok(
        `Comparing ${resolved.map((item) => item.name).join(' vs ')} on screen. ${ranked[0]!.name} leads at ${fmtScore(ranked[0]!.score)}.`,
        {
          data: { titleIds: ids, route: `/compare?titles=${ids.join(',')}` },
          uiEffect: `The comparison page now shows ${resolved.length} titles.`,
          nextSteps: ['benchmarks_compare_titles({ titles }) for the full metric breakdown'],
        },
      )
    },
  })

  const resetView = defineTool<Record<string, never>>({
    name: 'benchmarks_reset_view',
    title: 'Reset the view',
    group: 'act',
    description:
      'Clear every filter, comparison and highlight and return the page to the full 79-title overview. Use it when the user says "start over" or "show everything again".',
    annotations: { readOnlyHint: false },
    inputSchema: { type: 'object', properties: {} },
    examples: [{ label: 'Start over', input: {} }],
    handler: () => {
      ctx.view.reset()
      ctx.view.setComparison([])
      ctx.navigate('/')
      return ok('View reset. Showing all 79 titles across 16 categories.', {
        uiEffect: 'The page is back to the full benchmark overview.',
        data: { route: '/' },
      })
    },
  })

  return [openCategory, openTitle, setView, compareInUi, resetView] as unknown as Array<ToolSpec<never>>
}
