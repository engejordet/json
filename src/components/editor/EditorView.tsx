import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CopyButton,
  Group,
  Select,
  Text,
  Title,
} from '@mantine/core'
import { useSnippetStore } from '../../state/snippetStore'
import { prettyPrintJson, safeParseJson, setIn, deepMerge } from '../../utils/jsonUtils'
import type { JsonValue } from '../../types/snippets'
import { ControlsPanel, type ControlChangePayload } from './ControlsPanel'
import { JsonCodeEditor } from '../common/JsonCodeEditor'

export function EditorView() {
  const { snippets } = useSnippetStore()
  const [rawInput, setRawInput] = useState('')
  const [fileType, setFileType] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | undefined>()
  const [inputJson, setInputJson] = useState<JsonValue | undefined>()
  const [outputJson, setOutputJson] = useState<JsonValue | undefined>()

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
      setOutputJson(undefined)
    } else {
      setParseError(undefined)
      setInputJson(value)
      setOutputJson(value)
      const pretty = prettyPrintJson(value)
      if (pretty && pretty !== rawInput) {
        setRawInput(pretty)
      }
    }
  }, [rawInput])

  const fileTypeOptions = useMemo(
    () => Array.from(new Set(snippets.map((s) => s.fileType))),
    [snippets],
  )

  const [fileTypeUserSelected, setFileTypeUserSelected] = useState(false)

  // Auto-guess file type based on most matching snippets
  useEffect(() => {
    if (!inputJson || fileTypeUserSelected || fileTypeOptions.length === 0) return
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
          (!fileType || s.fileType === fileType) &&
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

  const snippetsForFileType = useMemo(
    () => snippets.filter((s) => !fileType || s.fileType === fileType),
    [snippets, fileType],
  )

  const snippetInsertOptions = useMemo(
    () => snippetsForFileType.map((s) => ({ value: s.id, label: s.name })),
    [snippetsForFileType],
  )

  const [snippetInsertSelection, setSnippetInsertSelection] = useState<string | null>(null)

  const handleInsertSnippetIntoInput = (snippetId: string | null) => {
    if (!snippetId) return
    const snippet = snippetsForFileType.find((s) => s.id === snippetId)
    if (!snippet || !snippet.parsedSnippet) return

    const base: JsonValue =
      inputJson && typeof inputJson === 'object' && !Array.isArray(inputJson)
        ? inputJson
        : {}

    const merged = deepMerge(base, snippet.parsedSnippet)
    const formatted = prettyPrintJson(merged)
    if (formatted) {
      setRawInput(formatted)
    }

    // If no file type has been chosen yet, adopt the snippet's file type
    if (!fileType) {
      setFileType(snippet.fileType)
      setFileTypeUserSelected(true)
    }
  }

  const formattedOutput = prettyPrintJson(outputJson)

  return (
    <Box
      style={{
        height: 'calc(100vh - 60px)',
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
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 340px',
          gap: 0,
        }}
      >
        {/* Column 1: Input JSON */}
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
            style={{ flexShrink: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', minHeight: 44 }}
          >
            <Text fw={500}>Input JSON</Text>
            <Select
              placeholder="Add snippet"
              size="xs"
              searchable
              clearable
              data={snippetInsertOptions}
              w={220}
              value={snippetInsertSelection}
              onChange={(value) => {
                if (value) {
                  handleInsertSnippetIntoInput(value)
                  // reset selection so placeholder shows again
                  setSnippetInsertSelection(null)
                } else {
                  setSnippetInsertSelection(null)
                }
              }}
            />
          </Group>
          <Box style={{ flex: 1, minHeight: 0 }}>
            <JsonCodeEditor value={rawInput} onChange={setRawInput} height="100%" />
          </Box>
          {parseError && (
            <Text size="sm" c="red" p="xs" style={{ flexShrink: 0 }}>
              {parseError}
            </Text>
          )}
        </Card>

        {/* Column 2: Output JSON */}
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
          <Group justify="space-between" align="center" p="xs" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', minHeight: 44 }}>
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
            <JsonCodeEditor value={formattedOutput} readOnly height="100%" />
          </Box>
        </Card>

        {/* Column 3: Controls */}
        <Card
          withBorder
          radius={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: 340,
          }}
        >
          <Group justify="space-between" align="center" p="xs" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', minHeight: 44 }}>
            <Text fw={500}>Controls</Text>
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
          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '0.5rem' }}>
            <ControlsPanel snippets={activeSnippets} onChange={handleControlChange} />
          </Box>
        </Card>
      </Box>
    </Box>
  )
}
