import { Checkbox, Group, Stack, Text, Switch, NumberInput, TextInput, Tooltip, Badge, ColorInput, Card } from '@mantine/core'
import type { FieldConfig, LeafFieldConfig } from '../../types/snippets'

interface FieldConfigTreeProps {
  fields: FieldConfig[]
  onToggleEditable: (fieldId: string, editable: boolean) => void
  onChangeDefault: (fieldId: string, value: unknown) => void
  onChangeNumberBounds: (fieldId: string, bounds: { min?: number; max?: number }) => void
}

export function FieldConfigTree({
  fields,
  onToggleEditable,
  onChangeDefault,
  onChangeNumberBounds,
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

function hasAlphaChannel(value: string): boolean {
  if (!value) return false
  // Check for rgba format
  if (value.toLowerCase().startsWith('rgba')) return true
  // Check for 8-digit hex (#RRGGBBAA)
  if (/^#[0-9A-Fa-f]{8}$/.test(value)) return true
  return false
}

function FieldNode({
  field,
  depth,
  onToggleEditable,
  onChangeDefault,
  onChangeNumberBounds,
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
            <Text size="sm" fw={500}>
              {prettifiedLabel}
            </Text>
            <Badge size="xs" variant="light" color="gray">
              {field.kind}
            </Badge>
          </Group>
          {field.children.map((child) => (
            <FieldNode
              key={child.id}
              field={child as FieldConfig | LeafFieldConfig}
              depth={depth + 1}
              onToggleEditable={onToggleEditable}
              onChangeDefault={onChangeDefault}
              onChangeNumberBounds={onChangeNumberBounds}
            />
          ))}
        </Stack>
      </Card>
    )
  }

  // Array items - render nested children as cards
  if (field.kind === 'array' && 'children' in field && field.children) {
    return (
      <Stack gap="xs">
        {field.children.map((child, index) => (
          <Card key={child.id} withBorder radius="sm" p="xs">
            <Stack gap="xs">
              <Group gap={6}>
                <Text size="xs" fw={500} c="dimmed">
                  {prettifiedLabel} #{index + 1}
                </Text>
                <Badge size="xs" variant="light" color="gray">
                  {child.kind}
                </Badge>
              </Group>
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
                />
              )}
            </Stack>
          </Card>
        ))}
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
          <Badge size="xs" variant="light" color="gray">
            object
          </Badge>
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
        <Group justify="space-between" wrap="nowrap">
          <Group gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Tooltip label={prettifiedLabel} disabled={prettifiedLabel.length <= 20}>
              <Text
                size="xs"
                style={{ flex: 1, minWidth: 0 }}
                lineClamp={1}
              >
                {prettifiedLabel}
              </Text>
            </Tooltip>
            <Badge size="xs" variant="light" color="gray">
              {field.kind}
            </Badge>
          </Group>
          <Checkbox
            size="xs"
            label="Editable"
            checked={field.editable}
            onChange={(e) => onToggleEditable(field.id, e.currentTarget.checked)}
          />
        </Group>
        {field.kind === 'number' ? (
          <Group gap="xs" grow>
            <NumberInput
              size="xs"
              label="Default"
              value={field.defaultValue}
              onChange={(value) => {
                if (value === '') return
                onChangeDefault(field.id, Number(value))
              }}
            />
            <NumberInput
              size="xs"
              label="Min"
              value={field.min ?? ''}
              onChange={(value) => {
                if (value === '') {
                  onChangeNumberBounds(field.id, { min: undefined })
                  return
                }
                onChangeNumberBounds(field.id, { min: Number(value), max: field.max })
              }}
            />
            <NumberInput
              size="xs"
              label="Max"
              value={field.max ?? ''}
              onChange={(value) => {
                if (value === '') {
                  onChangeNumberBounds(field.id, { max: undefined })
                  return
                }
                onChangeNumberBounds(field.id, { min: field.min, max: Number(value) })
              }}
            />
          </Group>
        ) : field.kind === 'boolean' ? (
          <Group gap="xs" align="center">
            <Switch
              size="xs"
              checked={field.defaultValue}
              onChange={(e) => onChangeDefault(field.id, e.currentTarget.checked)}
            />
            <Text size="xs">{field.defaultValue ? 'True' : 'False'}</Text>
          </Group>
        ) : field.kind === 'string' ? (
          <TextInput
            size="xs"
            label="Default"
            value={field.defaultValue}
            onChange={(e) => onChangeDefault(field.id, e.currentTarget.value)}
          />
        ) : field.kind === 'color' ? (
          <ColorInput
            size="xs"
            label="Default"
            value={field.defaultValue}
            format={hasAlphaChannel(field.defaultValue) ? 'rgba' : 'hex'}
            withPicker
            onChange={(value) => onChangeDefault(field.id, value)}
          />
        ) : null}
      </Stack>
    )
  }

  return null
}


