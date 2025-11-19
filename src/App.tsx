import { useState } from 'react'
import {
  AppShell,
  Box,
  Button,
  Group,
  PasswordInput,
  SegmentedControl,
  Text,
  Title,
} from '@mantine/core'
import './App.css'
import { AdminView } from './components/admin/AdminView'
import { EditorView } from './components/editor/EditorView'

type ViewMode = 'admin' | 'editor'

function App() {
  const [view, setView] = useState<ViewMode>('editor')
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState<string | null>(null)

  const ADMIN_PASSWORD = 'password'

  const handleUnlockAdmin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminUnlocked(true)
      setAdminError(null)
      setAdminPassword('')
    } else {
      setAdminError('Incorrect password')
    }
  }

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
        {view === 'admin' ? (
          adminUnlocked ? (
            <AdminView />
          ) : (
            <Box
              style={{
                height: 'calc(100vh - 60px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                style={{
                  width: 320,
                }}
              >
                <Title order={4} mb="sm">
                  Admin access
                </Title>
                <PasswordInput
                  label="Password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleUnlockAdmin()
                    }
                  }}
                />
                {adminError && (
                  <Text size="xs" c="red" mt="xs">
                    {adminError}
                  </Text>
                )}
                <Group justify="space-between" mt="md">
                  <Button variant="default" size="xs" onClick={() => setView('editor')}>
                    Back to editor
                  </Button>
                  <Button size="xs" onClick={handleUnlockAdmin}>
                    Unlock
                  </Button>
                </Group>
              </Box>
            </Box>
          )
        ) : (
          <EditorView />
        )}
      </AppShell.Main>
    </AppShell>
  )
}

export default App
