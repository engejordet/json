import { useMantineColorScheme } from '@mantine/core'
import CodeMirror from '@uiw/react-codemirror'
import { githubDark, githubLight } from '@uiw/codemirror-theme-github'
import { json } from '@codemirror/lang-json'

interface JsonCodeEditorProps {
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
  height?: string
}

export function JsonCodeEditor({ value, onChange, readOnly, height = '320px' }: JsonCodeEditorProps) {
  const { colorScheme } = useMantineColorScheme()
  const theme = colorScheme === 'dark' ? githubDark : githubLight

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={theme}
      extensions={[json()]}
      editable={!readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
      }}
      onChange={(val) => {
        onChange?.(val)
      }}
      style={{
        height: '100%',
        width: '100%',
      }}
    />
  )
}


