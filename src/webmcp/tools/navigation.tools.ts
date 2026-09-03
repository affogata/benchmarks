/**
 * Act tools — the half that makes this a WebMCP app rather than a JSON endpoint.
 *
 * Each one drives the same store the human's clicks drive, so when the agent switches
 * category or builds a comparison, the page visibly moves with it. Every result reports
 * what changed on screen, which is what lets the agent narrate its own actions.
 *
 * `benchmarks_get_current_view` is the read half of that loop: the human drives the same
 * store, so what an earlier act tool set up is not necessarily what is on screen now.
 */
import { defineTool } from '../kernel/defineTool'
import { fail, ok } from '../kernel/result'
import type { ToolSpec } from '../kernel/types'
import type { ToolContext } from './context'
import type { Title } from '@/domain/benchmarks/models'
import {
  distinctTitles,
  findCategory,
  findIndustry,
  findTitle,
  queryTitles,
  SORT_KEYS,
  suggestTitles,
  toView,
  type SortKey,
} from '@/domain/benchmarks/selectors'
import { MAX_COMPARISON, type ViewFilters } from '@/stores/view.store'
import { fmtDelta, fmtScore } from '@/shared/lib/format'

/**
 * The browse page reads category, industry, topic and search back out of the URL and
 * clears whatever the URL omits, so these four have to travel in it. That is also what
 * makes the result of a `set_view` call a link the user can share or reload.
 */
function browseHref(filters: ViewFilters): string {
  const pairs: Array<[string, string]> = []
  if (filters.categoryId) pairs.push(['category', filters.categoryId])
  else if (filters.industryId) pairs.push(['industry', filters.industryId])
  if (filters.topic) pairs.push(['topic', filters.topic])
  if (filters.search) pairs.push(['search', filters.search])

  // encodeURIComponent rather than URLSearchParams: the latter writes a space as "+", and
  // vue-router hands that back verbatim instead of decoding it, so a two-word search would
  // arrive as "free+trial".
  const query = pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
  return query ? `/browse?${query}` : '/browse'
}

export function createNavigationTools(ctx: ToolContext): Array<ToolSpec<never>> {
  const getCurrentView = defineTool<Record<string, never>>({
    name: 'benchmarks_get_current_view',
    title: 'Read the current view',
    group: 'read',
    description:
      'Read what the page is showing right now: the route, the active filters, and the exact titles pinned in the comparison. The person at the keyboard drives the same page you do — they can remove a comparison chip, add a title or change a filter at any moment — so call this before answering any question about "the current view", "this comparison" or "what is on screen" instead of trusting what an earlier call set up.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
    examples: [{ label: 'What is on screen now', input: {} }],
    handler: () => {
      const dataset = ctx.dataset()
      const filters = ctx.view.filters()
      // Resolved against the dataset rather than reported as raw ids: a stale id in the
      // store would otherwise be reported as a title the page is showing.
      const comparison = ctx.view
        .comparison()
        .map((id) => findTitle(dataset, id))
        .filter((title): title is Title => Boolean(title))
        // Through `toView` for the resolved category — a bare Title only carries its id.
        .map((title) => toView(dataset, title))
      const href = ctx.currentHref()

      const ranked = [...comparison].sort((a, b) => b.score - a.score)
      const comparisonLine = comparison.length
        ? `Comparison: ${comparison.map((item) => `${item.name} ${fmtScore(item.score)}`).join(', ')}.` +
          (comparison.length >= 2
            ? ` ${ranked[0]!.name} leads at ${fmtScore(ranked[0]!.score)}.`
            : ' Fewer than two titles, so the compare page is showing its empty state.')
        : 'Comparison: empty.'

      const active = [
        filters.categoryId
          ? `category ${dataset.categories.find((item) => item.id === filters.categoryId)?.name ?? filters.categoryId}`
          : null,
        filters.industryId
          ? `industry ${dataset.industries.find((item) => item.id === filters.industryId)?.name ?? filters.industryId}`
          : null,
        filters.search ? `search "${filters.search}"` : null,
        filters.topic ? `topic "${filters.topic}"` : null,
        filters.minScore !== null ? `score >= ${filters.minScore}` : null,
      ].filter(Boolean)

      return ok(
        `The page is on ${href}. ${comparisonLine} Filters: ${active.length ? active.join(', ') : 'none'}, sorted by ${filters.sort} ${filters.order}, ${filters.mode} layout.`,
        {
          data: {
            route: href,
            filters,
            comparison: comparison.map((item) => ({
              id: item.id,
              name: item.name,
              score: item.score,
              category: item.category.name,
            })),
            comparisonIds: comparison.map((item) => item.id),
          },
          nextSteps: [
            'benchmarks_compare_in_ui({ titles, mode: "add" | "remove" }) to change the comparison without rebuilding it',
            'benchmarks_compare_titles({ titles }) for the numbers behind the titles listed here',
          ],
        },
      )
    },
  })

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
        min_score: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description:
            'Hide titles scoring below this. Pass 0 to clear the threshold — no title scores below 0, so 0 and "no threshold" are the same filter, and this is how you drop it without resetting everything else.',
        },
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
      // 0 excludes nothing, so it is the natural "no threshold" value rather than a
      // filter that quietly stays on until the whole view is reset.
      if (min_score !== undefined) patch.minScore = min_score === 0 ? null : min_score
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
      ctx.navigate(browseHref(filters))

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

  const compareInUi = defineTool<{ titles: string[]; mode?: 'replace' | 'add' | 'remove' }>({
    name: 'benchmarks_compare_in_ui',
    title: 'Show a comparison',
    group: 'act',
    description:
      'Put titles side by side on the comparison page so the user can see the difference rather than read it. The default mode replaces the whole selection, which is right for "compare X and Y" and wrong for "add a competitor" — use mode "add" to put titles alongside the ones already on screen, and mode "remove" to drop titles and keep the rest. Pair this with benchmarks_compare_titles when you want both the numbers and the visual.',
    annotations: { readOnlyHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        titles: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: MAX_COMPARISON,
          description:
            'Title ids or names. At least two when replacing, since a comparison needs two; one is enough to add or remove.',
        },
        mode: {
          type: 'string',
          enum: ['replace', 'add', 'remove'],
          default: 'replace',
          description:
            'replace (default): these titles become the whole comparison. add: keep what is on screen and add these. remove: drop these and keep the rest.',
        },
      },
      required: ['titles'],
    },
    examples: [
      { label: 'Streaming showdown', input: { titles: ['netflix', 'disney-plus', 'hbo-max'] } },
      { label: 'Payments', input: { titles: ['revolut', 'paypal'] } },
      { label: 'Add a competitor to what is on screen', input: { titles: ['monzo'], mode: 'add' } },
      { label: 'Drop one title', input: { titles: ['revolut'], mode: 'remove' } },
    ],
    handler: ({ titles, mode = 'replace' }) => {
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
          'Call benchmarks_list_titles to see valid ids.',
        ])
      }

      // The store dedupes on the way in, so counting before that would promise the user two
      // titles on screen while the page renders its "pick at least two" state.
      const unique = distinctTitles(resolved)
      if (!unique.length) {
        return fail('Give at least one title.', ['Resolved to: nothing.'])
      }

      // Read from the store, never from what an earlier call set: the user edits the same
      // comparison by hand, so anything remembered from a previous turn is a guess.
      const current = ctx.view.comparison()
      const nameOf = (id: string): string => findTitle(dataset, id)?.name ?? id

      let ids: string[]
      /** Asked for but not applied — reported rather than dropped in silence. */
      let ignored: string[] = []

      if (mode === 'add') {
        const additions = unique.filter((item) => !current.includes(item.id))
        const already = unique.filter((item) => current.includes(item.id))
        const room = MAX_COMPARISON - current.length
        if (!additions.length) {
          return fail(
            `${already.map((item) => item.name).join(', ')} ${already.length === 1 ? 'is' : 'are'} already in the comparison.`,
            [`On screen now: ${current.map(nameOf).join(', ') || 'nothing'}.`],
          )
        }
        if (room <= 0) {
          return fail(
            `The comparison already holds its maximum of ${MAX_COMPARISON} titles, so ${additions.map((item) => item.name).join(', ')} cannot be added.`,
            [
              `On screen now: ${current.map(nameOf).join(', ')}.`,
              'Drop one first with mode "remove", or pass mode "replace" to rebuild the whole selection.',
            ],
          )
        }
        ids = [...current, ...additions.slice(0, room).map((item) => item.id)]
        ignored = [
          ...already.map((item) => `${item.name} (already there)`),
          ...additions.slice(room).map((item) => `${item.name} (no room)`),
        ]
      } else if (mode === 'remove') {
        const removing = unique.filter((item) => current.includes(item.id))
        if (!removing.length) {
          return fail(
            `None of ${unique.map((item) => item.name).join(', ')} are in the comparison.`,
            [`On screen now: ${current.map(nameOf).join(', ') || 'nothing'}.`],
          )
        }
        const drop = new Set(removing.map((item) => item.id))
        ids = current.filter((id) => !drop.has(id))
        ignored = unique.filter((item) => !drop.has(item.id)).map((item) => `${item.name} (not there)`)
      } else {
        if (unique.length < 2) {
          return fail('Give at least two distinct titles to replace the comparison.', [
            `Resolved to: ${unique.map((item) => item.name).join(', ')}.`,
            'Pass mode "add" to put this title alongside the ones already on screen instead of replacing them.',
          ])
        }
        ids = unique.map((item) => item.id)
      }

      ctx.view.setComparison(ids)
      const route = ids.length ? `/compare?titles=${ids.join(',')}` : '/compare'
      ctx.navigate(route)

      const shown = ids.map((id) => findTitle(dataset, id)).filter((item): item is Title => Boolean(item))
      const ranked = [...shown].sort((a, b) => b.score - a.score)
      const headline = shown.length
        ? `${mode === 'replace' ? 'Comparing' : 'The comparison now holds'} ${shown.map((item) => item.name).join(mode === 'replace' ? ' vs ' : ', ')} on screen.`
        : 'The comparison is now empty.'
      // Under two titles the page renders its "pick at least two" state, so claiming a
      // leader here would describe a table the user cannot see.
      const verdict =
        shown.length >= 2
          ? ` ${ranked[0]!.name} leads at ${fmtScore(ranked[0]!.score)}.`
          : shown.length === 1
            ? ' One title is not a comparison — the page is asking for a second.'
            : ''

      return ok(headline + verdict + (ignored.length ? ` Ignored: ${ignored.join(', ')}.` : ''), {
        data: { titleIds: ids, route, mode, ignored },
        uiEffect: `The comparison page now shows ${shown.length} title(s).`,
        nextSteps: [
          'benchmarks_compare_titles({ titles }) for the full metric breakdown',
          'benchmarks_get_current_view() before your next answer about this comparison - the user can add or remove titles by hand',
        ],
      })
    },
  })

  const resetView = defineTool<Record<string, never>>({
    name: 'benchmarks_reset_view',
    title: 'Reset the view',
    group: 'act',
    description:
      'Clear every filter, comparison and highlight and return the page to the full benchmark overview. Use it when the user says "start over" or "show everything again".',
    annotations: { readOnlyHint: false },
    inputSchema: { type: 'object', properties: {} },
    examples: [{ label: 'Start over', input: {} }],
    handler: () => {
      const { totals } = ctx.dataset().meta
      ctx.view.reset()
      ctx.view.setComparison([])
      ctx.navigate('/')
      return ok(`View reset. Showing all ${totals.titles} titles across ${totals.categories} categories.`, {
        uiEffect: 'The page is back to the full benchmark overview.',
        data: { route: '/' },
      })
    },
  })

  return [getCurrentView, openCategory, openTitle, setView, compareInUi, resetView] as unknown as Array<ToolSpec<never>>
}
