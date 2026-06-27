# LogiSheets Engine

A standalone spreadsheet engine built with Svelte 5. This package provides a complete spreadsheet component that can be embedded into any web application.

## Features

- 📊 Full spreadsheet functionality with Excel-like formula support
- 🚀 Web Worker-based architecture for optimal performance
- 🎨 OffscreenCanvas rendering for smooth scrolling
- 📦 Works with .xlsx files via WASM-powered parser
- 🔧 Highly configurable with clean external interfaces
- 📑 Built-in sheet tabs for multi-sheet workbooks
- 📜 Smooth scrollbars with auto-hide
- 🪟 Multiple synchronized views of one workbook via Sessions (split / second view)

## Installation

```bash
npm install logisheets-engine
```

## Quick Start

### Launch the development server

```bash
npm run launch
```

This will open the engine in your default browser at `http://localhost:5173`.

### Using in Your Application

```svelte
<script>
    import { Spreadsheet } from 'logisheets-engine'
    import type { SelectedData, EngineConfig, SheetInfo } from 'logisheets-engine'
    
    let spreadsheet: Spreadsheet
    let selectedData: SelectedData = { source: 'none' }
    let activeSheet = 0
    
    // Optional: customize the engine
    const config: Partial<EngineConfig> = {
        leftTopWidth: 40,       // Row header width
        leftTopHeight: 28,      // Column header height
        scrollbarSize: 14,      // Scrollbar thickness
    }
    
    async function loadFile(file: File) {
        const buffer = await file.arrayBuffer()
        await spreadsheet.loadWorkbook(new Uint8Array(buffer), file.name)
    }
</script>

<div style="width: 100%; height: 600px;">
    <Spreadsheet
        bind:this={spreadsheet}
        bind:selectedData
        bind:activeSheet
        {config}
        showSheetTabs={true}
        showScrollbars={true}
        onSelectedDataChange={(data) => console.log('Selection:', data)}
        onActiveSheetChange={(idx) => console.log('Active sheet:', idx)}
        onSheetsChange={(sheets) => console.log('Sheets:', sheets)}
    />
</div>
```

## API

### `<Spreadsheet>` Component

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `selectedData` | `SelectedData` | `{ source: 'none' }` | Currently selected cells (bindable) |
| `activeSheet` | `number` | `0` | Index of active sheet (bindable) |
| `cellLayouts` | `CellLayout[]` | `[]` | Custom cell layout overrides |
| `config` | `Partial<EngineConfig>` | `{}` | Engine configuration |
| `showSheetTabs` | `boolean` | `true` | Show sheet tabs at bottom |
| `showScrollbars` | `boolean` | `true` | Show scrollbars |

#### Callbacks

| Callback | Signature | Description |
|----------|-----------|-------------|
| `onSelectedDataChange` | `(data: SelectedData) => void` | Called when selection changes |
| `onActiveSheetChange` | `(sheet: number) => void` | Called when active sheet changes |
| `onGridChange` | `(grid: Grid \| null) => void` | Called when grid data updates |
| `onSheetsChange` | `(sheets: SheetInfo[]) => void` | Called when sheets list changes |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `loadWorkbook` | `(data: Uint8Array, name: string) => Promise<void>` | Load an Excel file |
| `setActiveSheet` | `(idx: number) => void` | Switch to a different sheet |
| `getDataService` | `() => DataService \| null` | Get the underlying data service |

## Multiple Views (Engine + Sessions)

The `<Spreadsheet>` component above is the simplest way to embed a single view.
For more control — and especially to show **multiple synchronized views of the
same workbook** (a "second view" / split window) — use the `Engine` + `Session`
API directly.

The model is two layered objects:

- **`Engine`** owns everything *shared* across all views of one workbook: the
  Web Worker, the workbook/data service, the sheet-info cache, and the
  workbook-level events (`ready` / `sheetChange` / `cellChange`). There is one
  Engine per workbook.
- **`Session`** owns everything *per view*: its mounted UI, active sheet,
  selection, rendered grid, and viewport. Multiple Sessions share one Engine, so
  an edit made in any Session is immediately reflected in all the others.

Each Session renders to its own `OffscreenCanvas` in the shared worker, so views
can scroll independently and even display different sheets at the same time.

### Creating a second view

```ts
import { Engine } from 'logisheets-engine'

// One Engine == one workbook (one worker).
const engine = new Engine({ scrollbarSize: 14 })

// Load the file once, on the shared Engine.
await engine.loadFile(new Uint8Array(buffer), 'book.xlsx')

// First view.
const main = engine.createSession()
main.mount(document.getElementById('view-main')!)

// Second view of the SAME workbook — edits sync both ways.
const second = engine.createSession()
second.mount(document.getElementById('view-second')!)

// Views are independent: point the second one at another sheet.
second.setCurrentSheetIndex(1)

// React to per-view changes.
second.on('selectionChange', (sel) => console.log('second view selection', sel))

// Tear a view down when its window closes (releases its canvas in the worker).
second.destroy()
```

> Backwards compatibility: `new Engine()` plus the legacy `engine.mount(...)`,
> `engine.setSelection(...)`, `engine.render(...)`, etc. still work — they
> transparently delegate to a lazily-created default (primary) Session. Existing
> single-window callers need no changes. Reach for `createSession()` only when
> you want more than one view.

### `Engine` Class

| Member | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(config?: Partial<EngineConfig>)` | Spins up the worker + workbook |
| `createSession` | `() => Session` | Create a new view sharing this workbook |
| `getDefaultSession` | `() => Session` | The primary Session backing the legacy methods |
| `loadFile` | `(data: Uint8Array, name: string) => Promise<Grid \| null>` | Load an Excel file (shared) |
| `getWorkbook` | `() => WorkbookClient` | The underlying logisheets-web API |
| `getDataService` | `() => DataService` | Shared data service |
| `getBlockManager` | `() => BlockManager` | Shared block/field manager |
| `isReady` | `() => boolean` | Whether the worker has finished init |
| `on` / `off` | `(type, callback) => void` | Subscribe to workbook **or** (forwarded) default-view events |
| `destroy` | `() => void` | Destroy all sessions and terminate the worker |

Engine (workbook-level) events: `ready`, `sheetChange`, `cellChange`, `error`.

### `Session` Class

| Member | Signature | Description |
|--------|-----------|-------------|
| `mount` | `(container: HTMLElement, options?: SessionMountOptions) => void` | Render this view into a DOM element |
| `unmount` | `() => void` | Remove the view's UI (keeps the session) |
| `isMounted` | `() => boolean` | Whether the UI is currently mounted |
| `initOffscreen` | `(canvas: HTMLCanvasElement) => Promise<void>` | Headless rendering without a mounted UI |
| `render` / `resize` | `(…) => Promise<Grid \| null>` | Manual render / canvas resize |
| `getSelection` / `setSelection` | `(…)` | Read / set this view's selection |
| `getCurrentSheetIndex` / `setCurrentSheetIndex` | `(…)` | Read / switch this view's active sheet |
| `getGrid` | `() => Grid \| null` | This view's last rendered grid |
| `getSheets` | `() => readonly SheetInfo[]` | Shared sheet list |
| `on` / `off` | `(type, callback) => void` | Subscribe to per-view events |
| `destroy` | `() => void` | Unmount and release this view from the Engine |

Session (per-view) events: `selectionChange`, `gridChange`, `activeSheetChange`,
`startEdit`, `invalidFormula`, `error`.

`SessionMountOptions` accepts `showSheetTabs`, `showScrollbars`,
`contextMenuItems`, `cellLayouts`, `getIsEditingFormula`, and `onInvalidFormula`.

### `EngineConfig` Interface

```typescript
interface EngineConfig {
    leftTopWidth: number       // Width of row header panel (default: 32)
    leftTopHeight: number      // Height of column header panel (default: 24)
    showHorizontalGridLines: boolean  // Show horizontal grid lines (default: true)
    showVerticalGridLines: boolean    // Show vertical grid lines (default: true)
    defaultCellWidth: number   // Default cell width in pt (default: 6)
    defaultCellHeight: number  // Default cell height in pt (default: 25)
    scrollbarSize: number      // Scrollbar thickness in pixels (default: 16)
}
```

### `DataService` Class

The `DataService` class provides programmatic access to workbook data:

```typescript
const service = spreadsheet.getDataService()

// Get all sheets
const sheets = service.getCacheAllSheetInfo()

// Get current sheet ID
const sheetId = service.getCurrentSheetId()

// Execute transactions (formula changes, cell edits, etc.)
await service.transaction(payload)
```

## Architecture

The engine uses a Web Worker-based architecture for optimal performance. One
`Engine` (one worker / one workbook) fans out to any number of `Session` views,
each driving its own `<Spreadsheet>` UI and its own OffscreenCanvas in the shared
worker:

```
┌──────────────────────────────────────────────┐
│   Main Thread                                  │
│  ┌────────────┐        ┌────────────┐          │
│  │ Session A  │        │ Session B  │  …views   │
│  │ Spreadsheet│        │ Spreadsheet│          │
│  └─────┬──────┘        └─────┬──────┘          │
│        │                     │                 │
│        └──────────┬──────────┘                 │
│              ┌─────▼──────┐                     │
│              │   Engine   │ (shared workbook)   │
│              │ DataService│                     │
│              └─────┬──────┘                     │
└────────────────────┼───────────────────────────┘
                     │ postMessage
┌────────────────────▼───────────────────────────┐
│   Web Worker                                     │
│  ┌───────────────┐   ┌────────────────────────┐ │
│  │   Workbook    │   │ OffscreenCanvas per     │ │
│  │   Service     │   │ Session (canvasId 1,2…) │ │
│  └───────────────┘   └────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Type checking
npm run check

# Build library (with obfuscation)
npm run build:lib

# Build for demo app
npm run build
```

## Standalone Components

You can also use individual components:

```svelte
<script>
    import { SheetTabs, Scrollbar, ColumnHeaders, RowHeaders } from 'logisheets-engine'
</script>
```

## License

MIT
