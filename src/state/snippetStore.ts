import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SnippetDefinition, SnippetMetadataUpdate } from '../types/snippets'

interface SnippetState {
  snippets: SnippetDefinition[]
  addSnippet: (snippet: SnippetDefinition) => void
  updateSnippet: (snippet: SnippetDefinition) => void
  updateSnippetMetadata: (update: SnippetMetadataUpdate) => void
  deleteSnippet: (id: string) => void
  reorderSnippetsForFileType: (fileType: string, orderedIds: string[]) => void
  clearSnippets: () => void
}

export const useSnippetStore = create<SnippetState>()(
  persist(
    (set) => ({
      snippets: [],
      addSnippet: (snippet) =>
        set((state) => ({
          snippets: [...state.snippets, snippet],
        })),
      updateSnippet: (snippet) =>
        set((state) => ({
          snippets: state.snippets.map((s) => (s.id === snippet.id ? snippet : s)),
        })),
      updateSnippetMetadata: (update) =>
        set((state) => ({
          snippets: state.snippets.map((s) =>
            s.id === update.id
              ? {
                  ...s,
                  ...update,
                }
              : s,
          ),
        })),
      deleteSnippet: (id) =>
        set((state) => ({
          snippets: state.snippets.filter((s) => s.id !== id),
        })),
      reorderSnippetsForFileType: (fileType, orderedIds) =>
        set((state) => {
          const idToSnippet = new Map(state.snippets.map((s) => [s.id, s]))

          // Global reorder when viewing "all"
          if (fileType === 'all') {
            const ordered = orderedIds
              .map((id) => idToSnippet.get(id))
              .filter((s): s is SnippetDefinition => !!s)

            if (ordered.length !== state.snippets.length) {
              return state
            }

            return { snippets: ordered }
          }

          const sameTypeIds = state.snippets.filter((s) => s.fileType === fileType).map((s) => s.id)
          const orderedSameType = orderedIds
            .map((id) => idToSnippet.get(id))
            .filter((s): s is SnippetDefinition => !!s)

          // Fallback: if something went wrong, keep original order
          if (orderedSameType.length !== sameTypeIds.length) {
            return state
          }

          let sameTypeIndex = 0
          const newSnippets: SnippetDefinition[] = []
          for (const snippet of state.snippets) {
            if (snippet.fileType === fileType) {
              newSnippets.push(orderedSameType[sameTypeIndex]!)
              sameTypeIndex += 1
            } else {
              newSnippets.push(snippet)
            }
          }

          return { snippets: newSnippets }
        }),
      clearSnippets: () => set(() => ({ snippets: [] })),
    }),
    {
      name: 'json-editor-snippets',
    },
  ),
)


