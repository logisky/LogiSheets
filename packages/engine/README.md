# LogiSheets Engine

A high-performance spreadsheet rendering and editing library built with Svelte 5 and Web Workers.

## Features

- 🚀 High-performance canvas rendering with OffscreenCanvas
- 🔄 Web Worker architecture for non-blocking operations
- 📊 Full spreadsheet functionality (selection, editing, formulas)
- 🎨 Customizable cell layouts and styling
- 📱 Responsive scrollbars and touch support
- 🔌 Works with logisheets-web WASM engine

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

## API

### Components

- `Spreadsheet` - Main spreadsheet component
- `ColumnHeaders` - Column header component
- `RowHeaders` - Row header component
- `Selector` - Cell selection indicator
- `SheetTabs` - Sheet tab bar
- `Scrollbar` - Custom scrollbar
- `ContextMenu` - Right-click context menu

### Services

- `DataService` - High-level API for spreadsheet operations
- `WorkbookClient` - Low-level workbook operations
- `OffscreenClient` - Canvas rendering operations

### Types

See the TypeScript definitions for full API documentation.

## License

MIT
