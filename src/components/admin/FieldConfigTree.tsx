import { useState } from 'react'
import { Checkbox, Group, Stack, Text, Switch, NumberInput, TextInput, Tooltip, ColorInput, Card, Accordion, ActionIcon, Menu, Select } from '@mantine/core'
import { IconArrowBadgeDown, IconArrowBadgeUp, IconDotsVertical } from '@tabler/icons-react'
import { convertColorToHex, hasAlphaChannel } from '../../utils/jsonUtils'
import type { FieldConfig, LeafFieldConfig, ArrayFieldConfig } from '../../types/snippets'

interface FieldConfigTreeProps {
  fields: FieldConfig[]
  onToggleEditable: (fieldId: string, editable: boolean) => void
  onChangeDefault: (fieldId: string, value: unknown) => void
  onChangeNumberBounds: (fieldId: string, bounds: { min?: number; max?: number }) => void
  onChangeFieldType: (fieldId: string, newType: 'string' | 'number' | 'color-solid' | 'color-alpha') => void
}

export function FieldConfigTree({
  fields,
  onToggleEditable,
  onChangeDefault,
  onChangeNumberBounds,
  onChangeFieldType,
}: FieldConfigTreeProps) {
  return (
    <Stack gap="xs">
      {fields.map((field) => (
        <FieldNode
          key={field.id}
          field={field}
          depth={0}
          onToggleEditable={onToggleEditable}
          onChangeDefault={onChangeDefault}
          onChangeNumberBounds={onChangeNumberBounds}
          onChangeFieldType={onChangeFieldType}
        />
      ))}
    </Stack>
  )
}

interface FieldNodeProps {
  field: FieldConfig
  depth: number
  onToggleEditable: (fieldId: string, editable: boolean) => void
  onChangeDefault: (fieldId: string, value: unknown) => void
  onChangeNumberBounds: (fieldId: string, bounds: { min?: number; max?: number }) => void
  onChangeFieldType: (fieldId: string, newType: 'string' | 'number' | 'color-solid' | 'color-alpha') => void
}

function prettifyLabel(label: string): string {
  if (!label) return ''
  // Replace underscores/dashes with spaces
  let result = label.replace(/[_-]+/g, ' ')
  // Insert spaces before camelCase capitals: compositPreMultiply -> composit Pre Multiply
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

function FieldNode({
  field,
  depth,
  onToggleEditable,
  onChangeDefault,
  onChangeNumberBounds,
  onChangeFieldType,
}: FieldNodeProps) {
  const isLeaf =
    field.kind === 'boolean' ||
    field.kind === 'number' ||
    field.kind === 'string' ||
    field.kind === 'color'

  const prettifiedLabel = prettifyLabel(field.label)

  // Root level objects/arrays - render as cards
  if (depth === 0 && !isLeaf && 'children' in field && field.children) {
    return (
      <Card withBorder radius="sm" p="xs" mb="xs">
        <Stack gap="xs">
          <Group gap={6}>
            <Text size="sm" fw={500} tt="uppercase">
              {prettifiedLabel}
            </Text>
          </Group>
          {field.children.map((child) => (
            <FieldNode
              key={child.id}
              field={child as FieldConfig | LeafFieldConfig}
              depth={depth + 1}
              onToggleEditable={onToggleEditable}
              onChangeDefault={onChangeDefault}
              onChangeNumberBounds={onChangeNumberBounds}
              onChangeFieldType={onChangeFieldType}
            />
          ))}
        </Stack>
      </Card>
    )
  }

  // Array items - render nested children as cards with collapse/expand
  if (field.kind === 'array' && 'children' in field && field.children) {
    const arrayField = field as ArrayFieldConfig
    const itemIds = field.children.map((child) => child.id)
    const [opened, setOpened] = useState<string[]>(itemIds)
    
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
      return `${prettifiedLabel} #${index + 1}`
    }

    return (
      <Stack gap={4}>
        <Group justify="space-between" align="center">
          <Text size="xs" fw={500} c="dimmed">
            {prettifiedLabel}
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
            const itemLabel = getItemLabel(index, child)
            return (
              <Accordion.Item key={child.id} value={child.id}>
                <Accordion.Control>
                  <Text size="xs" fw={500}>
                    {itemLabel}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Card withBorder radius="sm" p="xs" mt="xs">
                    <Stack gap="xs">
                      {'children' in child && child.children ? (
                        <Stack gap="xs">
                          {child.children.map((grandChild) => (
                            <FieldNode
                              key={grandChild.id}
                              field={grandChild as FieldConfig | LeafFieldConfig}
                              depth={depth + 2}
                              onToggleEditable={onToggleEditable}
                              onChangeDefault={onChangeDefault}
                              onChangeNumberBounds={onChangeNumberBounds}
                              onChangeFieldType={onChangeFieldType}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <FieldNode
                          field={child as FieldConfig | LeafFieldConfig}
                          depth={depth + 1}
                          onToggleEditable={onToggleEditable}
                          onChangeDefault={onChangeDefault}
                          onChangeNumberBounds={onChangeNumberBounds}
                          onChangeFieldType={onChangeFieldType}
                        />
                      )}
                    </Stack>
                  </Card>
                </Accordion.Panel>
              </Accordion.Item>
            )
          })}
        </Accordion>
      </Stack>
    )
  }

  // Object children (nested) - render fields stacked
  if (field.kind === 'object' && 'children' in field && field.children) {
    return (
      <Stack gap="xs">
        <Group gap={6}>
          <Text size="xs" fw={500} c="dimmed">
            {prettifiedLabel}
          </Text>
        </Group>
        <Stack gap="xs">
          {field.children.map((child) => (
            <FieldNode
              key={child.id}
              field={child as FieldConfig | LeafFieldConfig}
              depth={depth + 1}
              onToggleEditable={onToggleEditable}
              onChangeDefault={onChangeDefault}
              onChangeNumberBounds={onChangeNumberBounds}
              onChangeFieldType={onChangeFieldType}
            />
          ))}
        </Stack>
      </Stack>
    )
  }

  // Leaf fields - render inputs
  if (isLeaf) {
    return (
      <Stack gap={2}>
        {field.kind === 'boolean' ? (
          <Group justify="space-between" wrap="nowrap" align="center">
            <Group gap={4} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Tooltip
                label={prettifiedLabel}
                disabled={prettifiedLabel.length <= 20}
                openDelay={0}
                closeDelay={0}
                withArrow={false}
                transitionProps={{ duration: 0 }}
                styles={{ tooltip: { fontSize: 11, padding: '4px 8px' } }}
              >
                <Text
                  size="xs"
                  style={{ flex: 1, minWidth: 0 }}
                  lineClamp={1}
                >
                  {prettifiedLabel}
                </Text>
              </Tooltip>
              <Switch
                size="xs"
                checked={field.defaultValue}
                onChange={(e) => onChangeDefault(field.id, e.currentTarget.checked)}
              />
              <Text size="xs">{field.defaultValue ? 'True' : 'False'}</Text>
            </Group>
            <Group 
              gap="xs" 
              wrap="nowrap" 
              style={{ cursor: 'pointer' }}
              onClick={() => onToggleEditable(field.id, !field.editable)}
            >
              <Text size="xs">Editable</Text>
              <Checkbox
                size="xs"
                checked={field.editable}
                onChange={(e) => {
                  e.stopPropagation()
                  onToggleEditable(field.id, e.currentTarget.checked)
                }}
              />
            </Group>
          </Group>
        ) : (
          <>
            <Group justify="space-between" wrap="nowrap">
              <Tooltip
                label={prettifiedLabel}
                disabled={prettifiedLabel.length <= 20}
                openDelay={0}
                closeDelay={0}
                withArrow={false}
                transitionProps={{ duration: 0 }}
                styles={{ tooltip: { fontSize: 11, padding: '4px 8px' } }}
              >
                <Text
                  size="xs"
                  style={{ flex: 1, minWidth: 0 }}
                  lineClamp={1}
                >
                  {prettifiedLabel}
                </Text>
              </Tooltip>
              <Group 
                gap="xs" 
                wrap="nowrap" 
                style={{ cursor: 'pointer' }}
                onClick={() => onToggleEditable(field.id, !field.editable)}
              >
                <Text size="xs">Editable</Text>
                <Checkbox
                  size="xs"
                  checked={field.editable}
                  onChange={(e) => {
                    e.stopPropagation()
                    onToggleEditable(field.id, e.currentTarget.checked)
                  }}
                />
              </Group>
            </Group>
            {field.kind === 'number' ? (
          <Group gap={4} wrap="nowrap">
            <Group gap={4} grow>
              <NumberInput
                size="xs"
                placeholder="Default"
                value={field.defaultValue}
                step={field.defaultValue % 1 !== 0 ? 0.1 : 1}
                onChange={(value) => {
                  if (value === '') return
                  onChangeDefault(field.id, Number(value))
                }}
                styles={{
                  input: { fontSize: 11, height: 28, paddingLeft: 6, paddingRight: 6 },
                }}
              />
              <NumberInput
                size="xs"
                placeholder="Min"
                value={field.min ?? ''}
                step={field.min && field.min % 1 !== 0 ? 0.1 : 1}
                onChange={(value) => {
                  if (value === '') {
                    onChangeNumberBounds(field.id, { min: undefined })
                    return
                  }
                  onChangeNumberBounds(field.id, { min: Number(value), max: field.max })
                }}
                styles={{
                  input: { fontSize: 11, height: 28, paddingLeft: 6, paddingRight: 6 },
                }}
              />
              <NumberInput
                size="xs"
                placeholder="Max"
                value={field.max ?? ''}
                step={field.max && field.max % 1 !== 0 ? 0.1 : 1}
                onChange={(value) => {
                  if (value === '') {
                    onChangeNumberBounds(field.id, { max: undefined })
                    return
                  }
                  onChangeNumberBounds(field.id, { min: field.min, max: Number(value) })
                }}
                styles={{
                  input: { fontSize: 11, height: 28, paddingLeft: 6, paddingRight: 6 },
                }}
              />
            </Group>
            <Menu withinPortal position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label="Field type"
                >
                  <IconDotsVertical size={12} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Field Type</Menu.Label>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'string')}
                  disabled={field.kind === 'string'}
                >
                  String
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'number')}
                  disabled={field.kind === 'number'}
                >
                  Number
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'color-solid')}
                  disabled={field.kind === 'color' && (!('supportsAlpha' in field) || !(field as any).supportsAlpha)}
                >
                  Hex solid
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'color-alpha')}
                  disabled={field.kind === 'color' && ('supportsAlpha' in field && (field as any).supportsAlpha)}
                >
                  Hex alpha
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ) : field.kind === 'string' ? (
          <Group gap="xs" wrap="nowrap">
            <TextInput
              size="xs"
              value={field.defaultValue}
              onChange={(e) => onChangeDefault(field.id, e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Menu withinPortal position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label="Field type"
                >
                  <IconDotsVertical size={12} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Field Type</Menu.Label>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'string')}
                  disabled={field.kind === 'string'}
                >
                  String
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'number')}
                  disabled={field.kind === 'number'}
                >
                  Number
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'color-solid')}
                  disabled={field.kind === 'color' && (!('supportsAlpha' in field) || !(field as any).supportsAlpha)}
                >
                  Hex solid
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'color-alpha')}
                  disabled={field.kind === 'color' && ('supportsAlpha' in field && (field as any).supportsAlpha)}
                >
                  Hex alpha
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ) : field.kind === 'color' ? (
          <Group gap="xs" wrap="nowrap">
            <ColorInput
              size="xs"
              value={field.defaultValue}
              format={('supportsAlpha' in field && field.supportsAlpha) ? 'rgba' : 'hex'}
              withPicker
              onChange={(value) => {
                // Convert to hex format to keep colors in hex
                const hexValue = convertColorToHex(value)
                onChangeDefault(field.id, hexValue)
              }}
              style={{ flex: 1 }}
            />
            <Menu withinPortal position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  aria-label="Field type"
                >
                  <IconDotsVertical size={12} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Field Type</Menu.Label>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'string')}
                  disabled={field.kind === 'string'}
                >
                  String
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'number')}
                  disabled={field.kind === 'number'}
                >
                  Number
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'color-solid')}
                  disabled={field.kind === 'color' && (!('supportsAlpha' in field) || !(field as any).supportsAlpha)}
                >
                  Hex solid
                </Menu.Item>
                <Menu.Item
                  onClick={() => onChangeFieldType(field.id, 'color-alpha')}
                  disabled={field.kind === 'color' && ('supportsAlpha' in field && (field as any).supportsAlpha)}
                >
                  Hex alpha
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        ) : null}
          </>
        )}
      </Stack>
    )
  }

  return null
}


