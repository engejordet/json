import type { JsonValue } from '../types/snippets'

export function safeParseJson(text: string): { value?: JsonValue; error?: string } {
  if (!text.trim()) return { value: undefined, error: 'Empty input' }
  try {
    const value = JSON.parse(text) as JsonValue
    return { value }
  } catch (e) {
    const partial = tryParsePartialObject(text)
    if (partial.ok) {
      return { value: partial.value }
    }
    return { error: (e as Error).message }
  }
}

export function prettyPrintJson(value: JsonValue | undefined): string {
  if (value === undefined) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

export function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
}

export function isRgbaColor(value: string): boolean {
  return /^rgba?\((\s*\d+\s*,){2}\s*\d+\s*(,\s*(0?\.\d+|1(\.0)?))?\s*\)$/.test(value)
}

export function hasAlphaChannel(value: string): boolean {
  if (isHexColor(value)) {
    const hex = value.replace('#', '')
    return hex.length === 4 || hex.length === 8
  }
  if (isRgbaColor(value)) {
    return /rgba\(/i.test(value) && /,\s*(0?\.\d+|1(\.0)?)/.test(value)
  }
  return false
}

/**
 * Converts rgba/rgb color to hex format.
 * If the color already is hex, returns it as-is.
 * If it has alpha, converts to 8-digit hex (#RRGGBBAA).
 * If no alpha, converts to 6-digit hex (#RRGGBB).
 */
export function convertColorToHex(color: string): string {
  if (isHexColor(color)) {
    return color
  }
  
  if (isRgbaColor(color)) {
    const match = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:,\s*([\d.]+))?\)/i)
    if (!match) return color
    
    const r = parseInt(match[1]!, 10)
    const g = parseInt(match[2]!, 10)
    const b = parseInt(match[3]!, 10)
    const a = match[4] ? parseFloat(match[4]) : undefined
    
    const toHex = (n: number) => {
      const hex = Math.round(n).toString(16).padStart(2, '0')
      return hex.length === 1 ? '0' + hex : hex
    }
    
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`
    
    if (a !== undefined && a < 1) {
      // Convert alpha (0-1) to hex (0-255)
      const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0')
      return hex + alphaHex
    }
    
    return hex
  }
  
  return color
}

/** Deeply set a value in an object/array given a path of keys/indices. Returns a new structure. */
export function setIn(root: JsonValue, path: (string | number)[], newValue: JsonValue): JsonValue {
  if (path.length === 0) return newValue
  const [head, ...tail] = path

  if (Array.isArray(root)) {
    const index = typeof head === 'number' ? head : Number(head)
    const clone = root.slice()
    const current = clone[index]
    clone[index] = setIn(current, tail, newValue)
    return clone as JsonValue
  }

  const obj = (root && typeof root === 'object' ? { ...(root as any) } : {}) as any
  const key = String(head)
  const current = obj[key]
  obj[key] = setIn(current, tail, newValue)
  return obj as JsonValue
}

/** Shallow merge two JSON values, with b overwriting a where they overlap. */
export function deepMerge(a: JsonValue, b: JsonValue): JsonValue {
  if (Array.isArray(a) && Array.isArray(b)) {
    return b
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const result: any = { ...(a as any) }
    for (const key of Object.keys(b as any)) {
      const av = (a as any)[key] as JsonValue
      const bv = (b as any)[key] as JsonValue
      result[key] = isPlainObject(av) && isPlainObject(bv) ? deepMerge(av, bv) : bv
    }
    return result
  }
  return b
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function tryParsePartialObject(
  text: string,
): { ok: true; value: JsonValue } | { ok: false; value?: undefined } {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false }

  // Looks like a property list, e.g. `"poiInfo": { ... }` or `poiInfo: { ... }`
  const looksLikeProperty =
    /^"[^"]+"\s*:/.test(trimmed) || /^[a-zA-Z0-9_$]+\s*:/.test(trimmed)
  if (!looksLikeProperty) return { ok: false }

  try {
    const wrapped = `{${text}}`
    const value = JSON.parse(wrapped) as JsonValue
    return { ok: true, value }
  } catch {
    return { ok: false }
  }
}



