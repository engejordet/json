import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import App from './App'

function renderWithMantine() {
  return render(
    <MantineProvider defaultColorScheme="dark">
      <App />
    </MantineProvider>,
  )
}

describe('App layout', () => {
  it('renders Admin view by default', () => {
    renderWithMantine()
    expect(screen.getByText('JSON Snippet Builder & Editor')).toBeInTheDocument()
    expect(screen.getByText('Snippet builder')).toBeInTheDocument()
  })

  it('can render Editor view without crashing', () => {
    renderWithMantine()
    const editorToggles = screen.getAllByRole('radio', { name: /editor/i })
    editorToggles[0].click()
    expect(screen.getByText('JSON editor')).toBeInTheDocument()
    expect(screen.getByText('Input JSON')).toBeInTheDocument()
  })
})


