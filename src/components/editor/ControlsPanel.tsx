import { useState } from 'react'
import {
  Accordion,
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
} from '@mantine/core'
import type {
  ArrayFieldConfig,
  FieldConfig,
  LeafFieldConfig,
  SnippetDefinition,
} from '../../types/snippets'
import { IconArrowBarDown, IconArrowBarToUp } from '@tabler/icons-react'

export interface ControlChangePayload {
  path: (string | number)[]
  value: unknown
}

interface ControlsPanelProps {
  snippets: SnippetDefinition[]
  onChange: (change: ControlChangePayload) => void
}

export function ControlsPanel({ snippets, onChange }: ControlsPanelProps) {
  // Group snippets by accordionGroup
  const groups = new Map<string, SnippetDefinition[]>()
  for (const snippet of snippets) {
    const group = snippet.accordionGroup || 'General'
    const list = groups.get(group) ?? []
    list.push(snippet)
    groups.set(group, list)
  }

  if (snippets.length === 0) {
    return <Text c="dimmed">No controls for this JSON. Paste JSON and ensure it matches a file type and root keys of your snippets.</Text>
  }

  return (
    <Stack gap="xs">
      {Array.from(groups.entries()).map(([groupName, groupSnippets]) => (
        <Stack key={groupName} gap={4}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {prettifyLabel(groupName)}
          </Text>
          <Accordion
            multiple
            radius="sm"
            variant="contained"
            chevronPosition="right"
            defaultValue={groupSnippets.map((s) => s.id)}
          >
            {groupSnippets.map((snippet) => (
              <Accordion.Item key={snippet.id} value={snippet.id}>
                <Accordion.Control>
                  <SnippetTitle name={snippet.name} />
                </Accordion.Control>
                <Accordion.Panel>
                  <FieldControlsRoot
                    snippet={snippet}
                    onChange={(relativePath, value) =>
                      onChange({ path: [snippet.rootKey, ...relativePath], value })
                    }
                  />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
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
  return result
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
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
  return needsTooltip ? <Tooltip label={display}>{content}</Tooltip> : content
}

interface FieldControlsRootProps {
  snippet: SnippetDefinition
  onChange: (relativePath: (string | number)[], value: unknown) => void
}

function FieldControlsRoot({ snippet, onChange }: FieldControlsRootProps) {
  return (
    <Stack gap="xs">
      {snippet.fields.map((field) => (
        <FieldControlsNode
          key={field.id}
          field={field}
          basePath={[]}
          onChange={onChange}
        />
      ))}
    </Stack>
  )
}

interface FieldControlsNodeProps {
  field: FieldConfig
  basePath: (string | number)[]
  onChange: (relativePath: (string | number)[], value: unknown) => void
}

function FieldControlsNode({ field, basePath, onChange }: FieldControlsNodeProps) {
  const fullPath = [...basePath, ...field.path]

  if (field.kind === 'boolean') {
    if (!field.editable) return null
    const label = prettifyLabel(field.label)
    return (
      <Group justify="space-between" align="center" gap="xs" style={{ width: '100%' }}>
        <Tooltip label={label} disabled={label.length <= 24}>
          <Text
            size="xs"
            style={{ flex: 1, minWidth: 0 }}
            lineClamp={1}
          >
            {label}
          </Text>
        </Tooltip>
        <Switch
          size="xs"
          defaultChecked={field.defaultValue}
          onChange={(e) => onChange(fullPath, e.currentTarget.checked)}
        />
      </Group>
    )
  }

  if (field.kind === 'number') {
    if (!field.editable) return null
    return (
      <NumberInput
        size="xs"
        label={prettifyLabel(field.label)}
        defaultValue={field.defaultValue}
        min={field.min}
        max={field.max}
        onChange={(value) => {
          if (value === '') return
          onChange(fullPath, Number(value))
        }}
      />
    )
  }

  if (field.kind === 'string') {
    if (!field.editable) return null
    return (
      <TextInput
        size="xs"
        label={prettifyLabel(field.label)}
        defaultValue={field.defaultValue}
        onChange={(e) => onChange(fullPath, e.currentTarget.value)}
      />
    )
  }

  if (field.kind === 'color') {
    if (!field.editable) return null
    return (
      <ColorInput
        size="xs"
        label={prettifyLabel(field.label)}
        format={field.supportsAlpha ? 'rgba' : 'hex'}
        defaultValue={field.defaultValue}
        withPicker
        onChange={(value) => onChange(fullPath, value)}
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
          <Text size="xs" fw={500} c="dimmed">
            {prettifyLabel(field.label)}
          </Text>
          {gridChildren.length > 0 && (
            <SimpleGrid cols={2} spacing={4}>
              {gridChildren.map((child) => (
                <FieldControlsNode
                  key={child.id}
                  field={child as FieldConfig | LeafFieldConfig}
                  basePath={basePath}
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
              onChange={onChange}
            />
          ))}
          {arrayChildren.map((child) => (
            <FieldControlsNode
              key={child.id}
              field={child as FieldConfig}
              basePath={basePath}
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
  onChange: (relativePath: (string | number)[], value: unknown) => void
}

function ArrayFieldControls({ field, basePath, onChange }: ArrayFieldControlsProps) {
  const itemIds = field.children.map((child) => child.id)
  const [opened, setOpened] = useState<string[]>([])

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
            openDelay={200}
          >
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() =>
                setOpened(opened.length === itemIds.length ? [] : itemIds)
              }
            >
              {opened.length === itemIds.length ? (
                <IconArrowBarToUp size={14} />
              ) : (
                <IconArrowBarDown size={14} />
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
                <Tooltip label={itemLabel} disabled={itemLabel.length <= 24}>
                  <Text size="xs" fw={500} lineClamp={1}>
                    {itemLabel}
                  </Text>
                </Tooltip>
              </Accordion.Control>
              <Accordion.Panel>
                {'children' in child && child.children ? (
                  <SimpleGrid cols={2} spacing={4}>
                    {child.children.map((grandChild) => (
                      <FieldControlsNode
                        key={grandChild.id}
                        field={grandChild as FieldConfig | LeafFieldConfig}
                        basePath={basePath}
                        onChange={onChange}
                      />
                    ))}
                  </SimpleGrid>
                ) : (
                  <FieldControlsNode
                    field={child as FieldConfig | LeafFieldConfig}
                    basePath={basePath}
                    onChange={onChange}
                  />
                )}
              </Accordion.Panel>
            </Accordion.Item>
          )
        })}
      </Accordion>
    </Stack>
  )
}


