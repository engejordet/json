import { useMemo, useRef, useState } from 'react'
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
  Menu,
  Modal,
  CopyButton,
} from '@mantine/core'
import { IconDotsVertical, IconInfoCircle, IconPlus, IconArrowLeft, IconTrash } from '@tabler/icons-react'
import { useSnippetStore } from '../../state/snippetStore'
import { prettyPrintJson, safeParseJson, setIn, isHexColor, isRgbaColor, hasAlphaChannel } from '../../utils/jsonUtils'
import { detectSnippetConfigFromJson } from '../../utils/fieldDetection'
import type { FieldConfig, SnippetDefinition, JsonValue } from '../../types/snippets'
import { FieldConfigTree } from './FieldConfigTree'
import { SnippetSidebar } from './SnippetSidebar'
import { JsonCodeEditor } from '../common/JsonCodeEditor'
import { COLUMN_HEADER_MIN_HEIGHT } from '../../constants/layout'

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export function AdminView() {
  const {
    snippets,
    addSnippet,
    updateSnippet,
    updateSnippetMetadata,
    deleteSnippet,
    reorderSnippetsForFileType,
    clearSnippets,
  } = useSnippetStore()

  const [snippetText, setSnippetText] = useState('')
  const [snippetValue, setSnippetValue] = useState<JsonValue | undefined>()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
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
  const [deleteEnabled, setDeleteEnabled] = useState(false)
  const [duplicateRootKeyModal, setDuplicateRootKeyModal] = useState<{
    open: boolean
    existingSnippet: SnippetDefinition | null
  }>({ open: false, existingSnippet: null })

  const snippetsForSidebar = useMemo(() => {
    let list = snippets
    if (sidebarFileType !== 'all') {
      list = list.filter((s) => s.fileType === sidebarFileType)
    }
    // In "all" view, use the global order from the snippets array (no sorting)
    // This preserves the order set by drag-and-drop

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

  // Check if current snippetText is valid JSON
  const hasValidJson = useMemo(() => {
    if (!snippetText.trim()) return false
    const { error } = safeParseJson(snippetText)
    return !error
  }, [snippetText])

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

  const importInputRef = useRef<HTMLInputElement | null>(null)

  const handleExportSnippets = () => {
    if (!snippets.length) return
    try {
      const data = JSON.stringify(snippets, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'snippets-export.json'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to export snippets', error)
    }
  }

  const handleImportSnippetsFromFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = String(reader.result ?? '')
        const parsed = JSON.parse(text) as unknown
        if (!Array.isArray(parsed)) {
          throw new Error('Import JSON must be an array of snippets')
        }
        const now = new Date().toISOString()
        parsed.forEach((raw) => {
          const snippet = raw as SnippetDefinition
          if (!snippet.id || !snippet.rootKey) return
          const existing = snippets.find((s) => s.id === snippet.id)
          const normalized: SnippetDefinition = {
            ...snippet,
            createdAt: snippet.createdAt ?? now,
            updatedAt: now,
          }
          if (existing) {
            updateSnippet({ ...existing, ...normalized })
          } else {
            addSnippet(normalized)
          }
        })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to import snippets', error)
        // eslint-disable-next-line no-alert
        alert('Failed to import snippets. Please check the JSON format.')
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleClearAllSnippets = () => {
    if (!snippets.length) return
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm('Remove all snippets? This cannot be undone.')
    if (!confirmed) return
    clearSnippets()
    handleCancelEditing()
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

  const handlePasteSnippetFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        // eslint-disable-next-line no-alert
        alert('Clipboard API not available in this browser.')
        return
      }
      const text = await navigator.clipboard.readText()
      if (!text) return

      // Clear current editing context and load new snippet text
      setEditingId(null)
      setDetectedFields(null)
      setRootKey(null)
      setParseError(undefined)
      setName('')
      setDescription('')
      setSnippetText(text)
      setSnippetValue(undefined)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to read from clipboard', error)
      // eslint-disable-next-line no-alert
      alert('Failed to read from clipboard. Please try again or paste manually.')
    }
  }

  const handleClearSnippetEditor = () => {
    // Deselect any snippet and clear the JSON editor content
    setEditingId(null)
    setDetectedFields(null)
    setRootKey(null)
    setParseError(undefined)
    setName('')
    setDescription('')
    setSnippetText('')
    setSnippetValue(undefined)
  }

  const handleDeleteEditingSnippet = () => {
    if (!editingId) return
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(`Delete snippet "${name || 'Untitled'}"? This cannot be undone.`)
    if (!confirmed) return
    deleteSnippet(editingId)
    handleClearSnippetEditor()
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

  const handleChangeFieldType = (fieldId: string, newType: 'string' | 'number' | 'color-solid' | 'color-alpha') => {
    if (!detectedFields) return
    const updated = updateFieldTypeInTree(detectedFields, fieldId, newType)
    setDetectedFields(updated)
  }

  const handleEditSnippetFields = (snippet: SnippetDefinition) => {
    setEditingId(snippet.id)
    setSnippetText(snippet.snippetText)
    setSnippetValue(snippet.parsedSnippet)
    setName(snippet.name)
    setDescription(snippet.description ?? '')
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

  const handleReplaceWithSnippet = (targetSnippet: SnippetDefinition) => {
    // Clear editing state - treat this as a new configuration
    setEditingId(null)
    
    // Clear parse error first (same as handleParseSnippet)
    setParseError(undefined)
    setDetectedFields(null)
    setRootKey(null)

    // Parse and validate the current JSON (same validation as handleParseSnippet)
    const { value, error } = safeParseJson(snippetText)
    if (error || !value) {
      setParseError(error ?? 'Invalid JSON')
      return
    }

    // Format the JSON (same as handleParseSnippet)
    const pretty = prettyPrintJson(value)
    if (pretty && pretty !== snippetText) {
      setSnippetText(pretty)
    }

    setSnippetValue(value)

    // Automatically detect fields from the new JSON (same as handleParseSnippet)
    const { rootKey: detectedRootKey, fields } = detectSnippetConfigFromJson(value)
    setDetectedFields(fields)
    setRootKey(detectedRootKey)
    
    // Keep the target snippet's metadata (name, description, fileType, accordionGroup)
    setName(targetSnippet.name)
    setDescription(targetSnippet.description ?? '')
    setFileType(targetSnippet.fileType)
    setAccordionGroup(targetSnippet.accordionGroup)
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
        description: description || undefined,
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
      // Check if a snippet with the same rootKey and fileType already exists
      const existingSnippetWithRootKey = snippets.find(
        (s) => s.rootKey === rootKey && s.fileType === fileType && s.id !== editingId,
      )
      if (existingSnippetWithRootKey) {
        // Ask user if they want to replace or drop
        setDuplicateRootKeyModal({ open: true, existingSnippet: existingSnippetWithRootKey })
        return
      }

      const snippet: SnippetDefinition = {
        id: createId(),
        name: name || prettifyKey(rootKey),
        description: description || undefined,
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

    // Don't reset form - keep the snippet open for editing
  }

  const handleReplaceDuplicate = () => {
    if (!detectedFields || !rootKey || !duplicateRootKeyModal.existingSnippet) return
    const { value } = safeParseJson(snippetText)
    if (!value) return

    const now = new Date().toISOString()
    const updated: SnippetDefinition = {
      ...duplicateRootKeyModal.existingSnippet,
      name: name || prettifyKey(rootKey),
      description: description || undefined,
      fileType,
      accordionGroup,
      snippetText,
      parsedSnippet: value,
      rootKey,
      fields: detectedFields,
      updatedAt: now,
    }
    updateSnippet(updated)
    setDuplicateRootKeyModal({ open: false, existingSnippet: null })
    // Set editing mode to the replaced snippet
    setEditingId(updated.id)
  }

  const handleDropDuplicate = () => {
    setDuplicateRootKeyModal({ open: false, existingSnippet: null })
  }

  const canSave = Boolean(detectedFields && rootKey && snippetText.trim())
  const isEditing = Boolean(editingId)

  return (
    <Box
      style={{
        height: 'calc(100vh - 52px)',
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
        }}
      >
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: '360px 480px minmax(0, 1fr)',
            gap: 0,
            minHeight: 0,
          }}
        >
        {/* Column 1: Snippets */}
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
              maxHeight: COLUMN_HEADER_MIN_HEIGHT,
              overflow: 'hidden',
            }}
          >
            <Text fw={500}>Snippets</Text>
            <Group gap={6} wrap="nowrap">
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
              <Menu withinPortal position="bottom-end" shadow="md">
                <Menu.Target>
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    aria-label="Snippet actions"
                  >
                    <IconDotsVertical size={14} />
                  </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={handleExportSnippets}>Export snippets…</Menu.Item>
                  <Menu.Item
                    onClick={() => {
                      importInputRef.current?.click()
                    }}
                  >
                    Import snippets…
                  </Menu.Item>
                  <Menu.Item color="red" onClick={handleClearAllSnippets}>
                    Remove all snippets
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item onClick={() => setDeleteEnabled((v) => !v)}>
                    {deleteEnabled ? 'Disable delete' : 'Enable delete'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <SnippetSidebar
              snippets={snippetsForSidebar}
              onSelect={handleEditSnippetFields}
              onReorder={(orderedIds) =>
                reorderSnippetsForFileType(sidebarFileType, orderedIds)
              }
              onMove={(snippetId, newFileType, newGroup) => {
                updateSnippetMetadata({
                  id: snippetId,
                  fileType: newFileType,
                  accordionGroup: newGroup,
                })
              }}
              onDelete={deleteSnippet}
              showDelete={deleteEnabled}
            />
          </Box>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={handleImportSnippetsFromFile}
          />
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
            wrap="nowrap"
            p="xs"
            style={{
              flexShrink: 0,
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              minHeight: COLUMN_HEADER_MIN_HEIGHT,
              maxHeight: COLUMN_HEADER_MIN_HEIGHT,
              overflow: 'hidden',
            }}
          >
            <Text fw={500}>Snippet Config</Text>
            <Group gap="xs" wrap="nowrap">
              {isEditing && (
                <Button size="xs" variant="default" onClick={handleClearSnippetEditor}>
                  Exit
                </Button>
              )}
              {canSave && (
                <Button
                  size="xs"
                  variant="filled"
                  onClick={handleSaveSnippet}
                  style={{ flexShrink: 0 }}
                >
                  {isEditing ? 'Update' : 'Save Snippet'}
                </Button>
              )}
              {isEditing && (
                <Menu withinPortal position="bottom-end" shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      aria-label="Snippet actions"
                    >
                      <IconDotsVertical size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={handleDeleteEditingSnippet}
                    >
                      Delete snippet
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Group>
          {detectedFields && (
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
              <TextInput
                label="Description"
                size="xs"
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
                placeholder="Optional explanation shown in editor tooltip"
              />
            </Stack>
          )}
          <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto' }} px="xs">
            {detectedFields && (
              <FieldConfigTree
                fields={detectedFields}
                onToggleEditable={handleToggleEditable}
                onChangeDefault={handleChangeDefault}
                onChangeNumberBounds={handleChangeNumberBounds}
                onChangeFieldType={handleChangeFieldType}
              />
            )}
          </Box>
        </Card>

        {/* Column 3: Snippet Config */}
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
              maxHeight: COLUMN_HEADER_MIN_HEIGHT,
              overflow: 'hidden',
            }}
          >
            <Text fw={500}>Snippet JSON</Text>
            <Group gap="xs" wrap="nowrap">
              {snippetText.trim().length > 0 && (
                <CopyButton value={snippetText}>
                  {({ copied, copy }) => (
                    <Button size="xs" variant="light" onClick={copy}>
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              )}
              {snippetText.trim().length === 0 && (
                <Button size="xs" variant="default" onClick={handlePasteSnippetFromClipboard}>
                  Paste
                </Button>
              )}
              {!isEditing && snippetText.trim().length > 0 && (
                <Button size="xs" variant="light" onClick={handleParseSnippet}>
                  <IconArrowLeft size={14} style={{ marginRight: 4 }} />
                  Make Snippet
                </Button>
              )}
              {!isEditing && hasValidJson && snippets.length > 0 && (
                <Menu withinPortal position="bottom-end" shadow="md">
                  <Menu.Target>
                    <ActionIcon
                      size="sm"
                      variant="subtle"
                      aria-label="Leave snippet"
                    >
                      <IconDotsVertical size={14} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {(() => {
                      // Group snippets by file type, then by accordion group
                      const fileTypeGroups = new Map<string, Map<string, SnippetDefinition[]>>()
                      for (const snippet of snippets) {
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
                      
                      const items: JSX.Element[] = []
                      for (const [fileType, groups] of fileTypeGroups.entries()) {
                        items.push(<Menu.Label key={fileType}>{fileType}</Menu.Label>)
                        for (const [groupName, groupSnippets] of groups.entries()) {
                          items.push(<Menu.Label key={`${fileType}-${groupName}`}>{groupName}</Menu.Label>)
                          for (const snippet of groupSnippets) {
                            items.push(
                              <Menu.Item
                                key={snippet.id}
                                onClick={() => handleReplaceWithSnippet(snippet)}
                              >
                                Leave snippet: {snippet.name}
                              </Menu.Item>
                            )
                          }
                        }
                      }
                      return items
                    })()}
                  </Menu.Dropdown>
                </Menu>
              )}
            </Group>
          </Group>
          <Box style={{ flex: 1, minHeight: 0 }}>
            <JsonCodeEditor
              value={snippetText}
              onChange={isEditing ? undefined : setSnippetText}
              readOnly={isEditing}
              showColorSwatches={isEditing}
              height="100%"
            />
          </Box>
          {parseError && (
            <Alert color="red" icon={<IconInfoCircle size={16} />} style={{ flexShrink: 0, borderRadius: 0 }}>
              {parseError}
            </Alert>
          )}
        </Card>


        </Box>
      </Box>
      <Modal
        opened={duplicateRootKeyModal.open}
        onClose={handleDropDuplicate}
        title="Duplicate Root Key"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            A snippet with the root key <strong>"{duplicateRootKeyModal.existingSnippet?.rootKey}"</strong> already exists.
          </Text>
          <Text size="sm" c="dimmed">
            Existing snippet: <strong>{duplicateRootKeyModal.existingSnippet?.name}</strong> ({duplicateRootKeyModal.existingSnippet?.fileType} / {duplicateRootKeyModal.existingSnippet?.accordionGroup})
          </Text>
          <Text size="sm">
            Would you like to replace the existing snippet or drop this save?
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="subtle" onClick={handleDropDuplicate}>
              Drop
            </Button>
            <Button onClick={handleReplaceDuplicate}>
              Replace
            </Button>
          </Group>
        </Stack>
      </Modal>
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

function updateFieldTypeInTree(
  fields: FieldConfig[],
  fieldId: string,
  newType: 'string' | 'number' | 'color-solid' | 'color-alpha',
): FieldConfig[] {
  return fields.map((field) => {
    if (field.id === fieldId && 'defaultValue' in field) {
      const currentValue = field.defaultValue
      let newField: FieldConfig

      if (newType === 'string') {
        newField = {
          ...field,
          kind: 'string',
          defaultValue: typeof currentValue === 'string' ? currentValue : String(currentValue ?? ''),
        } as FieldConfig
      } else if (newType === 'number') {
        const numValue = typeof currentValue === 'number' 
          ? currentValue 
          : (typeof currentValue === 'string' 
            ? parseFloat(currentValue.replace(/\s/g, '')) || 0 
            : 0)
        newField = {
          ...field,
          kind: 'number',
          defaultValue: numValue,
          min: undefined,
          max: undefined,
        } as FieldConfig
      } else if (newType === 'color-solid') {
        let colorValue = '#000000'
        if (typeof currentValue === 'string' && (isHexColor(currentValue) || isRgbaColor(currentValue))) {
          // Remove alpha channel if present (convert 8-char hex to 6-char, or 4-char to 3-char)
          if (currentValue.length === 9) {
            colorValue = currentValue.substring(0, 7) // #RRGGBBAA -> #RRGGBB
          } else if (currentValue.length === 5) {
            colorValue = currentValue.substring(0, 4) // #RGBA -> #RGB
          } else {
            colorValue = currentValue
          }
        }
        newField = {
          ...field,
          kind: 'color',
          defaultValue: colorValue,
          supportsAlpha: false,
        } as FieldConfig
      } else { // color-alpha
        let colorValue = '#000000FF'
        if (typeof currentValue === 'string' && (isHexColor(currentValue) || isRgbaColor(currentValue))) {
          // Ensure it has alpha channel (convert 6-char hex to 8-char, or 3-char to 4-char)
          if (currentValue.length === 7) {
            colorValue = currentValue + 'FF' // #RRGGBB -> #RRGGBBFF
          } else if (currentValue.length === 4) {
            colorValue = currentValue + 'F' // #RGB -> #RGBF
          } else if (hasAlphaChannel(currentValue)) {
            colorValue = currentValue
          } else {
            colorValue = currentValue + 'FF'
          }
        }
        newField = {
          ...field,
          kind: 'color',
          defaultValue: colorValue,
          supportsAlpha: true,
        } as FieldConfig
      }
      return newField
    }
    if ('children' in field && field.children) {
      return {
        ...field,
        children: updateFieldTypeInTree(field.children, fieldId, newType),
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
