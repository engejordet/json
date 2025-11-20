import { CSS } from '@dnd-kit/utilities'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ActionIcon, Button, Group, Stack, Text } from '@mantine/core'
import { IconGripVertical, IconTrash } from '@tabler/icons-react'
import type { SnippetDefinition } from '../../types/snippets'

interface SnippetSidebarProps {
  snippets: SnippetDefinition[]
  onSelect: (snippet: SnippetDefinition) => void
  onReorder: (orderedIds: string[]) => void
  onMove?: (snippetId: string, newFileType: string, newGroup: string) => void
  onDelete: (id: string) => void
  showDelete?: boolean
}

export function SnippetSidebar({
  snippets,
  onSelect,
  onReorder,
  onMove,
  onDelete,
  showDelete = false,
}: SnippetSidebarProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Handle group header drag - reorder entire groups within the same file type
  const handleGroupHeaderDrag = (activeId: string, overId: string) => {
    // Parse the dragged group header: "sortable-group-{fileType}__SEP__{groupName}"
    const activeContent = activeId.replace('sortable-group-', '')
    const activeSepIndex = activeContent.indexOf('__SEP__')
    if (activeSepIndex === -1) return
    
    const draggedFileType = activeContent.substring(0, activeSepIndex)
    const draggedGroupName = activeContent.substring(activeSepIndex + 7)
    
    // Get all snippets in the dragged group
    const draggedGroupSnippets = snippets.filter(
      (s) => s.fileType === draggedFileType && s.accordionGroup === draggedGroupName,
    )
    if (draggedGroupSnippets.length === 0) return
    
    // Find target position
    let targetIndex = -1
    
    if (overId.startsWith('sortable-group-')) {
      // Dropped on another group header
      const overContent = overId.replace('sortable-group-', '')
      const overSepIndex = overContent.indexOf('__SEP__')
      if (overSepIndex === -1) return
      
      const targetFileType = overContent.substring(0, overSepIndex)
      const targetGroupName = overContent.substring(overSepIndex + 7)
      
      // Only allow reordering within the same file type
      if (targetFileType !== draggedFileType) return
      
      // Find first snippet in target group
      const targetGroupSnippets = snippets.filter(
        (s) => s.fileType === targetFileType && s.accordionGroup === targetGroupName,
      )
      if (targetGroupSnippets.length > 0) {
        targetIndex = visualOrderIds.findIndex((id) => id === targetGroupSnippets[0]!.id)
      } else {
        // Empty target group - find position after it
        const allGroupsInType = Array.from(
          new Set(
            snippets
              .filter((s) => s.fileType === targetFileType)
              .map((s) => s.accordionGroup),
          ),
        )
        const targetGroupIndex = allGroupsInType.indexOf(targetGroupName)
        if (targetGroupIndex !== -1) {
          // Find first snippet of the group after target
          if (targetGroupIndex < allGroupsInType.length - 1) {
            const nextGroup = allGroupsInType[targetGroupIndex + 1]
            const nextGroupSnippets = snippets.filter(
              (s) => s.fileType === targetFileType && s.accordionGroup === nextGroup,
            )
            if (nextGroupSnippets.length > 0) {
              targetIndex = visualOrderIds.findIndex((id) => id === nextGroupSnippets[0]!.id)
            }
          }
        }
      }
    } else if (overId.startsWith('header-group-')) {
      // Dropped on a droppable group header (different file type - not allowed)
      return
    } else {
      // Dropped on a snippet - find its position
      const targetSnippet = snippets.find((s) => s.id === overId)
      if (targetSnippet && targetSnippet.fileType === draggedFileType) {
        targetIndex = visualOrderIds.findIndex((id) => id === overId)
      }
    }
    
    if (targetIndex === -1) return
    
    // Find the position of the first snippet in the dragged group
    const firstDraggedSnippet = draggedGroupSnippets[0]!
    const draggedGroupStartIndex = visualOrderIds.findIndex((id) => id === firstDraggedSnippet.id)
    if (draggedGroupStartIndex === -1) return
    
    // Remove all snippets from the dragged group
    const withoutDraggedGroup = visualOrderSnippets.filter(
      (s) => !(s.fileType === draggedFileType && s.accordionGroup === draggedGroupName),
    )
    
    // Calculate insertion index
    let insertIndex = targetIndex
    if (targetIndex > draggedGroupStartIndex) {
      // Moving forward - adjust for removed items
      insertIndex = targetIndex - draggedGroupSnippets.length
    }
    insertIndex = Math.max(0, Math.min(insertIndex, withoutDraggedGroup.length))
    
    // Insert all snippets from the dragged group at the new position
    const finalOrder = [
      ...withoutDraggedGroup.slice(0, insertIndex),
      ...draggedGroupSnippets,
      ...withoutDraggedGroup.slice(insertIndex),
    ]
    
    onReorder(finalOrder.map((s) => s.id))
  }

  // Group snippets by file type, then by accordion group
  // Preserve the order as they appear in the snippets array
  const fileTypeGroups = new Map<string, Map<string, SnippetDefinition[]>>()
  const fileTypeOrder: string[] = [] // Track order of file types
  const groupOrder = new Map<string, string[]>() // Track order of groups within each file type
  
  for (const snippet of snippets) {
    const ft = snippet.fileType
    const group = snippet.accordionGroup || 'General'
    
    // Track file type order (first occurrence)
    if (!fileTypeGroups.has(ft)) {
      fileTypeGroups.set(ft, new Map())
      fileTypeOrder.push(ft)
    }
    
    const groups = fileTypeGroups.get(ft)!
    
    // Track group order within file type (first occurrence)
    if (!groups.has(group)) {
      if (!groupOrder.has(ft)) {
        groupOrder.set(ft, [])
      }
      groupOrder.get(ft)!.push(group)
    }
    
    const list = groups.get(group) ?? []
    list.push(snippet)
    groups.set(group, list)
  }

  // Create flattened array matching visual order for SortableContext
  // Iterate in the preserved order
  const visualOrderSnippets: SnippetDefinition[] = []
  const visualOrderIds: string[] = []
  const groupHeaderIds: string[] = []
  
  for (const ft of fileTypeOrder) {
    const groups = fileTypeGroups.get(ft)!
    const groupsInOrder = groupOrder.get(ft) || []
    
    for (const groupName of groupsInOrder) {
      const groupSnippets = groups.get(groupName)
      if (!groupSnippets) continue
      
      // Add group header ID for sorting
      groupHeaderIds.push(`sortable-group-${ft}__SEP__${groupName}`)
      for (const snippet of groupSnippets) {
        visualOrderSnippets.push(snippet)
        visualOrderIds.push(snippet.id)
      }
    }
  }
  
  // Combine snippet IDs and group header IDs for SortableContext
  const allSortableIds = [...visualOrderIds, ...groupHeaderIds]

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    
    const activeId = active.id as string
    const overId = over.id as string
    
    // Check if we're dragging a group header
    if (activeId.startsWith('sortable-group-')) {
      handleGroupHeaderDrag(activeId, overId)
      return
    }
    
    const draggedSnippet = snippets.find((s) => s.id === activeId)
    if (!draggedSnippet) return
    
    const oldIndex = visualOrderIds.findIndex((id) => id === active.id)
    if (oldIndex === -1) return
    
    // Find the target snippet to determine new file type/group and exact drop position
    let newFileType = draggedSnippet.fileType
    let newGroup = draggedSnippet.accordionGroup
    let targetIndex = oldIndex
    
    const targetId = over.id as string
    
    // Check if we dropped on a header (file type or group)
    if (targetId.startsWith('header-filetype-')) {
      // Dropped on file type header
      const fileType = targetId.replace('header-filetype-', '')
      newFileType = fileType
      // Find first snippet in this file type to determine group, or use first group
      const firstSnippetInType = visualOrderSnippets.find((s) => s.fileType === fileType)
      if (firstSnippetInType) {
        newGroup = firstSnippetInType.accordionGroup
        targetIndex = visualOrderIds.findIndex((id) => id === firstSnippetInType.id)
        if (targetIndex === -1) targetIndex = 0
      } else {
        // No snippets in this type yet, place at end
        targetIndex = visualOrderSnippets.length
      }
    } else if (targetId.startsWith('header-group-')) {
      // Dropped on group header - format: "header-group-{fileType}__SEP__{groupName}"
      const content = targetId.replace('header-group-', '')
      const sepIndex = content.indexOf('__SEP__')
      if (sepIndex !== -1) {
        newFileType = content.substring(0, sepIndex)
        newGroup = content.substring(sepIndex + 7) // 7 is length of '__SEP__'
        // Find first snippet in this group
        const firstSnippetInGroup = visualOrderSnippets.find(
          (s) => s.fileType === newFileType && s.accordionGroup === newGroup,
        )
        if (firstSnippetInGroup) {
          targetIndex = visualOrderIds.findIndex((id) => id === firstSnippetInGroup.id)
          if (targetIndex === -1) targetIndex = 0
        } else {
          // No snippets in this group yet, find position after the group header
          const fileTypeIndex = visualOrderSnippets.findIndex((s) => s.fileType === newFileType)
          if (fileTypeIndex !== -1) {
            targetIndex = fileTypeIndex
          } else {
            targetIndex = visualOrderSnippets.length
          }
        }
      }
    } else {
      // Dropped on a snippet - place after that snippet
      const targetSnippet = snippets.find((s) => s.id === targetId)
      if (targetSnippet) {
        newFileType = targetSnippet.fileType
        newGroup = targetSnippet.accordionGroup
        const targetSnippetIndex = visualOrderIds.findIndex((id) => id === targetId)
        if (targetSnippetIndex === -1) {
          targetIndex = oldIndex
        } else {
          // Place after the target snippet
          targetIndex = targetSnippetIndex + 1
        }
      } else {
        // Not a snippet, not a header - might be invalid, use old position
        return
      }
    }
    
    // Update the snippet's metadata if file type or group changed
    const metadataChanged = draggedSnippet.fileType !== newFileType || draggedSnippet.accordionGroup !== newGroup
    
    // Create the updated snippet with new metadata
    const updatedSnippet = metadataChanged
      ? {
          ...draggedSnippet,
          fileType: newFileType,
          accordionGroup: newGroup,
        }
      : draggedSnippet
    
    // Build the final ordered array with the snippet at the exact drop position
    // First, remove the dragged snippet from its old position
    const withoutDragged = visualOrderSnippets.filter((s) => s.id !== draggedSnippet.id)
    
    // Calculate the correct insertion index
    // targetIndex is now the position AFTER the target snippet (or at the end)
    // When moving forward (oldIndex < targetIndex), we need to account for the removed item
    // When moving backward (oldIndex > targetIndex), no adjustment needed
    let adjustedTargetIndex = targetIndex
    if (oldIndex < targetIndex) {
      // Moving forward: we removed an item before the target position
      // The target position shifts down by 1, so we subtract 1
      adjustedTargetIndex = targetIndex - 1
    }
    // else: moving backward or same position, no adjustment needed
    
    // Ensure index is within bounds
    const safeTargetIndex = Math.max(0, Math.min(adjustedTargetIndex, withoutDragged.length))
    
    // Build final order with updated snippet at the correct position
    // IMPORTANT: Use the updated snippet with new metadata so the grouping logic
    // will place it in the correct group when the component re-renders
    const finalOrder = [
      ...withoutDragged.slice(0, safeTargetIndex),
      updatedSnippet,
      ...withoutDragged.slice(safeTargetIndex),
    ]
    
    // Update metadata and reorder
    // IMPORTANT: For metadata changes, we need to update the store first,
    // then reorder. Zustand updates are synchronous, so the store will have
    // the updated metadata when onReorder is called.
    if (metadataChanged && onMove) {
      onMove(draggedSnippet.id, newFileType, newGroup)
    }
    
    // Always reorder to place the snippet at the exact drop position
    // The finalOrder array contains the updated snippet with new metadata,
    // so the reorder will place it correctly even if metadata changed
    onReorder(finalOrder.map((s) => s.id))
  }

  // Droppable header component for file types
  function DroppableFileTypeHeader({ fileType }: { fileType: string }) {
    const { setNodeRef, isOver } = useDroppable({
      id: `header-filetype-${fileType}`,
    })

    return (
      <Text
        ref={setNodeRef}
        size="xs"
        fw={700}
        c="blue"
        tt="uppercase"
        style={{
          backgroundColor: isOver ? 'rgba(100, 200, 255, 0.2)' : 'transparent',
          padding: '4px 8px',
          borderRadius: 4,
          transition: 'background-color 0.2s',
        }}
      >
        {fileType}
      </Text>
    )
  }

  // Sortable and droppable header component for groups
  function SortableGroupHeader({ fileType, groupName }: { fileType: string; groupName: string }) {
    const sortableId = `sortable-group-${fileType}__SEP__${groupName}`
    const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({
      id: sortableId,
    })
    
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
      id: `header-group-${fileType}__SEP__${groupName}`,
    })

    // Only apply transform when this header itself is being dragged, not when something is dragged over it
    const style: React.CSSProperties = {
      transform: isDragging ? CSS.Transform.toString(transform) : undefined,
      transition: isDragging ? transition : undefined,
      opacity: isDragging ? 0.6 : 1,
    }

    // Combine both refs
    const combinedRef = (node: HTMLParagraphElement | null) => {
      setSortableRef(node)
      setDroppableRef(node)
    }

    return (
      <Text
        ref={combinedRef}
        size="xs"
        fw={600}
        c="dimmed"
        tt="uppercase"
        pl="xs"
        style={{
          ...style,
          backgroundColor: isOver && !isDragging ? 'rgba(100, 200, 255, 0.15)' : 'transparent',
          padding: '4px 8px',
          borderRadius: 4,
          transition: isDragging ? 'opacity 0.2s, transform 0.2s' : 'background-color 0.2s',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        {...attributes}
        {...listeners}
      >
        {groupName}
      </Text>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={allSortableIds} strategy={verticalListSortingStrategy}>
        <Stack gap="xs" p="xs">
          {Array.from(fileTypeGroups.entries()).map(([ft, groups]) => (
            <Stack key={ft} gap="xs">
              <DroppableFileTypeHeader fileType={ft} />
              {Array.from(groups.entries()).map(([groupName, groupSnippets]) => (
                <Stack key={groupName} gap={4}>
                  <SortableGroupHeader fileType={ft} groupName={groupName} />
                  {groupSnippets.map((snippet) => (
                    <SortableSnippetRow
                      key={snippet.id}
                      snippet={snippet}
                      onClick={() => onSelect(snippet)}
                      onDelete={() => onDelete(snippet.id)}
                      showDelete={showDelete}
                    />
                  ))}
                </Stack>
              ))}
            </Stack>
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  )
}

interface SortableSnippetRowProps {
  snippet: SnippetDefinition
  onClick: () => void
  onDelete: () => void
  showDelete: boolean
}

function SortableSnippetRow({
  snippet,
  onClick,
  onDelete,
  showDelete,
}: SortableSnippetRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: snippet.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <Group
      ref={setNodeRef}
      style={{
        ...style,
        padding: '4px 6px',
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        cursor: 'pointer',
      }}
      gap="xs"
      wrap="nowrap"
      justify="space-between"
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'
      }}
    >
      <Group gap={6} wrap="nowrap" align="center" style={{ flex: 1, minWidth: 0 }}>
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
      </Group>
      <Group gap="xs" wrap="nowrap">
        <Button
          size="xs"
          variant="light"
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
        >
          Edit
        </Button>
        {showDelete && (
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
        )}
      </Group>
    </Group>
  )
}

