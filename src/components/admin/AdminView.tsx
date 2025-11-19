import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Button,
  Card,
  Group,
  TextInput,
  Title,
  Text,
  Select,
  Alert,
  Box,
  Stack,
} from '@mantine/core'
import { IconInfoCircle, IconPlus } from '@tabler/icons-react'
import { useSnippetStore } from '../../state/snippetStore'
import { prettyPrintJson, safeParseJson, setIn } from '../../utils/jsonUtils'
import { detectSnippetConfigFromJson } from '../../utils/fieldDetection'
import type { FieldConfig, SnippetDefinition, JsonValue } from '../../types/snippets'
import { FieldConfigTree } from './FieldConfigTree'
import { SnippetSidebar } from './SnippetSidebar'
import { JsonCodeEditor } from '../common/JsonCodeEditor'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export function AdminView() {
  const { snippets, addSnippet, updateSnippet, deleteSnippet, reorderSnippetsForFileType } =
    useSnippetStore()

  const [snippetText, setSnippetText] = useState('')
  const [snippetValue, setSnippetValue] = useState<JsonValue | undefined>()
  const [name, setName] = useState('')
  const [fileType, setFileType] = useState('config.json')
  const [accordionGroup, setAccordionGroup] = useState('General')
  const [creatingFileType, setCreatingFileType] = useState(false)
  const [newFileType, setNewFileType] = useState('')
  const [creatingAccordionGroup, setCreatingAccordionGroup] = useState(false)
  const [newAccordionGroup, setNewAccordionGroup] = useState('')
  const [parseError, setParseError] = useState<string | undefined>()
  const [detectedFields, setDetectedFields] = useState<FieldConfig[] | null>(null)
  const [rootKey, setRootKey] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const fileTypeOptions = useMemo(() => {
    const fromSnippets = Array.from(new Set(snippets.map((s) => s.fileType)))
    const options = [...fromSnippets]
    // Always include currently selected fileType so Select/TextInput can show it
    if (fileType && !options.includes(fileType)) {
      options.push(fileType)
    }
    return options
  }, [snippets, fileType])

  const [sidebarFileType, setSidebarFileType] = useState<string | 'all'>('all')
  const [sidebarSearch, setSidebarSearch] = useState('')

  const snippetsForSidebar = useMemo(() => {
    let list = snippets
    if (sidebarFileType !== 'all') {
      list = list.filter((s) => s.fileType === sidebarFileType)
    } else {
      // In "all" view, show snippets alphabetically by name
      list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    }

    const query = sidebarSearch.trim().toLowerCase()
    if (query.length >= 2) {
      list = list.filter((s) => s.name.toLowerCase().includes(query))
    }
    return list
  }, [snippets, sidebarFileType, sidebarSearch])

  const accordionGroupOptions = useMemo(() => {
    // Only show accordion groups that are actually used by snippets of this file type
    const relevantSnippets = snippets.filter((s) => s.fileType === fileType)
    const groups = Array.from(new Set(relevantSnippets.map((s) => s.accordionGroup)))
    // Always include currently selected group so Select can show it
    if (accordionGroup && !groups.includes(accordionGroup)) {
      groups.push(accordionGroup)
    }
    return groups
  }, [snippets, fileType, accordionGroup])

  const handleConfirmNewAccordionGroup = () => {
    const raw = newAccordionGroup.trim()
    if (!raw) return

    // If it already exists (case-insensitive), just select it
    const existing = accordionGroupOptions.find(
      (g) => g.toLowerCase() === raw.toLowerCase(),
    )
    if (existing) {
      setAccordionGroup(existing)
      setCreatingAccordionGroup(false)
      return
    }

    // Otherwise simply set it; it will appear in the dropdown once at least one
    // snippet is saved with this accordionGroup for this file type.
    setAccordionGroup(raw)
    setCreatingAccordionGroup(false)
  }

  const handleConfirmNewFileType = () => {
    const raw = newFileType.trim()
    if (!raw) return

    // If it already exists (case-insensitive), just select it
    const existing = fileTypeOptions.find((t) => t.toLowerCase() === raw.toLowerCase())
    if (existing) {
      setFileType(existing)
      setCreatingFileType(false)
      return
    }

    // Otherwise just set it; it will appear in the dropdown once a snippet
    // is saved using this file type.
    setFileType(raw)
    setCreatingFileType(false)
  }

  const handleParseSnippet = () => {
    setParseError(undefined)
    setDetectedFields(null)
    setRootKey(null)

    const { value, error } = safeParseJson(snippetText)
    if (error || !value) {
      setParseError(error ?? 'Invalid JSON')
      return
    }

    const pretty = prettyPrintJson(value)
    if (pretty && pretty !== snippetText) {
      setSnippetText(pretty)
    }

    setSnippetValue(value)

    const { rootKey: detectedRootKey, fields } = detectSnippetConfigFromJson(value)
    setDetectedFields(fields)
    setRootKey(detectedRootKey)
    if (!name) {
      setName(prettifyKey(detectedRootKey))
    }
  }

  const handleToggleEditable = (fieldId: string, editable: boolean) => {
    if (!detectedFields) return
    const updated = toggleEditableInTree(detectedFields, fieldId, editable)
    setDetectedFields(updated)
  }

  const handleChangeDefault = (fieldId: string, value: unknown) => {
    if (!detectedFields) return
    const updatedFields = updateDefaultInTree(detectedFields, fieldId, value)
    setDetectedFields(updatedFields)

    // Reflect default changes into the JSON snippet preview
    const targetField = findFieldById(updatedFields, fieldId)
    if (!targetField) return

    setSnippetValue((current) => {
      if (!current) return current

      const base = current
      const rootLooksLikeObject =
        base &&
        typeof base === 'object' &&
        !Array.isArray(base) &&
        rootKey &&
        (base as any)[rootKey] !== undefined

      const pathPrefix: (string | number)[] = rootLooksLikeObject && rootKey ? [rootKey] : []
      const fullPath = [...pathPrefix, ...targetField.path]

      const updatedJson = setIn(base, fullPath, value as JsonValue)
      const prettyUpdated = prettyPrintJson(updatedJson)
      if (prettyUpdated) {
        setSnippetText(prettyUpdated)
      }
      return updatedJson
    })
  }

  const handleChangeNumberBounds = (
    fieldId: string,
    bounds: { min?: number; max?: number },
  ) => {
    if (!detectedFields) return
    const updated = updateNumberBoundsInTree(detectedFields, fieldId, bounds)
    setDetectedFields(updated)
  }

  const handleEditSnippetFields = (snippet: SnippetDefinition) => {
    setEditingId(snippet.id)
    setSnippetText(snippet.snippetText)
    setSnippetValue(snippet.parsedSnippet)
    setName(snippet.name)
    setFileType(snippet.fileType)
    setAccordionGroup(snippet.accordionGroup)
    setParseError(undefined)
    setRootKey(snippet.rootKey)
    // Deep clone fields so edits do not mutate store until saved
    const clonedFields = JSON.parse(JSON.stringify(snippet.fields)) as FieldConfig[]
    setDetectedFields(clonedFields)
  }

  const handleCancelEditing = () => {
    setEditingId(null)
    setSnippetText('')
    setName('')
    setSnippetValue(undefined)
    setDetectedFields(null)
    setRootKey(null)
    setParseError(undefined)
  }

  const handleSaveSnippet = () => {
    if (!detectedFields || !rootKey) return
    const { value } = safeParseJson(snippetText)
    if (!value) return

    const now = new Date().toISOString()
    if (editingId) {
      const existing = snippets.find((s) => s.id === editingId)
      if (!existing) return
      const updated: SnippetDefinition = {
        ...existing,
        name: name || prettifyKey(rootKey),
        fileType,
        accordionGroup,
        snippetText,
        parsedSnippet: value,
        rootKey,
        fields: detectedFields,
        updatedAt: now,
      }
      updateSnippet(updated)
    } else {
      const snippet: SnippetDefinition = {
        id: createId(),
        name: name || prettifyKey(rootKey),
        fileType,
        accordionGroup,
        snippetText,
        parsedSnippet: value,
        rootKey,
        fields: detectedFields,
        createdAt: now,
        updatedAt: now,
      }
      addSnippet(snippet)
    }

    // reset form
    setSnippetText('')
    setName('')
    setDetectedFields(null)
    setRootKey(null)
    setEditingId(null)
  }

  const canSave = Boolean(detectedFields && rootKey && snippetText.trim())
  const isEditing = Boolean(editingId)

  return (
    <Box
      style={{
        height: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {(isEditing || true) && (
        <Box px="md" py="xs" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Group justify="space-between" align="center">
            <Title order={4}>Snippet builder</Title>
            {isEditing && (
              <Button variant="subtle" size="xs" onClick={handleCancelEditing}>
                Cancel editing
              </Button>
            )}
          </Group>
        </Box>
      )}
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.3fr) minmax(0, 0.35fr) minmax(0, 0.35fr)',
          gap: 0,
        }}
      >
        {/* Column 1: Snippets */}
        <Card
          withBorder
          radius={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Group justify="space-between" align="center" p="xs" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', minHeight: 44 }}>
            <Text fw={500}>Snippets</Text>
            <Group gap={6}>
              <Select
                size="xs"
                data={['all', ...fileTypeOptions]}
                value={sidebarFileType}
                onChange={(value) =>
                  setSidebarFileType((value as string | null) ?? 'all')
                }
                w={110}
                allowDeselect={false}
              />
              <TextInput
                placeholder="Search…"
                size="xs"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.currentTarget.value)}
                w={120}
              />
            </Group>
          </Group>
          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <SnippetSidebar
              snippets={snippetsForSidebar}
              activeId={editingId ?? null}
              onSelect={handleEditSnippetFields}
              onReorder={(orderedIds) =>
                reorderSnippetsForFileType(sidebarFileType, orderedIds)
              }
              onDelete={deleteSnippet}
              enableSorting={sidebarFileType !== 'all'}
            />
          </Box>
        </Card>

        {/* Column 2: JSON snippet */}
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
            <Text fw={500}>JSON snippet</Text>
            {!isEditing && (
              <Button size="xs" variant="light" onClick={handleParseSnippet}>
                Make Snippet
              </Button>
            )}
          </Group>
          <Box style={{ flex: 1, minHeight: 0 }}>
            <JsonCodeEditor
              value={snippetText}
              onChange={setSnippetText}
              height="100%"
            />
          </Box>
          {parseError && (
            <Alert color="red" icon={<IconInfoCircle size={16} />} style={{ flexShrink: 0, borderRadius: 0 }}>
              {parseError}
            </Alert>
          )}
        </Card>

        {/* Column 3: Detected fields */}
        <Card
          withBorder
          radius={0}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Group justify="space-between" align="center" p="xs" mb="xs" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', minHeight: 44 }}>
            <Text fw={500}>Snippet Config</Text>
            <Button size="xs" onClick={handleSaveSnippet} disabled={!canSave}>
              {isEditing ? 'Update Snippet' : 'Save Snippet'}
            </Button>
          </Group>
          <Stack gap="xs" px="xs" mb="xs" style={{ flexShrink: 0 }}>
            <Group grow gap="xs" align="flex-end">
              {creatingFileType ? (
                <TextInput
                  label="File type"
                  size="xs"
                  value={newFileType}
                  placeholder="New file type"
                  onChange={(e) => setNewFileType(e.currentTarget.value)}
                  rightSectionPointerEvents="auto"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleConfirmNewFileType()
                      }}
                    >
                      <IconPlus size={14} />
                    </ActionIcon>
                  }
                />
              ) : (
                <Select
                  label={
                    <Group gap={4} align="center">
                      <Text size="xs">File type</Text>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setNewFileType('')
                          setCreatingFileType(true)
                        }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  }
                  size="xs"
                  data={fileTypeOptions}
                  value={fileType}
                  searchable
                  onChange={(value) => value && setFileType(value)}
                />
              )}

              {creatingAccordionGroup ? (
                <TextInput
                  label="Group"
                  size="xs"
                  value={newAccordionGroup}
                  placeholder="New accordion group"
                  onChange={(e) => setNewAccordionGroup(e.currentTarget.value)}
                  rightSectionPointerEvents="auto"
                  rightSection={
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleConfirmNewAccordionGroup()
                      }}
                    >
                      <IconPlus size={14} />
                    </ActionIcon>
                  }
                />
              ) : (
                <Select
                  label={
                    <Group gap={4} align="center">
                      <Text size="xs">Group</Text>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setNewAccordionGroup('')
                          setCreatingAccordionGroup(true)
                        }}
                      >
                        <IconPlus size={12} />
                      </ActionIcon>
                    </Group>
                  }
                  size="xs"
                  data={accordionGroupOptions}
                  value={accordionGroup}
                  searchable
                  onChange={(value) => {
                    if (value) setAccordionGroup(value)
                  }}
                />
              )}

              <TextInput
                label="Name"
                size="xs"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
            </Group>
          </Stack>
          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} px="xs">
            {!detectedFields && (
              <Text size="sm" c="dimmed">
                Run &quot;Detect fields&quot; to inspect the snippet structure and choose
                which fields are editable.
              </Text>
            )}
            {detectedFields && (
              <FieldConfigTree
                fields={detectedFields}
                onToggleEditable={handleToggleEditable}
                onChangeDefault={handleChangeDefault}
                onChangeNumberBounds={handleChangeNumberBounds}
              />
            )}
          </Box>
        </Card>
      </Box>
    </Box>
  )
}

function toggleEditableInTree(
  fields: FieldConfig[],
  fieldId: string,
  editable: boolean,
): FieldConfig[] {
  return fields.map((field) => {
    if (field.id === fieldId) {
      return { ...field, editable } as FieldConfig
    }
    if ('children' in field && field.children) {
      return {
        ...field,
        children: toggleEditableInTree(field.children, fieldId, editable),
      } as FieldConfig
    }
    return field
  })
}

function updateDefaultInTree(
  fields: FieldConfig[],
  fieldId: string,
  value: unknown,
): FieldConfig[] {
  return fields.map((field) => {
    if (field.id === fieldId && 'defaultValue' in field) {
      return { ...field, defaultValue: value } as FieldConfig
    }
    if ('children' in field && field.children) {
      return {
        ...field,
        children: updateDefaultInTree(field.children, fieldId, value),
      } as FieldConfig
    }
    return field
  })
}

function updateNumberBoundsInTree(
  fields: FieldConfig[],
  fieldId: string,
  bounds: { min?: number; max?: number },
): FieldConfig[] {
  return fields.map((field) => {
    if (field.id === fieldId && field.kind === 'number') {
      return {
        ...field,
        min: bounds.min,
        max: bounds.max,
      } as FieldConfig
    }
    if ('children' in field && field.children) {
      return {
        ...field,
        children: updateNumberBoundsInTree(field.children, fieldId, bounds),
      } as FieldConfig
    }
    return field
  })
}

function prettifyKey(key: string): string {
  if (!key) return ''
  // Replace underscores/dashes with spaces
  let result = key.replace(/[_-]+/g, ' ')
  // Insert spaces before camelCase capitals: poiInfo -> poi Info
  result = result.replace(/([a-z])([A-Z])/g, '$1 $2')
  // Lowercase everything, then capitalize each word
  result = result
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
  return result
}

function findFieldById(fields: FieldConfig[], fieldId: string): FieldConfig | undefined {
  for (const field of fields) {
    if (field.id === fieldId) return field
    if ('children' in field && field.children) {
      const found = findFieldById(field.children as FieldConfig[], fieldId)
      if (found) return found
    }
  }
  return undefined
}
