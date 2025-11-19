import { useState } from 'react'
import { AppShell, Group, SegmentedControl, Title } from '@mantine/core'
import './App.css'
import { AdminView } from './components/admin/AdminView'
import { EditorView } from './components/editor/EditorView'

type ViewMode = 'admin' | 'editor'

function App() {
  const [view, setView] = useState<ViewMode>('editor')

  return (
    <AppShell
      header={{ height: 60 }}
      padding={0}
      styles={{
        main: {
          backgroundColor: '#f8f9fa',
          padding: 0,
          minHeight: 'calc(100vh - 60px)',
          overflow: 'hidden',
        },
      }}
    >
      <AppShell.Header>
        <Group justify="space-between" h="100%" px="md">
          <Title order={3}>JSON Snippet Builder & Editor</Title>
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as ViewMode)}
            data={[
              { label: 'Admin', value: 'admin' },
              { label: 'Editor', value: 'editor' },
            ]}
          />
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {view === 'admin' ? <AdminView /> : <EditorView />}
      </AppShell.Main>
    </AppShell>
  )
}

export default App
