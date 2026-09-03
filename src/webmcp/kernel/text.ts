/**
 * Normalisation for the strings a host copies verbatim into a model prompt.
 *
 * Tool names, descriptions and schema descriptions are not rendered by us — the host
 * splices them into whatever envelope it uses, and several of them build that envelope as
 * markup. Two things survive that trip badly:
 *
 *  - `<` and `>`, which can close or open a tag that was never meant to exist;
 *  - `"`, which has to be escaped through JSON *and* through the host's attribute quoting,
 *    and comes back out of a sloppy serialiser as a broken `name="…"` fragment.
 *
 * Typographic punctuation (curly quotes, en/em dashes, ellipses) is folded to ASCII for the
 * same reason: it is decoration in a string nobody reads for its typography, and it is a
 * reliable source of mojibake once a host re-encodes the prompt.
 *
 * Applied at `defineTool()`, so the whole surface is covered by construction and a tool
 * added later cannot reintroduce the problem.
 */

/** Typographic punctuation to its ASCII equivalent. */
const FOLD: Array<[RegExp, string]> = [
  [/[\u2018\u2019\u201A\u201B\u02BC]/g, "'"],
  [/[\u201C\u201D\u201E]/g, "'"],
  [/[\u2013\u2014\u2012]/g, '-'],
  [/\u2026/g, '...'],
  [/\u2192/g, '-'],
  [/[\u00A0\u2002\u2003\u2009\u202F]/g, ' '],
]

/**
 * Fold one piece of tool metadata to plain ASCII punctuation.
 *
 * Double quotes become single quotes rather than being escaped: descriptions use them only
 * to set off example values (`e.g. 'dating-apps'`), where an apostrophe reads identically
 * and costs the host nothing to serialise. Angle brackets are dropped outright — no tool
 * description here needs one, and every host that mangles a prompt does it on those.
 */
export function toolText(value: string): string {
  let text = value
  for (const [pattern, replacement] of FOLD) text = text.replace(pattern, replacement)
  return text
    .replace(/"/g, "'")
    .replace(/[<>]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}
