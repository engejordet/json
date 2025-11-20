import { useMemo } from 'react'
import { useMantineColorScheme } from '@mantine/core'
import CodeMirror from '@uiw/react-codemirror'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import { json } from '@codemirror/lang-json'
import { EditorView, Decoration, WidgetType } from '@codemirror/view'
import { StateField } from '@codemirror/state'
import type { Range } from '@codemirror/state'
import { isHexColor, isRgbaColor } from '../../utils/jsonUtils'

interface JsonCodeEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string
  highlightChanges?: boolean
  compareWith?: string
  showColorSwatches?: boolean
}

// Color swatch widget
class ColorSwatchWidget extends WidgetType {
  constructor(private color: string) {
    super()
  }

  toDOM() {
    try {
      const span = document.createElement('span')
      span.className = 'cm-color-swatch'
      
      // Validate and sanitize color value
      let safeColor = this.color || '#000000'
      // Ensure it's a valid CSS color
      if (!safeColor.startsWith('#') && !safeColor.startsWith('rgb')) {
        safeColor = '#000000'
      }
      
      span.style.cssText = `
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 2px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        margin-left: 4px;
        margin-right: 2px;
        vertical-align: middle;
        background-color: ${safeColor};
      `
      return span
    } catch (error) {
      console.error('Error creating color swatch DOM:', error)
      // Return a safe fallback element
      const span = document.createElement('span')
      span.style.cssText = 'display: inline-block; width: 12px; height: 12px;'
      return span
    }
  }
}

// Convert rgba/rgb to a displayable color string
function getDisplayColor(color: string): string {
  if (isHexColor(color)) {
    return color
  }
  if (isRgbaColor(color)) {
    // Extract rgba values
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i)
    if (match) {
      const r = parseInt(match[1])
      const g = parseInt(match[2])
      const b = parseInt(match[3])
      const a = match[4] ? parseFloat(match[4]) : 1
      return `rgba(${r}, ${g}, ${b}, ${a})`
    }
  }
  return color
}

// Find color values in JSON text and return widget decorations
function findColorValues(text: string): Range<Decoration>[] {
  if (!text || !text.trim()) return []
  
  try {
    // Quick validation: check if text looks like it might be valid JSON
    // Don't process if it's clearly invalid (e.g., empty, just whitespace, or malformed)
    const trimmed = text.trim()
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      return []
    }
    
    const decorations: Range<Decoration>[] = []
    const lines = text.split('\n')
    const maxLength = text.length
    
    // Regex to match color values in JSON strings: "#..." or "rgba(...)" or "rgb(...)"
    const colorPattern = /"((?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\([^)]+\)))"/g
    
    let pos = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (pos > maxLength) break // Safety check
      
      let match
      
      // Reset regex lastIndex for each line
      colorPattern.lastIndex = 0
      
      try {
        while ((match = colorPattern.exec(line)) !== null) {
          if (!match[1]) continue
          
          const colorValue = match[1]
          if (colorValue && (isHexColor(colorValue) || isRgbaColor(colorValue))) {
            const matchStart = pos + match.index + match[0].length // Position after the closing quote
            
            // Validate position is within bounds (with some margin for safety)
            if (matchStart < 0 || matchStart >= maxLength) continue
            
            // Double-check the position doesn't exceed text length
            if (matchStart > text.length) continue
            
            const displayColor = getDisplayColor(colorValue)
            if (displayColor) {
              try {
                const widget = new ColorSwatchWidget(displayColor)
                const decoration = Decoration.widget({
                  widget,
                  side: 1, // Place after the matched text
                }).range(matchStart)
                decorations.push(decoration)
              } catch (e) {
                // Skip this decoration if there's an error creating it
                console.warn('Error creating color swatch decoration:', e)
              }
            }
          }
        }
      } catch (e) {
        // Skip this line if there's an error
        console.warn('Error processing line for color values:', e)
      }
      
      pos += line.length + 1 // +1 for newline
      if (pos > maxLength) break // Safety check
    }
    
    return decorations
  } catch (error) {
    console.error('Error finding color values:', error)
    return []
  }
}

// Find changed values in JSON strings and return character ranges to highlight
function findChangedRanges(originalText: string, modifiedText: string): Range<Decoration>[] {
  if (!originalText || !modifiedText) return []
  
  try {
    const original = JSON.parse(originalText)
    const modified = JSON.parse(modifiedText)
    
    // Find all changed paths
    const changedPaths = new Set<string>()
    
    function findDiffs(orig: any, mod: any, path: string[] = []) {
      if (orig === mod) return
      
      const origType = typeof orig
      const modType = typeof mod
      
      if (origType !== modType || Array.isArray(orig) !== Array.isArray(mod)) {
        changedPaths.add(path.join('.'))
        return
      }
      
      if (origType === 'object' && orig !== null && mod !== null) {
        if (Array.isArray(orig) && Array.isArray(mod)) {
          const maxLen = Math.max(orig.length, mod.length)
          for (let i = 0; i < maxLen; i++) {
            findDiffs(orig[i], mod[i], [...path, String(i)])
          }
        } else {
          const allKeys = new Set([...Object.keys(orig), ...Object.keys(mod)])
          allKeys.forEach(key => {
            findDiffs(orig[key], mod[key], [...path, key])
          })
        }
      } else if (orig !== mod) {
        changedPaths.add(path.join('.'))
      }
    }
    
    findDiffs(original, modified)
    
    // Now find the character positions of changed values in the modified text
    const decorations: Range<Decoration>[] = []
    const lines = modifiedText.split('\n')
    
    changedPaths.forEach(path => {
      const keys = path.split('.')
      let lastKey = keys[keys.length - 1]

      if (!lastKey) return

      // For simple arrays (e.g. path "root.unitTooltipAttributes.0") the last
      // segment is an index, not a property name. In that case, use the
      // previous segment so that we match the array field name in the text.
      if (!Number.isNaN(Number(lastKey)) && keys.length > 1) {
        lastKey = keys[keys.length - 2]
      }
      
      let pos = 0
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        
        // Look for the key in this line
        const keyPattern = `"${lastKey}"`
        const keyIndex = line.indexOf(keyPattern)
        
        if (keyIndex !== -1) {
          // Find the value part after the colon
          const colonIndex = line.indexOf(':', keyIndex)
          if (colonIndex !== -1) {
            let valueStart = colonIndex + 1
            // Skip whitespace
            while (valueStart < line.length && line[valueStart] === ' ') {
              valueStart++
            }
            
            // Find the end of the value (before comma or end of line)
            let valueEnd = valueStart
            let inString = false
            let escaped = false
            
            for (let j = valueStart; j < line.length; j++) {
              const char = line[j]
              
              if (escaped) {
                escaped = false
                continue
              }
              
              if (char === '\\') {
                escaped = true
                continue
              }
              
              if (char === '"') {
                inString = !inString
              }
              
              if (!inString && (char === ',' || char === '}' || char === ']')) {
                break
              }
              
              valueEnd = j + 1
            }
            
            // Calculate absolute position in document
            const lineStart = pos
            const absStart = lineStart + valueStart
            const absEnd = lineStart + valueEnd
            
            decorations.push(
              Decoration.mark({
                attributes: { 
                  style: 'background-color: rgba(255, 100, 100, 0.3); border-radius: 2px; animation: flashHighlight 1.5s ease-in-out infinite;' 
                }
              }).range(absStart, absEnd)
            )
            
            break // Found the key on this line, move to next path
          }
        }
        
        pos += line.length + 1 // +1 for newline
      }
    })
    
    return decorations
  } catch (error) {
    console.error('Error finding changed ranges:', error)
    return []
  }
}

export function JsonCodeEditor({ 
  value, 
  onChange, 
  readOnly, 
  height = '320px', 
  highlightChanges,
  compareWith,
  showColorSwatches 
}: JsonCodeEditorProps) {
  const { colorScheme } = useMantineColorScheme()
  const theme = colorScheme === 'dark' ? githubDark : githubLight

  const highlightExtension = useMemo(() => {
    if (!highlightChanges || !compareWith || !value) {
      return []
    }
    
    const decorations = findChangedRanges(compareWith, value)
    
    if (decorations.length === 0) {
      return []
    }
    
    const field = StateField.define({
      create() {
        return Decoration.set(decorations)
      },
      update(decorations) {
        return decorations
      },
      provide: f => EditorView.decorations.from(f)
    })
    
    return [field]
  }, [highlightChanges, compareWith, value])

  const colorSwatchExtension = useMemo(() => {
    // Show color swatches if explicitly enabled, or if read-only (for Output JSON)
    const shouldShowSwatches = showColorSwatches !== false && (readOnly || showColorSwatches === true)
    if (!shouldShowSwatches || !value || !value.trim()) {
      return []
    }
    
    try {
      // Only process if JSON appears valid (starts with { or [)
      const trimmed = value.trim()
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return []
      }
      
      // Find color values with defensive error handling
      const decorations = findColorValues(value)
      
      if (decorations.length === 0) {
        return []
      }
      
      // Create a field that recalculates decorations when document changes
      const field = StateField.define({
        create(state) {
          try {
            // Filter decorations to ensure they're within document bounds
            const docLength = state.doc.length
            const safeDecorations = decorations.filter((dec) => {
              try {
                // Access the range properties safely
                const range = dec as any
                const from = range?.from ?? range?.value?.from
                if (from !== undefined && from !== null) {
                  return from >= 0 && from <= docLength
                }
                return true
              } catch {
                return false
              }
            })
            
            if (safeDecorations.length === 0) {
              return Decoration.none
            }
            
            return Decoration.set(safeDecorations)
          } catch (error) {
            console.warn('Error creating color swatch decorations:', error)
            return Decoration.none
          }
        },
        update(decorations, tr) {
          try {
            // Recalculate decorations when document changes
            if (tr.docChanged) {
              const newText = tr.newDoc.toString()
              const trimmed = newText.trim()
              if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
                return Decoration.none
              }
              
              const newDecorations = findColorValues(newText)
              const docLength = tr.newDoc.length
              
              const safeDecorations = newDecorations.filter((dec) => {
                try {
                  const range = dec as any
                  const from = range?.from ?? range?.value?.from
                  if (from !== undefined && from !== null) {
                    return from >= 0 && from <= docLength
                  }
                  return true
                } catch {
                  return false
                }
              })
              
              if (safeDecorations.length === 0) {
                return Decoration.none
              }
              
              return Decoration.set(safeDecorations)
            }
            // If document didn't change, keep existing decorations
            return decorations
          } catch (error) {
            console.warn('Error updating color swatch decorations:', error)
            return Decoration.none
          }
        },
        provide: f => EditorView.decorations.from(f)
      })
      
      return [field]
    } catch (error) {
      console.error('Error creating color swatch extension:', error)
      return []
    }
  }, [readOnly, value, showColorSwatches])

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={theme}
      extensions={[json(), ...highlightExtension, ...colorSwatchExtension]}
      editable={!readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
      }}
      onChange={(val) => {
        onChange?.(val)
      }}
      style={{
        height: '100%',
        width: '100%',
        fontSize: 12,
        lineHeight: 1.4,
      }}
    />
  )
}


