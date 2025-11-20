import type { JsonValue } from '../types/snippets'

/**
 * Find differences between two JSON values and return line numbers that changed
 */
export function getChangedLines(original: JsonValue | undefined, modified: JsonValue | undefined): Set<number> {
  const changedPaths = new Set<string>()
  
  if (!original || !modified) return new Set()
  
  findDifferences(original, modified, [], changedPaths)
  
  // For now, return empty set - we'll implement line-based highlighting
  // in a future iteration if needed
  return new Set()
}

function findDifferences(
  original: JsonValue,
  modified: JsonValue,
  path: (string | number)[],
  changedPaths: Set<string>,
): void {
  // If values are strictly equal, no change
  if (original === modified) return
  
  // Different types = changed
  if (typeof original !== typeof modified || Array.isArray(original) !== Array.isArray(modified)) {
    changedPaths.add(path.join('.'))
    return
  }
  
  // Both are objects (and not null, not arrays)
  if (typeof original === 'object' && original !== null && !Array.isArray(original)) {
    const origObj = original as Record<string, JsonValue>
    const modObj = modified as Record<string, JsonValue>
    
    const allKeys = new Set([...Object.keys(origObj), ...Object.keys(modObj)])
    
    for (const key of allKeys) {
      const origHas = key in origObj
      const modHas = key in modObj
      
      if (!origHas || !modHas) {
        // Key added or removed
        changedPaths.add([...path, key].join('.'))
      } else {
        findDifferences(origObj[key], modObj[key], [...path, key], changedPaths)
      }
    }
    return
  }
  
  // Both are arrays
  if (Array.isArray(original) && Array.isArray(modified)) {
    const maxLen = Math.max(original.length, modified.length)
    for (let i = 0; i < maxLen; i++) {
      if (i >= original.length || i >= modified.length) {
        changedPaths.add([...path, i].join('.'))
      } else {
        findDifferences(original[i], modified[i], [...path, i], changedPaths)
      }
    }
    return
  }
  
  // Primitives that are different
  changedPaths.add(path.join('.'))
}

