# LogiSheets Engine

A high-performance spreadsheet rendering and editing library built with Svelte 5 and Web Workers.

## Features

- 🚀 High-performance canvas rendering with OffscreenCanvas
- 🔄 Web Worker architecture for non-blocking operations
- 📊 Full spreadsheet functionality (selection, editing, formulas)
- 🎨 Customizable cell layouts and styling
- 📱 Responsive scrollbars and touch support
- 🔌 Works with logisheets-web WASM engine
- 🪟 Multiple synchronized views of one workbook via Sessions (split / second view)

## Installation

```bash
npm install logisheets-engine logisheets-web
```

## Usage

### Svelte

```svelte
<script>
  import { Spreadsheet } from 'logisheets-engine';
  import 'logisheets-engine/style.css';
  
  let selectedData = $state({ source: 'none' });
  let activeSheet = $state(0);
</script>

<Spreadsheet
  bind:selectedData
  bind:activeSheet
  showSheetTabs={true}
  showScrollbars={true}
/>
```

### React / Other Frameworks

Use the DataService and WorkbookClient directly:

```typescript
import { DataService } from 'logisheets-engine';
import 'logisheets-engine/style.css';

// Create a worker and data service
const worker = new Worker(new URL('./worker.js', import.meta.url));
const dataService = new DataService(worker);

// Load a workbook
const fileBuffer = await fetch('workbook.xlsx').then(r => r.arrayBuffer());
await dataService.loadWorkbook(new Uint8Array(fileBuffer), 'workbook.xlsx');

// Render
const grid = await dataService.render(sheetId, anchorX, anchorY);
```

### Multiple Views (Engine + Sessions)

An `Engine` owns one workbook (one worker). It hands out `Session` objects — one
per on-screen view — that all share that workbook, so an edit in any view shows
up in the others instantly. Use this for split panes or a "second view".

```typescript
import { Engine } from 'logisheets-engine';
import 'logisheets-engine/style.css';

const engine = new Engine();
engine.on('ready', async () => {
  await engine.loadFile(bytes, 'book.xlsx'); // load once, on the engine

  const main = engine.createSession();
  main.mount(document.getElementById('view-main'));

  // Second view of the SAME workbook — edits sync both ways.
  const second = engine.createSession();
  second.mount(document.getElementById('view-second'));
  second.setCurrentSheetIndex(1); // independent active sheet

  second.on('selectionChange', (sel) => console.log('view 2', sel));
  // second.destroy() when its window closes
});
```

`new Engine()` + `engine.mount(...)` still works for a single view — it
delegates to a lazily-created default session. Workbook-level events
(`ready`, `sheetChange`, `cellChange`) live on the `Engine`; per-view events
(`selectionChange`, `gridChange`, `activeSheetChange`, `startEdit`,
`invalidFormula`, `error`) live on each `Session`.

## API

### Components

- `Spreadsheet` - Main spreadsheet component
- `ColumnHeaders` - Column header component
- `RowHeaders` - Row header component
- `Selector` - Cell selection indicator
- `SheetTabs` - Sheet tab bar
- `Scrollbar` - Custom scrollbar
- `ContextMenu` - Right-click context menu

### Engine & Sessions

- `Engine` - Shared workbook layer (one worker / one workbook) and factory for views
- `Session` - A single view: its own mounted UI, active sheet, selection and viewport

### Services

- `DataService` - High-level API for spreadsheet operations
- `WorkbookClient` - Low-level workbook operations
- `OffscreenClient` - Canvas rendering operations

### Types

See the TypeScript definitions for full API documentation.

## License

MIT
