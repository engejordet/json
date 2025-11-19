import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ActionIcon, Group, Stack, Text, rem, Tooltip } from '@mantine/core'
import { IconGripVertical, IconTrash } from '@tabler/icons-react'
import type { SnippetDefinition } from '../../types/snippets'

interface SnippetSidebarProps {
  snippets: SnippetDefinition[]
  activeId: string | null
  onSelect: (snippet: SnippetDefinition) => void
  onReorder: (orderedIds: string[]) => void
  onDelete: (id: string) => void
  enableSorting?: boolean
}

export function SnippetSidebar({
  snippets,
  activeId,
  onSelect,
  onReorder,
  onDelete,
  enableSorting = true,
}: SnippetSidebarProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = snippets.findIndex((s) => s.id === active.id)
    const newIndex = snippets.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(snippets, oldIndex, newIndex)
    onReorder(reordered.map((s) => s.id))
  }

  if (!enableSorting) {
    return (
      <Stack gap={4}>
        {snippets.map((snippet) => (
          <StaticSnippetRow
            key={snippet.id}
            snippet={snippet}
            active={snippet.id === activeId}
            onClick={() => onSelect(snippet)}
            onDelete={() => onDelete(snippet.id)}
          />
        ))}
      </Stack>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={snippets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <Stack gap={4}>
          {snippets.map((snippet) => (
            <SortableSnippetRow
              key={snippet.id}
              snippet={snippet}
              active={snippet.id === activeId}
              onClick={() => onSelect(snippet)}
              onDelete={() => onDelete(snippet.id)}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  )
}

interface SortableSnippetRowProps {
  snippet: SnippetDefinition
  active: boolean
  onClick: () => void
  onDelete: () => void
}

function SortableSnippetRow({ snippet, active, onClick, onDelete }: SortableSnippetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: snippet.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    cursor: 'pointer',
    borderRadius: rem(4),
    padding: '4px 6px',
    backgroundColor: active ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
  }

  return (
    <Group
      ref={setNodeRef}
      style={style}
      gap={6}
      wrap="nowrap"
      onClick={onClick}
      align="center"
      justify="space-between"
    >
      <Group gap={6} wrap="nowrap" align="center">
        <ActionIcon
          size="xs"
          variant="subtle"
          color="gray"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <IconGripVertical size={14} />
        </ActionIcon>
        <Stack gap={0} style={{ overflow: 'hidden' }}>
          <Text size="xs" fw={500} lineClamp={1}>
            {snippet.name}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {snippet.fileType} • {snippet.accordionGroup}
          </Text>
        </Stack>
      </Group>
      <Tooltip label="Delete snippet" openDelay={200}>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="red"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}

interface StaticSnippetRowProps {
  snippet: SnippetDefinition
  active: boolean
  onClick: () => void
  onDelete: () => void
}

function StaticSnippetRow({ snippet, active, onClick, onDelete }: StaticSnippetRowProps) {
  const style: React.CSSProperties = {
    borderRadius: rem(4),
    padding: '4px 6px',
    cursor: 'pointer',
    backgroundColor: active ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
  }

  return (
    <Group
      style={style}
      gap={6}
      wrap="nowrap"
      onClick={onClick}
      align="center"
      justify="space-between"
    >
      <Stack gap={0} style={{ overflow: 'hidden' }}>
        <Text size="xs" fw={500} lineClamp={1}>
          {snippet.name}
        </Text>
        <Text size="xs" c="dimmed" lineClamp={1}>
          {snippet.fileType} • {snippet.accordionGroup}
        </Text>
      </Stack>
      <Tooltip label="Delete snippet" openDelay={200}>
        <ActionIcon
          size="xs"
          variant="subtle"
          color="red"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Tooltip>
    </Group>
  )
}


