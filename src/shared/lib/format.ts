/** Presentation helpers shared by the UI and by the text WebMCP tools return. */

export const fmtScore = (value: number): string => value.toFixed(1)

/** Always-signed delta, e.g. "+1.4" / "-0.7" / "±0.0". */
export function fmtDelta(value: number): string {
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '±0.0'
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`
}

export const arrow = (value: number): string => (value > 0 ? '▲' : value < 0 ? '▼' : '→')

export const deltaTone = (value: number): 'up' | 'down' | 'flat' =>
  value > 0 ? 'up' : value < 0 ? 'down' : 'flat'

export const fmtRating = (value: number | null): string => (value === null ? '—' : `★ ${value.toFixed(1)}`)

export const pct = (value: number): string => `${Math.round(value)}%`

export const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1)

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

/** Fixed-width text table — how tool results stay readable inside a chat transcript. */
export function textTable(headers: string[], rows: Array<Array<string | number>>): string {
  const all = [headers, ...rows.map((row) => row.map(String))]
  const widths = headers.map((_, column) =>
    Math.max(...all.map((row) => String(row[column] ?? '').length)),
  )
  const line = (cells: Array<string | number>): string =>
    cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join('  ').trimEnd()
  return [line(headers), line(widths.map((width) => '-'.repeat(width))), ...rows.map(line)].join('\n')
}
