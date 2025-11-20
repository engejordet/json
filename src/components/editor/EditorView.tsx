import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Box,
  Button,
  Card,
  CopyButton,
  Group,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconArrowBadgeDown, IconArrowBadgeUp, IconX } from '@tabler/icons-react'
import { useSnippetStore } from '../../state/snippetStore'
import { prettyPrintJson, safeParseJson, setIn, deepMerge } from '../../utils/jsonUtils'
import type { JsonValue } from '../../types/snippets'
import { ControlsPanel, type ControlChangePayload } from './ControlsPanel'
import { JsonCodeEditor } from '../common/JsonCodeEditor'
import { COLUMN_HEADER_MIN_HEIGHT } from '../../constants/layout'

export function EditorView() {
  const { snippets } = useSnippetStore()
  const [rawInput, setRawInput] = useState('')
  const [fileType, setFileType] = useState<string | null>('all')
  const [parseError, setParseError] = useState<string | undefined>()
  const [inputJson, setInputJson] = useState<JsonValue | undefined>()
  const [outputJson, setOutputJson] = useState<JsonValue | undefined>()
  
  const allSnippetIds = useMemo(() => snippets.map((s) => s.id), [snippets])
  const [openedSnippets, setOpenedSnippets] = useState<string[]>(allSnippetIds)
  
  useEffect(() => {
    setOpenedSnippets(allSnippetIds)
  }, [allSnippetIds])

  // Keep inputJson in sync with the raw text. Only initialise outputJson the first time
  // so that subsequent control changes are not lost when rawInput changes (e.g. when
  // snippets are added).
  useEffect(() => {
    if (!rawInput.trim()) {
      setInputJson(undefined)
      setOutputJson(undefined)
      setParseError(undefined)
      return
    }

    const { value, error } = safeParseJson(rawInput)
    if (error || !value) {
      setParseError(error ?? 'Invalid JSON')
      setInputJson(undefined)
      // Do not touch outputJson here – it may contain user changes
    } else {
      setParseError(undefined)
      setInputJson(value)

      // Initialise outputJson only once (first successful parse), and reorder it
      setOutputJson((current) => {
        if (current === undefined) {
          return reorderJsonBySnippets(value)
        }
        return current
      })

      const pretty = prettyPrintJson(value)
      if (pretty && pretty !== rawInput) {
        setRawInput(pretty)
      }
    }
  }, [rawInput])

  const fileTypeOptions = useMemo(
    () => ['all', ...Array.from(new Set(snippets.map((s) => s.fileType)))],
    [snippets],
  )

  const [fileTypeUserSelected, setFileTypeUserSelected] = useState(true) // Start as true since we set default to 'all'

  // Auto-guess file type based on most matching snippets
  useEffect(() => {
    if (!inputJson || fileTypeUserSelected || fileTypeOptions.length === 0 || fileType === 'all') return
    if (typeof inputJson !== 'object' || Array.isArray(inputJson)) return
    
    const obj = inputJson as Record<string, unknown>
    const fileTypeCounts = new Map<string, number>()
    
    for (const snippet of snippets) {
      if (snippet.rootKey in obj) {
        const count = fileTypeCounts.get(snippet.fileType) || 0
        fileTypeCounts.set(snippet.fileType, count + 1)
      }
    }
    
    if (fileTypeCounts.size > 0) {
      const bestMatch = Array.from(fileTypeCounts.entries()).sort((a, b) => b[1] - a[1])[0]
      setFileType(bestMatch[0])
    } else if (!fileType) {
      setFileType(fileTypeOptions[0])
    }
  }, [inputJson, snippets, fileTypeOptions, fileTypeUserSelected, fileType])

  const activeSnippets = useMemo(
    () =>
      snippets.filter(
        (s) =>
          (fileType === 'all' || !fileType || s.fileType === fileType) &&
          inputJson &&
          typeof inputJson === 'object' &&
          !Array.isArray(inputJson) &&
          s.rootKey in (inputJson as any),
      ),
    [snippets, fileType, inputJson],
  )

  const handleControlChange = ({ path, value }: ControlChangePayload) => {
    if (!outputJson) return
    const updated = setIn(outputJson, path, value as JsonValue)
    setOutputJson(updated)
  }

  // Reorder JSON object keys to match snippetsForFileType order
  const reorderJsonBySnippets = (json: JsonValue): JsonValue => {
    try {
      if (!json || typeof json !== 'object' || Array.isArray(json)) return json
      
      const jsonObj = json as Record<string, unknown>
      const ordered: Record<string, unknown> = {}
      
      // Add snippets in their list order
      if (snippetsForFileType && Array.isArray(snippetsForFileType)) {
        for (const s of snippetsForFileType) {
          if (s && s.rootKey && s.rootKey in jsonObj) {
            ordered[s.rootKey] = jsonObj[s.rootKey]
          }
        }
      }
      
      // Add any keys that aren't snippets
      for (const key in jsonObj) {
        if (Object.prototype.hasOwnProperty.call(jsonObj, key)) {
          if (!snippetsForFileType || !snippetsForFileType.some(s => s && s.rootKey === key)) {
            ordered[key] = jsonObj[key]
          }
        }
      }
      
      return ordered as JsonValue
    } catch (error) {
      console.error('Error reordering JSON:', error)
      return json // Return original on error
    }
  }

  const snippetsForFileType = useMemo(
    () => snippets.filter((s) => !fileType || fileType === 'all' || s.fileType === fileType),
    [snippets, fileType],
  )

  const handleInsertSnippetIntoInput = (snippetId: string | null) => {
    try {
      if (!snippetId) return
      const snippet = snippetsForFileType.find((s) => s.id === snippetId)
      if (!snippet || !snippet.parsedSnippet) return

      // For input JSON: always use the original inputJson (not outputJson with control changes)
      const inputBase: JsonValue = 
        inputJson && typeof inputJson === 'object' && !Array.isArray(inputJson)
          ? inputJson
          : {}
      
      const inputBaseObj = inputBase as Record<string, unknown>
      
      // Check if snippet's root key already exists in input
      if (snippet.rootKey in inputBaseObj) {
        return
      }

      // Handle snippet structure: if parsedSnippet is an object, merge all its keys
      // Otherwise, use the root key structure
      let snippetData: Record<string, unknown>
      if (snippet.parsedSnippet && typeof snippet.parsedSnippet === 'object' && !Array.isArray(snippet.parsedSnippet)) {
        const snippetObj = snippet.parsedSnippet as Record<string, unknown>
        // Check if the root key exists in the parsed snippet
        if (snippet.rootKey in snippetObj && snippetObj[snippet.rootKey] !== undefined) {
          // Single key structure: use the root key's value
          snippetData = { [snippet.rootKey]: snippetObj[snippet.rootKey] }
        } else {
          // Multiple keys structure: merge all keys from parsedSnippet
          // Filter out undefined values
          snippetData = {}
          for (const [key, value] of Object.entries(snippetObj)) {
            if (value !== undefined) {
              snippetData[key] = value
            }
          }
        }
      } else {
        // Fallback: use root key with parsed snippet value
        if (snippet.parsedSnippet !== undefined) {
          snippetData = { [snippet.rootKey]: snippet.parsedSnippet }
        } else {
          console.warn('Snippet parsedSnippet is undefined')
          return
        }
      }

      // Validate snippetData is not empty
      if (!snippetData || Object.keys(snippetData).length === 0) {
        console.warn('Snippet data is empty')
        return
      }

      // Add the new snippet to the input JSON (original, unmodified)
      const newInputJson = {
        ...inputBaseObj,
        ...snippetData
      }
      const orderedInput = reorderJsonBySnippets(newInputJson as JsonValue)
      
      // Validate orderedInput
      if (!orderedInput) {
        console.warn('Failed to reorder JSON')
        return
      }
      
      // Format the JSON first
      const formatted = prettyPrintJson(orderedInput)
      if (!formatted) {
        console.warn('Failed to format JSON')
        return
      }

      // For output JSON: merge into existing outputJson to preserve control changes
      const outputBase: JsonValue = 
        outputJson && typeof outputJson === 'object' && !Array.isArray(outputJson)
          ? outputJson
          : orderedInput
      
      const outputBaseObj = outputBase as Record<string, unknown>
      const newOutputJson = {
        ...outputBaseObj,
        ...snippetData
      }
      const orderedOutput = reorderJsonBySnippets(newOutputJson as JsonValue)
      
      // Batch state updates to avoid race conditions
      // Set outputJson first (doesn't trigger useEffect)
      if (orderedOutput) {
        setOutputJson(orderedOutput)
      }
      // Set rawInput last - this will trigger useEffect to re-parse and update inputJson
      // Don't set inputJson directly here to avoid conflicts with useEffect
      setRawInput(formatted)

      // If file type is 'all' or not set, adopt the snippet's file type
      if (!fileType || fileType === 'all') {
        setFileType(snippet.fileType)
        setFileTypeUserSelected(true)
      }
    } catch (error) {
      console.error('Error inserting snippet:', error)
      // Don't crash the app, just log the error
    }
  }

  const handleRemoveSnippetFromInput = (snippetId: string) => {
    const snippet = snippetsForFileType.find((s) => s.id === snippetId)
    if (!snippet) return

    // Use outputJson if available (preserves control changes), otherwise inputJson
    const jsonToModify = (outputJson && typeof outputJson === 'object' && !Array.isArray(outputJson))
      ? outputJson
      : (inputJson && typeof inputJson === 'object' && !Array.isArray(inputJson))
        ? inputJson
        : null

    if (!jsonToModify) return

    // Remove the root key from the JSON
    const obj = { ...jsonToModify } as Record<string, unknown>
    delete obj[snippet.rootKey]

    // Reorder to maintain snippet list order
    const ordered = reorderJsonBySnippets(obj as JsonValue)

    // Update both outputJson and rawInput
    setOutputJson(ordered)
    const formatted = prettyPrintJson(ordered)
    if (formatted) {
      setRawInput(formatted)
    }
  }

  // Check if a snippet is present in the input JSON
  const isSnippetInInput = (snippet: { rootKey: string }) => {
    if (!inputJson || typeof inputJson !== 'object' || Array.isArray(inputJson)) return false
    return snippet.rootKey in (inputJson as Record<string, unknown>)
  }

  const formattedOutput = prettyPrintJson(outputJson)

  return (
    <Box
      style={{
        height: 'calc(100vh - 52px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box px="md" py="xs" style={{ flexShrink: 0 }}>
        <Title order={4}>JSON editor</Title>
      </Box>
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '360px 480px minmax(0, 1fr) minmax(0, 1fr)',
          gap: 0,
        }}
      >
        {/* Column 0: Snippets */}
        <Card
          withBorder
          radius={0}
          p={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Group
            justify="space-between"
            align="center"
            wrap="nowrap"
            p="xs"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: COLUMN_HEADER_MIN_HEIGHT,
            }}
          >
            <Text fw={500}>Snippets</Text>
            <Select
              placeholder="File type"
              data={fileTypeOptions}
              value={fileType}
              onChange={(value) => {
                setFileType(value)
                setFileTypeUserSelected(true)
              }}
              size="xs"
              w={160}
              allowDeselect={false}
            />
          </Group>
          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <Stack gap="xs" p="xs">
              {snippetsForFileType.length === 0 ? (
                <Text size="xs" c="dimmed">
                  No snippets for this file type.
                </Text>
              ) : (
                (() => {
                  // Group snippets by file type, then by accordion group
                  const fileTypeGroups = new Map<string, Map<string, typeof snippetsForFileType>>()
                  for (const snippet of snippetsForFileType) {
                    const ft = snippet.fileType
                    const group = snippet.accordionGroup || 'General'
                    
                    if (!fileTypeGroups.has(ft)) {
                      fileTypeGroups.set(ft, new Map())
                    }
                    const groups = fileTypeGroups.get(ft)!
                    const list = groups.get(group) ?? []
                    list.push(snippet)
                    groups.set(group, list)
                  }

                  return Array.from(fileTypeGroups.entries()).map(([ft, groups]) => (
                    <Stack key={ft} gap="xs">
                      <Text size="xs" fw={700} c="blue" tt="uppercase">
                        {ft}
                      </Text>
                      {Array.from(groups.entries()).map(([groupName, groupSnippets]) => (
                        <Stack key={groupName} gap={4}>
                          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                            {groupName}
                          </Text>
                          {groupSnippets.map((snippet) => (
                            <Group
                              key={snippet.id}
                              justify="space-between"
                              gap="xs"
                              style={{
                                padding: '4px 6px',
                                borderRadius: 4,
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                cursor: 'pointer',
                              }}
                              onClick={() => handleInsertSnippetIntoInput(snippet.id)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
                              }}
                            >
                              <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                                <Text size="xs" fw={500} lineClamp={1}>
                                  {snippet.name}
                                </Text>
                                {snippet.description && (
                                  <Text size="xs" c="dimmed" lineClamp={2}>
                                    {snippet.description}
                                  </Text>
                                )}
                              </Stack>
                              {isSnippetInInput(snippet) ? (
                                <Button
                                  size="xs"
                                  variant="light"
                                  color="red"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRemoveSnippetFromInput(snippet.id)
                                  }}
                                >
                                  Remove
                                </Button>
                              ) : (
                                <Button
                                  size="xs"
                                  variant="light"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleInsertSnippetIntoInput(snippet.id)
                                  }}
                                >
                                  Add
                                </Button>
                              )}
                            </Group>
                          ))}
                        </Stack>
                      ))}
                    </Stack>
                  ))
                })()
              )}
            </Stack>
          </Box>
        </Card>

        {/* Column 1: Controls */}
        <Card
          withBorder
          radius={0}
          p={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: 480,
          }}
        >
          <Group
            justify="space-between"
            align="center"
            p="xs"
            wrap="nowrap"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: COLUMN_HEADER_MIN_HEIGHT,
              maxHeight: COLUMN_HEADER_MIN_HEIGHT,
              overflow: 'hidden',
            }}
          >
            <Text fw={500}>Controls</Text>
            {activeSnippets.length > 0 && (
              <Tooltip
                label={openedSnippets.length === allSnippetIds.length ? 'Collapse all' : 'Expand all'}
                openDelay={0}
                closeDelay={0}
                withArrow={false}
                transitionProps={{ duration: 0 }}
                styles={{ tooltip: { fontSize: 11, padding: '4px 8px' } }}
              >
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="blue"
                  onClick={() =>
                    setOpenedSnippets(
                      openedSnippets.length === allSnippetIds.length ? [] : allSnippetIds,
                    )
                  }
                >
                  {openedSnippets.length === allSnippetIds.length ? (
                    <IconArrowBadgeUp size={14} />
                  ) : (
                    <IconArrowBadgeDown size={14} />
                  )}
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <ControlsPanel
              snippets={activeSnippets}
              currentJson={outputJson}
              onChange={handleControlChange}
              openedSnippets={openedSnippets}
              setOpenedSnippets={setOpenedSnippets}
            />
          </Box>
        </Card>

        {/* Column 2: Input JSON */}
        <Card
          withBorder
          radius={0}
          p={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Group
            justify="space-between"
            align="center"
            p="xs"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: COLUMN_HEADER_MIN_HEIGHT,
            }}
          >
            <Text fw={500}>Input JSON</Text>
            {rawInput.trim().length > 0 && (
              <Button size="xs" variant="default" onClick={() => setRawInput('')}>
                Clear
              </Button>
            )}
          </Group>
          <Box style={{ flex: 1, minHeight: 0 }}>
            <JsonCodeEditor 
              value={rawInput} 
              onChange={setRawInput} 
              height="100%" 
              showColorSwatches={true}
            />
          </Box>
          {parseError && (
            <Text size="sm" c="red" p="xs" style={{ flexShrink: 0 }}>
              {parseError}
            </Text>
          )}
        </Card>

        {/* Column 3: Output JSON */}
        <Card
          withBorder
          radius={0}
          p={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Group
            justify="space-between"
            align="center"
            p="xs"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: COLUMN_HEADER_MIN_HEIGHT,
            }}
          >
            <Text fw={500}>Output JSON</Text>
            <CopyButton value={formattedOutput}>
              {({ copied, copy }) => (
                <Button size="xs" variant="light" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </Group>
          <Box style={{ flex: 1, minHeight: 0 }}>
            <JsonCodeEditor 
              value={formattedOutput} 
              readOnly 
              height="100%" 
              highlightChanges 
              compareWith={rawInput}
              showColorSwatches={true}
            />
          </Box>
        </Card>
      </Box>
    </Box>
  )
}
