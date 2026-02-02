# @logisheets/formula-editor-react

A React component for editing spreadsheet formulas with syntax highlighting and autocomplete, built on [CodeMirror 6](https://codemirror.net/).

## Features

- **Token-based syntax highlighting** - Function names, cell references, errors are highlighted
- **Cell reference coloring** - Each cell reference gets a unique color for easy identification
- **Formula autocomplete** - Fuzzy matching for function names with descriptions
- **Robust text editing** - Built on CodeMirror 6 for proper cursor, selection, IME, and accessibility support
- **External styling support** - Font size, alignment, word wrap configurable via props
- **Backend-driven tokenization** - Does NOT parse formulas itself, relies on backend API

## Important Design Decision

This editor does **NOT** tokenize/parse formulas itself. Instead, it:

1. Sends the formula text to a backend API via `getDisplayUnits` callback
2. Receives `FormulaDisplayInfo` containing token positions and cell references
3. Renders the syntax highlighting based on that response

This design ensures:

- Consistent parsing with the spreadsheet engine
- Ability to handle complex formulas, 3D references, etc.
- The editor stays lightweight and focused on UI

## Installation

```bash
# From the LogiSheets root directory
yarn install
```

## Usage

```tsx
import { FormulaEditor, FormulaDisplayInfo, FormulaFunction } from '@logisheets/formula-editor-react'

// Define available functions for autocomplete
const functions: FormulaFunction[] = [
  {
    name: 'SUM',
    description: 'Adds all the numbers in a range',
    args: [
      { argName: 'number1', description: 'First number or range' },
      { argName: 'number2', description: 'Additional numbers', startRepeated: true },
    ],
    argCount: { ge: 1 },
  },
  // ... more functions
]

// Backend API to fetch display units
async function getDisplayUnits(formula: string): Promise<FormulaDisplayInfo | undefined> {
  // Call your backend API here
  // In LogiSheets: workbook.getDisplayUnitsOfFormula(formula)
  return await api.getDisplayUnits(formula)
}

function MyComponent() {
  const [value, setValue] = useState('=SUM(A1:B2)')

  return (
    <FormulaEditor
      value={value}
      onChange={setValue}
      onSubmit={(v) => console.log('Submitted:', v)}
      getDisplayUnits={getDisplayUnits}
      formulaFunctions={functions}
      sheetName="Sheet1"
      config={{
        fontSize: 14,
        textAlign: 'left',
        wordWrap: false,
      }}
    />
  )
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|

| `value` | `string` | Controlled value |
| `defaultValue` | `string` | Initial value (uncontrolled) |
| `onChange` | `(value: string) => void` | Called on every change |
| `onBlur` | `(value: string) => void` | Called when editor loses focus |
| `onSubmit` | `(value: string) => void` | Called on Enter (without modifiers) |
| `onCancel` | `() => void` | Called on Escape |
| `getDisplayUnits` | `(formula: string) => Promise<FormulaDisplayInfo>` | **Required.** Backend API for tokenization |
| `formulaFunctions` | `FormulaFunction[]` | Available functions for autocomplete |
| `sheetName` | `string` | Current sheet name (for cell ref highlighting) |
| `config` | `FormulaEditorConfig` | Styling configuration |

## Config Options

```typescript
interface FormulaEditorConfig {
  fontSize?: number          // Default: 14
  fontFamily?: string        // Default: 'Consolas, Monaco, monospace'
  lineHeight?: number        // Default: 1.4
  textAlign?: 'left' | 'center' | 'right'
  wordWrap?: boolean         // Default: false
  placeholder?: string       // Default: 'Enter a formula...'
  readOnly?: boolean         // Default: false
  autoFocus?: boolean        // Default: false
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|

| `Enter` | Submit formula / Select autocomplete item |
| `Escape` | Cancel / Close autocomplete |
| `Alt+Enter` | Insert line break |
| `↑ / ↓` | Navigate autocomplete |
| `Tab` | Select autocomplete item |
| `Ctrl+Z / Cmd+Z` | Undo |
| `Ctrl+Shift+Z / Cmd+Shift+Z` | Redo |

## Why CodeMirror 6?

We use CodeMirror 6 instead of a custom canvas-based editor because it provides:

- Proper IME (Input Method Editor) support for CJK languages
- Full accessibility (screen readers, keyboard navigation)
- Correct text selection and cursor behavior
- History (undo/redo) out of the box
- Cross-browser compatibility
- Extensible theming system

## Development

```bash
# Start the demo app
cd packages/formula-editor-react
yarn dev

# Open http://localhost:5173
```

The demo app includes:

- Interactive formula editor
- Configuration controls (font size, alignment, word wrap)
- Event logging panel
- Mock implementation of `getDisplayUnits`

## API Types

```typescript
// Token info from backend
interface FormulaDisplayInfo {
  tokenUnits: TokenUnit[]
  cellRefs: CellRef[]
}

interface TokenUnit {
  tokenType: 'funcName' | 'funcArg' | 'cellReference' | 'errorConstant' | 'wrongSuffix' | 'other'
  start: number  // 0-based index in formula (excluding leading '=')
  end: number    // exclusive
}

interface CellRef {
  workbook?: string
  sheet1?: string
  sheet2?: string
  row1?: number
  col1?: number
  row2?: number
  col2?: number
}
```

## Integration with LogiSheets

In the main LogiSheets app, the `getDisplayUnits` function would call:

```typescript
const getDisplayUnits = async (formula: string) => {
  const result = await workbook.getDisplayUnitsOfFormula(formula)
  if (isErrorMessage(result)) return undefined
  return result
}
```

This connects the formula editor to the WASM-based lexer in `lexer4fmt`, which properly handles all Excel formula syntax.
