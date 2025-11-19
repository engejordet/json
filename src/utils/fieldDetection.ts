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
  // Heuristic: if snippet is an object with at least one key, use the first key as root key
  if (snippet && typeof snippet === 'object' && !Array.isArray(snippet)) {
    const keys = Object.keys(snippet as any)
    if (keys.length > 0) {
      const rootKey = keys[0]
      const rootValue = (snippet as any)[rootKey] as JsonValue
      const fields = detectFields(rootValue, [], rootKey)
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
    if (isHexColor(value) || isRgbaColor(value)) {
      return [
        {
          id: makeFieldId(path),
          label,
          path,
          kind: 'color',
          editable: true,
          defaultValue: value,
          supportsAlpha: hasAlphaChannel(value),
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


