import { ActionIcon, Button, Group, Select, Table, TextInput, Tooltip } from '@mantine/core'
import { IconTrash, IconAdjustments } from '@tabler/icons-react'
import type { SnippetDefinition } from '../../types/snippets'

interface SnippetListProps {
  snippets: SnippetDefinition[]
  fileTypeOptions: string[]
  accordionGroupOptions: string[]
  onUpdateSnippet: (snippet: SnippetDefinition) => void
  onDeleteSnippet: (id: string) => void
  onEditSnippetFields: (snippet: SnippetDefinition) => void
}

export function SnippetList({
  snippets,
  fileTypeOptions,
  accordionGroupOptions,
  onUpdateSnippet,
  onDeleteSnippet,
  onEditSnippetFields,
}: SnippetListProps) {
  if (snippets.length === 0) {
    return <p>No snippets yet. Create one above.</p>
  }

  const rows = snippets.map((snippet) => (
    <Table.Tr key={snippet.id}>
      <Table.Td>
        <TextInput
          value={snippet.name}
          onChange={(e) => onUpdateSnippet({ ...snippet, name: e.currentTarget.value })}
        />
      </Table.Td>
      <Table.Td>
        <Select
          data={fileTypeOptions}
          value={snippet.fileType}
          searchable
          clearable={false}
          allowDeselect={false}
          onChange={(value) => {
            if (!value) return
            onUpdateSnippet({ ...snippet, fileType: value })
          }}
        />
      </Table.Td>
      <Table.Td>
        <Select
          data={accordionGroupOptions}
          value={snippet.accordionGroup}
          searchable
          clearable={false}
          allowDeselect={false}
          onChange={(value) => {
            if (!value) return
            onUpdateSnippet({ ...snippet, accordionGroup: value })
          }}
        />
      </Table.Td>
      <Table.Td>
        <Group gap="xs" justify="center">
          <Tooltip label="Edit fields & defaults">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconAdjustments size={14} />}
              onClick={() => onEditSnippetFields(snippet)}
            >
              Edit fields
            </Button>
          </Tooltip>
          <Tooltip label="Delete snippet">
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => onDeleteSnippet(snippet.id)}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  ))

  return (
    <Table striped withTableBorder highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>File type</Table.Th>
          <Table.Th>Accordion group</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  )
}


