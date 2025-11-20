import {
  type FieldConfig,
  type JsonValue,
  type ObjectFieldConfig,
  type ArrayFieldConfig,
} from '../types/snippets'
import { hasAlphaChannel, isHexColor, isRgbaColor } from './jsonUtils'

export interface DetectedSnippetConfig {
  rootKey: string
  fields: FieldConfig[]
}

export function detectSnippetConfigFromJson(snippet: JsonValue): DetectedSnippetConfig {
  // Heuristic: if snippet is an object with exactly one key, use that key as root key
  // If it has multiple keys, detect all top-level fields directly (no object wrapper)
  if (snippet && typeof snippet === 'object' && !Array.isArray(snippet)) {
    const keys = Object.keys(snippet as any)
    if (keys.length === 1) {
      // Single key: extract it as root key (for nested structures)
      const rootKey = keys[0]
      const rootValue = (snippet as any)[rootKey] as JsonValue
      const fields = detectFields(rootValue, [], rootKey)
      return { rootKey, fields }
    } else if (keys.length > 1) {
      // Multiple keys: detect each field directly at root level (no object wrapper)
      const fields: FieldConfig[] = []
      const obj = snippet as Record<string, JsonValue>
      for (const [key, val] of Object.entries(obj)) {
        fields.push(...detectFields(val, [key], key))
      }
      // Use the first key as the root key for matching purposes
      const rootKey = keys[0]
      return { rootKey, fields }
    }
  }

  // Fallback: treat the entire snippet as a pseudo-root
  const rootKey = 'root'
  const fields = detectFields(snippet, [], rootKey)
  return { rootKey, fields }
}

function detectFields(
  value: JsonValue,
  path: (string | number)[],
  label: string,
): FieldConfig[] {
  if (typeof value === 'boolean') {
    return [
      {
        id: makeFieldId(path),
        label,
        path,
        kind: 'boolean',
        editable: true,
        defaultValue: value,
      },
    ]
  }

  if (typeof value === 'number') {
    return [
      {
        id: makeFieldId(path),
        label,
        path,
        kind: 'number',
        editable: true,
        defaultValue: value,
      },
    ]
  }

  if (typeof value === 'string') {
    // Check if field name suggests it's a color (case-insensitive)
    const labelLower = label.toLowerCase()
    const isColorField = labelLower.includes('color') || labelLower.includes('hex')
    
    if (isColorField || isHexColor(value) || isRgbaColor(value)) {
      // Determine if it supports alpha - check the value if valid, otherwise check if field name suggests alpha
      const hasAlpha = hasAlphaChannel(value) || (isColorField && (labelLower.includes('alpha') || labelLower.includes('rgba')))
      
      return [
        {
          id: makeFieldId(path),
          label,
          path,
          kind: 'color',
          editable: true,
          defaultValue: value,
          supportsAlpha: hasAlpha,
        },
      ]
    }
    return [
      {
        id: makeFieldId(path),
        label,
        path,
        kind: 'string',
        editable: true,
        defaultValue: value,
      },
    ]
  }

  if (value === null) {
    // treat null as a string for now
    return [
      {
        id: makeFieldId(path),
        label,
        path,
        kind: 'string',
        editable: true,
        defaultValue: '',
      },
    ]
  }

  if (Array.isArray(value)) {
    const children: FieldConfig[] = []
    value.forEach((item, index) => {
      children.push(...detectFields(item as JsonValue, [...path, index], `${label}[${index}]`))
    })
    const container: ArrayFieldConfig = {
      id: makeFieldId(path),
      label,
      path,
      kind: 'array',
      editable: false,
      children,
    }
    return [container]
  }

  // object
  const obj = value as Record<string, JsonValue>
  const children: FieldConfig[] = []
  for (const [key, val] of Object.entries(obj)) {
    children.push(...detectFields(val, [...path, key], key))
  }

  const container: ObjectFieldConfig = {
    id: makeFieldId(path),
    label,
    path,
    kind: 'object',
    editable: false,
    children,
  }

  return [container]
}

function makeFieldId(path: (string | number)[]): string {
  if (path.length === 0) return 'root'
  return path.map((p) => String(p)).join('.')
}


