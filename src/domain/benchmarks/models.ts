/**
 * Domain model for the Affogata benchmark corpus.
 *
 * This module is deliberately framework-free: no Vue, no router, no DOM. Both the
 * rendered UI and the WebMCP tool layer consume the same shapes, which is what keeps
 * "what the human sees" and "what the agent is told" from drifting apart.
 */

export type Cadence = 'version' | 'week'
export type RankKind = 'gainer' | 'dropper'
export type Tone = 'positive' | 'caution' | 'negative'

export interface HistoryPoint {
  /** Release or week label, e.g. "v6.4" or "Wk 31". */
  label: string
  score: number
  /** Change against the previous point; null for the first point in the window. */
  delta: number | null
}

export interface Movement {
  thisWeek: number
  lastWeek: number
  /** Week-over-week change. */
  wow: number
  /** Position within the pool for this direction, e.g. 3 => "#3 gainer of 79". */
  rank: number
  rankKind: RankKind
  pool: number
  categoryAvg: number
  vsCategoryAvg: number
  leader: string
  leaderScore: number
  vsLeader: number
  isLeader: boolean
}

export interface ReviewSource {
  name: string
  count: number
}

/** Real store-review pull attached to a subset of titles. */
export interface ReviewPulse {
  window: string
  reviews: number
  prevReviews: number
  positivePct: number
  prevPositivePct: number
  reviewImpact: number
  prevReviewImpact: number
  sources: ReviewSource[]
}

export interface Title {
  id: string
  name: string
  publisher: string
  categoryId: string
  storeRating: number | null
  release: string | null
  /** Customer-voice impact score, 0-10. */
  score: number
  /** Change against the previous release (cadence "version") or week (cadence "week"). */
  delta: number
  cadence: Cadence
  accent: string
  icon: string | null
  iconFit?: 'cover' | 'contain'
  history: HistoryPoint[]
  /** Topic clusters pushing the score up. */
  gaining: string[]
  /** Topic clusters dragging the score down. */
  slipping: string[]
  aiRead: string | null
  movement: Movement
  reviewPulse: ReviewPulse | null
}

export interface Category {
  id: string
  name: string
  shortName: string
  emoji: string
  color: string
  industryId: string
  /** Noun for the people being measured: players, shoppers, learners… */
  audience: string
  categoryAvg: number
  sourceUrl: string
}

export interface Industry {
  id: string
  name: string
  emoji: string
  color: string
  categoryIds: string[]
}

export interface ScoreBand {
  id: string
  label: string
  min: number
  max: number
  tone: Tone
}

export interface DatasetMeta {
  source: string
  publisher: string
  reportWeek: { week: number; year: number; range: string; label: string }
  movementWindow: string
  cadence: string
  totals: { titles: number; categories: number; industries: number }
  scale: { name: string; min: number; max: number; description: string }
  bands: ScoreBand[]
  disclaimer: string
}

export interface Dataset {
  meta: DatasetMeta
  industries: Industry[]
  categories: Category[]
  titles: Title[]
}

/** A title joined to its category and industry — the shape most consumers actually want. */
export interface TitleView extends Title {
  category: Category
  industry: Industry
}

export const isCadence = (value: unknown): value is Cadence =>
  value === 'version' || value === 'week'
