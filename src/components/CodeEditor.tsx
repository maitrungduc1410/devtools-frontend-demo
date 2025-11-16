import React, { memo } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: string;
  isDark?: boolean;
  readOnly?: boolean;
}

export const CodeEditor: React.FC<CodeEditorProps> = memo(({
  value,
  onChange,
  language = 'javascript',
  theme,
  isDark = false,
  readOnly = false
}) => {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        theme={theme || (isDark ? 'vs-dark' : 'light')}
        value={value}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          roundedSelection: false,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'on',
          contextmenu: true,
          selectOnLineNumbers: true,
          glyphMargin: false,
          folding: true,
          foldingHighlight: true,
          showFoldingControls: 'always',
          renderLineHighlight: 'line',
          smoothScrolling: true,
          cursorBlinking: 'phase',
          cursorSmoothCaretAnimation: 'on',
          readOnly: readOnly,
        }}
      />
    </div>
  );
});