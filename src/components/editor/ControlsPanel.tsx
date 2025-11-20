import React, { useState } from 'react'
import { convertColorToHex, hasAlphaChannel } from '../../utils/jsonUtils'
import {
  Accordion,
  Box,
  ColorInput,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Divider,
  Group,
  SimpleGrid,
  Tooltip,
  ActionIcon,
  Input,
} from '@mantine/core'
import type {
  ArrayFieldConfig,
  FieldConfig,
  LeafFieldConfig,
  SnippetDefinition,
} from '../../types/snippets'
import { IconArrowBadgeDown, IconArrowBadgeUp } from '@tabler/icons-react'

export interface ControlChangePayload {
  path: (string | number)[]
  value: unknown
}

interface ControlsPanelProps {
  snippets: SnippetDefinition[]
  currentJson: JsonValue | undefined
  onChange: (change: ControlChangePayload) => void
  openedSnippets: string[]
  setOpenedSnippets: (ids: string[]) => void
}

export function ControlsPanel({
  snippets,
  currentJson,
  onChange,
  openedSnippets,
  setOpenedSnippets,
}: ControlsPanelProps) {
  // Group snippets by file type, then by accordion group
  const fileTypeGroups = new Map<string, Map<string, SnippetDefinition[]>>()
  for (const snippet of snippets) {
    const fileType = snippet.fileType
    const group = snippet.accordionGroup || 'General'
    
    if (!fileTypeGroups.has(fileType)) {
      fileTypeGroups.set(fileType, new Map())
    }
    const groups = fileTypeGroups.get(fileType)!
    const list = groups.get(group) ?? []
    list.push(snippet)
    groups.set(group, list)
  }

  if (snippets.length === 0) {
    return (
      <Box
        style={{
          padding: '6px 10px',
        }}
      >
        <Text c="dimmed" size="xs">
          No controls for this JSON. Paste JSON and ensure it matches a file type and root keys of
          your snippets.
        </Text>
      </Box>
    )
  }

  return (
    <Stack gap="xs" p="xs">
      {Array.from(fileTypeGroups.entries()).map(([fileType, groups]) => (
        <Stack key={fileType} gap="xs">
          <Text size="xs" fw={700} c="blue" tt="uppercase">
            {fileType}
          </Text>
          {Array.from(groups.entries()).map(([groupName, groupSnippets]) => (
            <Stack key={groupName} gap={4}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {groupName}
              </Text>
              <Accordion
                multiple
                radius="sm"
                variant="contained"
                chevronPosition="right"
                value={openedSnippets}
                onChange={setOpenedSnippets}
              >
                {groupSnippets.map((snippet) => (
                  <Accordion.Item key={snippet.id} value={snippet.id}>
                    <Accordion.Control>
                      <Stack gap={4}>
                        <SnippetTitle name={snippet.name} />
                        {snippet.description && (
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {snippet.description}
                          </Text>
                        )}
                      </Stack>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <FieldControlsRoot
                        snippet={snippet}
                        currentJson={currentJson}
                        onChange={(relativePath, value) =>
                          onChange({ path: [snippet.rootKey, ...relativePath], value })
                        }
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
              </Accordion>
            </Stack>
          ))}
          <Divider variant="dashed" opacity={0.15} />
        </Stack>
      ))}
    </Stack>
  )
}

function prettifyLabel(label: string): string {
  if (!label) return ''
  let result = label.replace(/[_-]+/g, ' ')
  result = result.replace(/([a-z])([A-Z])/g, '$1 $2')
  const cleaned = result.toLowerCase().trim()
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

interface SnippetTitleProps {
  name: string
}

function SnippetTitle({ name }: SnippetTitleProps) {
  const display = prettifyLabel(name)
  const needsTooltip = display.length > 24
  const content = (
    <Text size="sm" fw={500} lineClamp={1}>
      {display}
    </Text>
  )
  return needsTooltip ? (
    <Tooltip
      label={display}
      openDelay={0}
      closeDelay={0}
      withArrow={false}
      transitionProps={{ duration: 0 }}
      styles={{ tooltip: { fontSize: 11, padding: '4px 8px' } }}
    >
      {content}
    </Tooltip>
  ) : (
    content
  )
}

interface FieldControlsRootProps {
  snippet: SnippetDefinition
  currentJson: JsonValue | undefined
  onChange: (relativePath: (string | number)[], value: unknown) => void
}

function FieldControlsRoot({ snippet, currentJson, onChange }: FieldControlsRootProps) {
  // Get the current value for this snippet from currentJson
  const snippetData = currentJson && typeof currentJson === 'object' && !Array.isArray(currentJson)
    ? (currentJson as Record<string, unknown>)[snippet.rootKey]
    : undefined

  return (
    <Stack gap="xs">
      {snippet.fields.map((field) => (
        <FieldControlsNode
          key={field.id}
          field={field}
          basePath={[]}
          currentValue={snippetData}
          onChange={onChange}
        />
      ))}
    </Stack>
  )
}

// Helper to get value at path from current JSON
function getValueAtPath(obj: unknown, path: (string | number)[]): unknown {
  let current = obj
  for (const key of path) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as any)[key]
  }
  return current
}

interface FieldControlsNodeProps {
  field: FieldConfig
  basePath: (string | number)[]
  currentValue: unknown
  onChange: (relativePath: (string | number)[], value: unknown) => void
}

function FieldControlsNode({ field, basePath, currentValue, onChange }: FieldControlsNodeProps) {
  const fullPath = [...basePath, ...field.path]
  const actualValue = getValueAtPath(currentValue, field.path)

  if (field.kind === 'boolean') {
    if (!field.editable) return null
    const label = prettifyLabel(field.label)
    const currentChecked = typeof actualValue === 'boolean' ? actualValue : field.defaultValue
    const [checked, setChecked] = React.useState(currentChecked)
    
    React.useEffect(() => {
      if (typeof actualValue === 'boolean') {
        setChecked(actualValue)
      }
    }, [actualValue])
    
    return (
      <Input.Wrapper
        size="xs"
        label={
          <Tooltip
            label={label}
            disabled={label.length <= 24}
            openDelay={0}
            closeDelay={0}
            withArrow={false}
            transitionProps={{ duration: 0 }}
            styles={{ tooltip: { fontSize: 11, padding: '4px 8px' } }}
          >
            <Text
              size="xs"
              fw={500}
              style={{ minWidth: 0 }}
              lineClamp={1}
            >
              {label}
            </Text>
          </Tooltip>
        }
      >
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--mantine-spacing-xs)',
            height: 30,
          }}
        >
          <Switch
            size="xs"
            checked={checked}
            onChange={(e) => {
              const newValue = e.currentTarget.checked
              setChecked(newValue)
              onChange(fullPath, newValue)
            }}
          />
          <Text size="xs">{checked ? 'True' : 'False'}</Text>
        </Box>
      </Input.Wrapper>
    )
  }

  if (field.kind === 'number') {
    if (!field.editable) return null
    const currentNumber = typeof actualValue === 'number' ? actualValue : field.defaultValue
    const hasDecimal = currentNumber % 1 !== 0
    const step = hasDecimal ? 0.1 : 1
    return (
      <NumberInput
        key={fullPath.join('.')}
        size="xs"
        label={prettifyLabel(field.label)}
        value={currentNumber}
        min={field.min}
        max={field.max}
        step={step}
        onChange={(value) => {
          if (value === '') return
          onChange(fullPath, Number(value))
        }}
      />
    )
  }

  if (field.kind === 'string') {
    if (!field.editable) return null
    const currentString = typeof actualValue === 'string' ? actualValue : field.defaultValue
    return (
      <TextInput
        key={fullPath.join('.')}
        size="xs"
        label={prettifyLabel(field.label)}
        value={currentString}
        onChange={(e) => onChange(fullPath, e.currentTarget.value)}
      />
    )
  }

  if (field.kind === 'color') {
    if (!field.editable) return null
    const currentColor = typeof actualValue === 'string' ? actualValue : field.defaultValue
    const hasAlpha = hasAlphaChannel(currentColor)
    return (
      <ColorInput
        key={fullPath.join('.')}
        size="xs"
        label={prettifyLabel(field.label)}
        value={currentColor || ''}
        format={hasAlpha ? 'rgba' : 'hex'}
        withPicker
        onChange={(value) => {
          // Convert to hex format to keep colors in hex
          const hexValue = convertColorToHex(value)
          onChange(fullPath, hexValue)
        }}
      />
    )
  }

  if ('children' in field && field.children) {
    // Special handling for arrays: each array item gets its own collapsible card
    if (field.kind === 'array') {
      return (
        <ArrayFieldControls
          field={field as ArrayFieldConfig}
          basePath={basePath}
          currentValue={actualValue}
          onChange={onChange}
        />
      )
    }

    // Objects / nested groups: render scalar children in a compact two-column grid,
    // and array children as full-width cards below the grid.
    if (field.kind === 'object') {
      const arrayChildren = field.children.filter(
        (child) => (child as FieldConfig).kind === 'array',
      )
      const otherChildren = field.children.filter(
        (child) => (child as FieldConfig).kind !== 'array',
      )
      const gridChildren = otherChildren.filter(
        (child) => (child as FieldConfig).kind !== 'boolean',
      )
      const booleanChildren = otherChildren.filter(
        (child) => (child as FieldConfig).kind === 'boolean',
      )

      return (
        <Stack gap={4}>
          <Text size="xs" fw={500} c="dimmed" tt="uppercase">
            {field.label}
          </Text>
          {gridChildren.length > 0 && (
            <SimpleGrid cols={2} spacing="xs">
              {gridChildren.map((child) => (
                <FieldControlsNode
                  key={child.id}
                  field={child as FieldConfig | LeafFieldConfig}
                  basePath={basePath}
                  currentValue={actualValue}
                  onChange={onChange}
                />
              ))}
            </SimpleGrid>
          )}
          {booleanChildren.map((child) => (
            <FieldControlsNode
              key={child.id}
              field={child as FieldConfig | LeafFieldConfig}
              basePath={basePath}
              currentValue={actualValue}
              onChange={onChange}
            />
          ))}
          {arrayChildren.map((child) => (
            <FieldControlsNode
              key={child.id}
              field={child as FieldConfig}
              basePath={basePath}
              currentValue={actualValue}
              onChange={onChange}
            />
          ))}
        </Stack>
      )
    }
  }

  return null
}

interface ArrayFieldControlsProps {
  field: ArrayFieldConfig
  basePath: (string | number)[]
  currentValue: unknown
  onChange: (relativePath: (string | number)[], value: unknown) => void
}

function ArrayFieldControls({ field, basePath, currentValue, onChange }: ArrayFieldControlsProps) {
  const arrayValue = getValueAtPath(currentValue, field.path)
  const itemIds = field.children.map((child) => child.id)
  const [opened, setOpened] = useState<string[]>([])

  // Check if this is a simple array of primitives (strings, numbers, booleans)
  const isSimplePrimitiveArray = field.children.every((child) => {
    const leafChild = child as LeafFieldConfig
    return (
      leafChild.kind === 'string' ||
      leafChild.kind === 'number' ||
      leafChild.kind === 'boolean'
    )
  })

  // For simple string/number/boolean arrays, show as a compact list
  if (isSimplePrimitiveArray) {
    return (
      <Stack gap={4}>
        <Text size="xs" fw={500} c="dimmed" tt="uppercase">
          {prettifyLabel(field.label)}
        </Text>
        <Stack gap="xs">
          {field.children.map((child, index) => {
            const leafChild = child as LeafFieldConfig
            const arrayItemValue = Array.isArray(arrayValue) ? arrayValue[index] : undefined
            const actualItemValue = arrayItemValue !== undefined ? arrayItemValue : (leafChild as any).defaultValue
            return (
              <Group key={child.id} gap="xs" align="center">
                <Text size="xs" c="dimmed" style={{ minWidth: 20 }}>
                  {index + 1}.
                </Text>
                {leafChild.kind === 'string' ? (
                  <TextInput
                    key={`${field.path.join('.')}-${index}-${actualItemValue}`}
                    size="xs"
                    value={typeof actualItemValue === 'string' ? actualItemValue : ''}
                    onChange={(e) =>
                      onChange([...field.path, index], e.currentTarget.value)
                    }
                    style={{ flex: 1 }}
                  />
                ) : leafChild.kind === 'number' ? (
                  <NumberInput
                    key={`${field.path.join('.')}-${index}-${actualItemValue}`}
                    size="xs"
                    value={typeof actualItemValue === 'number' ? actualItemValue : 0}
                    step={typeof actualItemValue === 'number' && actualItemValue % 1 !== 0 ? 0.1 : 1}
                    onChange={(value) => {
                      if (value === '') return
                      onChange([...field.path, index], Number(value))
                    }}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Input.Wrapper size="xs" style={{ flex: 1 }}>
                    <Box
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--mantine-spacing-xs)',
                        height: 30,
                      }}
                    >
                      <Switch
                        key={`${field.path.join('.')}-${index}-${actualItemValue}`}
                        size="xs"
                        checked={typeof actualItemValue === 'boolean' ? actualItemValue : false}
                        onChange={(e) =>
                          onChange([...field.path, index], e.currentTarget.checked)
                        }
                      />
                      <Text size="xs">
                        {(typeof actualItemValue === 'boolean' ? actualItemValue : false) ? 'True' : 'False'}
                      </Text>
                    </Box>
                  </Input.Wrapper>
                )}
              </Group>
            )
          })}
        </Stack>
      </Stack>
    )
  }

  const getItemLabel = (index: number, child: FieldConfig): string => {
    let idValue: unknown
    if ('children' in child && child.children) {
      const idLike = child.children.find((c) =>
        /id$/i.test(c.label) || ['id', 'name', 'label', 'key'].includes(c.label),
      ) as LeafFieldConfig | undefined
      if (idLike && 'defaultValue' in idLike) {
        idValue = idLike.defaultValue
      }
    }
    if (typeof idValue === 'string' || typeof idValue === 'number') {
      return prettifyLabel(String(idValue))
    }
    return prettifyLabel(`${field.label} #${index + 1}`)
  }

  return (
    <Stack gap={4}>
      <Group justify="space-between" align="center">
        <Text size="xs" fw={500} c="dimmed">
          {prettifyLabel(field.label)}
        </Text>
        {itemIds.length > 0 && (
          <Tooltip
            label={opened.length === itemIds.length ? 'Collapse all' : 'Expand all'}
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
                setOpened(opened.length === itemIds.length ? [] : itemIds)
              }
            >
              {opened.length === itemIds.length ? (
                <IconArrowBadgeUp size={14} />
              ) : (
                <IconArrowBadgeDown size={14} />
              )}
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
      <Accordion
        multiple
        radius="xs"
        variant="contained"
        chevronPosition="right"
        value={opened}
        onChange={(value) => setOpened(value as string[])}
      >
        {field.children.map((child, index) => {
          const itemLabel = getItemLabel(index, child as FieldConfig)
          return (
            <Accordion.Item key={child.id} value={child.id}>
              <Accordion.Control>
                <Tooltip
                  label={itemLabel}
                  disabled={itemLabel.length <= 24}
                  openDelay={0}
                  closeDelay={0}
                  withArrow={false}
                  transitionProps={{ duration: 0 }}
                  styles={{ tooltip: { fontSize: 11, padding: '4px 8px' } }}
                >
                  <Text size="xs" fw={500} lineClamp={1}>
                    {itemLabel}
                  </Text>
                </Tooltip>
              </Accordion.Control>
              <Accordion.Panel>
                {(() => {
                  const arrayItemValue = Array.isArray(arrayValue) ? arrayValue[index] : undefined
                  return 'children' in child && child.children ? (
                    <SimpleGrid cols={2} spacing="xs">
                      {child.children.map((grandChild) => (
                        <FieldControlsNode
                          key={grandChild.id}
                          field={grandChild as FieldConfig | LeafFieldConfig}
                          basePath={basePath}
                          currentValue={arrayItemValue}
                          onChange={onChange}
                        />
                      ))}
                    </SimpleGrid>
                  ) : (
                    <FieldControlsNode
                      field={child as FieldConfig | LeafFieldConfig}
                      basePath={basePath}
                      currentValue={arrayItemValue}
                      onChange={onChange}
                    />
                  )
                })()}
              </Accordion.Panel>
            </Accordion.Item>
          )
        })}
      </Accordion>
    </Stack>
  )
}


