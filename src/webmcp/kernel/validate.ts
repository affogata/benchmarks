/**
 * Input validation against the same JSON Schema handed to the agent.
 *
 * Agents send loosely typed JSON — numbers as strings, comma-joined lists where an array
 * was declared. Coercing here (rather than rejecting) turns a class of avoidable tool
 * failures into successful calls, while still refusing genuinely wrong input.
 */
import type { JsonSchema, JsonSchemaProperty } from './types'

export interface ValidationResult {
  ok: boolean
  value: Record<string, unknown>
  errors: string[]
}

function coerce(key: string, spec: JsonSchemaProperty, raw: unknown, errors: string[]): unknown {
  switch (spec.type) {
    case 'string': {
      const value = typeof raw === 'string' ? raw.trim() : String(raw)
      if (spec.enum && !spec.enum.includes(value)) {
        const match = spec.enum.find((option) => option.toLowerCase() === value.toLowerCase())
        if (match) return match
        errors.push(`"${key}" must be one of: ${spec.enum.join(', ')} (received "${value}")`)
        return undefined
      }
      return value
    }
    case 'number':
    case 'integer': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim())
      if (!Number.isFinite(value)) {
        errors.push(`"${key}" must be a number (received "${String(raw)}")`)
        return undefined
      }
      const rounded = spec.type === 'integer' ? Math.round(value) : value
      if (typeof spec.minimum === 'number' && rounded < spec.minimum) {
        errors.push(`"${key}" must be at least ${spec.minimum}`)
        return undefined
      }
      if (typeof spec.maximum === 'number' && rounded > spec.maximum) {
        errors.push(`"${key}" must be at most ${spec.maximum}`)
        return undefined
      }
      return rounded
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return raw
      const value = String(raw).toLowerCase()
      if (['true', '1', 'yes'].includes(value)) return true
      if (['false', '0', 'no'].includes(value)) return false
      errors.push(`"${key}" must be true or false`)
      return undefined
    }
    case 'array': {
      // Accept a real array, or a comma-separated string, which agents frequently send.
      const list = Array.isArray(raw)
        ? raw
        : String(raw)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
      const items = list.map((item) =>
        spec.items?.type === 'number' ? Number(item) : String(item).trim(),
      )
      if (typeof spec.minItems === 'number' && items.length < spec.minItems) {
        errors.push(`"${key}" needs at least ${spec.minItems} item(s)`)
        return undefined
      }
      if (typeof spec.maxItems === 'number' && items.length > spec.maxItems) {
        return items.slice(0, spec.maxItems)
      }
      return items
    }
    default:
      return raw
  }
}

export function validateInput(schema: JsonSchema, input: unknown): ValidationResult {
  const errors: string[] = []
  const source = (input ?? {}) as Record<string, unknown>
  const value: Record<string, unknown> = {}

  for (const [key, spec] of Object.entries(schema.properties)) {
    // Trim before the presence check, not after it. `{ topic: "   " }` is a missing topic,
    // and letting it through as `""` would be worse than rejecting it: `"".includes()`
    // matches every cluster, so the tool would answer a search nobody made.
    const supplied = source[key]
    const raw = typeof supplied === 'string' ? supplied.trim() : supplied
    const blank = raw === undefined || raw === null || raw === ''

    if (blank) {
      if (schema.required?.includes(key)) {
        errors.push(`"${key}" is required — ${spec.description ?? spec.type}`)
        continue
      }
      // On an optional free-text property, an explicit "" is a value rather than an
      // omission: several tools document it as the way to clear a filter, and dropping it
      // here meant the documented clear silently did nothing. A property with an `enum` is
      // excluded — "" is not one of its options.
      if (raw === '' && spec.type === 'string' && !spec.enum) {
        value[key] = ''
        continue
      }
      if (spec.default !== undefined) value[key] = spec.default
      continue
    }

    const coerced = coerce(key, spec, raw, errors)
    if (coerced !== undefined) value[key] = coerced
  }

  const unknownKeys = Object.keys(source).filter((key) => !(key in schema.properties))
  if (unknownKeys.length) {
    errors.push(
      `Unknown argument(s): ${unknownKeys.join(', ')}. Accepted: ${Object.keys(schema.properties).join(', ')}`,
    )
  }

  return { ok: errors.length === 0, value, errors }
}
