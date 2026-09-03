/**
 * Identity helper that pins a tool's input type to its schema at the definition site — and
 * the one place every tool's prompt-facing text passes through.
 *
 * Descriptions travel into a host's prompt envelope untouched by us, so they are folded to
 * plain ASCII here (see `toolText`) rather than at 15 call sites that would each have to
 * remember. Everything the host matches on — `name`, enum values, defaults — is left
 * exactly as written.
 */
import { toolText } from './text'
import type { JsonSchema, JsonSchemaProperty, ToolSpec } from './types'

function normaliseSchema(schema: JsonSchema): JsonSchema {
  const properties: Record<string, JsonSchemaProperty> = {}

  for (const [key, property] of Object.entries(schema.properties)) {
    properties[key] = property.description
      ? { ...property, description: toolText(property.description) }
      : property
  }

  return { ...schema, properties }
}

export function defineTool<TInput extends Record<string, unknown>>(
  spec: ToolSpec<TInput>,
): ToolSpec<TInput> {
  return {
    ...spec,
    title: toolText(spec.title),
    description: toolText(spec.description),
    inputSchema: normaliseSchema(spec.inputSchema),
  }
}
