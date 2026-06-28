# Embed the spreadsheet UI (`logisheets-engine`)

`logisheets-engine` is a ready-made, interactive spreadsheet UI. Where the
[core SDK](/usage) gives you a headless `Workbook` to script, the engine gives
you a rendered grid your users can click, scroll, select and edit.

It is built on top of `logisheets-web` and runs the WASM engine plus all
rendering inside a **Web Worker** (via `OffscreenCanvas`), so heavy work never
blocks the UI thread. The grid components are Svelte 5, but you never touch them
directly — you drive everything through a single `Engine` object, which makes it
usable from any framework.

```bash
npm install logisheets-engine logisheets-web
```

```ts
import {Engine} from 'logisheets-engine'
import 'logisheets-engine/style.css' // required — ships the grid styles
```

::: tip Runnable examples
Want working code to start from? The
[**logisheets-examples**](https://github.com/logisky/logisheets-examples/tree/main/logisheets-engine)
repo has minimal, runnable apps for **vanilla JS, React, Vue, Svelte and
Angular** — each embedding the engine together with the
[`logisheets-formula-editor`](https://www.npmjs.com/package/logisheets-formula-editor)
(a formula bar and in-cell editing with autocomplete). Clone it, then
`cd <framework> && npm install && npm run dev`.

The inline snippets below are distilled from those examples and the main
LogiSheets app (`src/core/engine/`, `src/components/engine-canvas/` in the
[LogiSheets repo](https://github.com/logisky/LogiSheets/tree/main/src)).
:::

## Lifecycle

You construct an `Engine` once, wait for `ready`, mount it into a DOM element,
and destroy it on teardown.

```ts
const engine = new Engine(/* config? */)
engine.on('ready', () => {
    engine.mount(document.getElementById('spreadsheet')!)
})
```

| Method | Signature | Description |
| --- | --- | --- |
| constructor | `new Engine(config?: Partial<EngineConfig>)` | Creates the engine and **its own Web Worker** (you never create a worker yourself). Worker + WASM init asynchronously — wait for the `ready` event before use. |
| `createSession` | `createSession(): Session` | Create an additional **view** of the same workbook. See [Multiple views](#multiple-views-sessions). |
| `getDefaultSession` | `getDefaultSession(): Session` | The primary `Session` that backs the legacy per-view methods below. Created lazily. |
| `mount` | `mount(container: HTMLElement, options?: EngineMountOptions): void` | Mounts the grid UI into `container` (on the default session). See [mount options](#mount-options). |
| `unmount` | `unmount(): void` | Detaches the grid UI but keeps the engine/worker alive (you can re-mount). |
| `isMounted` | `isMounted(): boolean` | Whether the UI is currently mounted. |
| `getMountContainer` | `getMountContainer(): HTMLElement \| null` | The element the grid is mounted into, if any. |
| `initOffscreen` | `initOffscreen(canvas: HTMLCanvasElement): Promise<void>` | Headless rendering into your own canvas, without mounting the interactive UI. Advanced; only needed for custom render pipelines. |
| `destroy` | `destroy(): void` | Tears down the worker and all components. Call when you're done with the engine. |
| `isReady` | `isReady(): boolean` | Whether the worker + WASM finished initializing. |

### Constructor config — `EngineConfig`

All fields are optional (pass a `Partial<EngineConfig>`); defaults come from
`DEFAULT_ENGINE_CONFIG`.

| Field | Type | Description |
| --- | --- | --- |
| `leftTopWidth` | `number` | Width of the left (row-number) header panel, in pixels. |
| `leftTopHeight` | `number` | Height of the top (column-letter) header panel, in pixels. |
| `showHorizontalGridLines` | `boolean` | Draw horizontal grid lines (default `true`). Toggle at runtime with [`setShowGridLines`](#display-settings). |
| `showVerticalGridLines` | `boolean` | Draw vertical grid lines (default `true`). Toggle at runtime with [`setShowGridLines`](#display-settings). |
| `defaultCellWidth` | `number` | Default column width, in points (pt). |
| `defaultCellHeight` | `number` | Default row height, in points (pt). |
| `scrollbarSize` | `number` | Scrollbar thickness, in pixels. |

## Mount options

Passed as the second argument to `mount()`. All optional.

| Option | Type | Description |
| --- | --- | --- |
| `showSheetTabs` | `boolean` | Render the sheet-tab bar at the bottom. Set `false` if you provide your own tabs. |
| `showScrollbars` | `boolean` | Render scrollbars. |
| `contextMenuItems` | `ContextMenuItem[]` | Items for the right-click context menu. See [ContextMenuItem](#contextmenuitem). |
| `cellLayouts` | `CellLayout[]` | Per-cell visual overrides (background, tooltip). See [CellLayout](#celllayout). |
| `getIsEditingFormula` | `() => boolean` | Return `true` while the user is editing a formula in your own input, so the canvas doesn't steal focus. |
| `onInvalidFormula` | `() => void` | Called when the user commits an invalid formula. |

```ts
engine.mount(container, {
    showSheetTabs: false, // app renders its own tabs
    showScrollbars: true,
    cellLayouts,
    getIsEditingFormula: () => isEditingFormulaRef.current(),
})
```

## Events

Subscribe with `on(type, cb)` and unsubscribe with `off(type, cb)`. The payload
type is determined by the event:

| Event | Payload | Fires when |
| --- | --- | --- |
| `ready` | `void` | Worker + WASM finished initializing. Subscribe before doing anything else. |
| `gridChange` | `Grid \| null` | The visible grid changed (scroll, edit, sheet switch, load) and should be re-rendered. |
| `selectionChange` | `SelectedData` | The user changed the selection (cell, range, row/col). |
| `activeSheetChange` | `number` | The active sheet index changed. |
| `sheetChange` | `readonly SheetInfo[]` | The list of sheets changed (add/remove/rename). |
| `startEdit` | `{row: number; col: number; initialText: string}` | The user began editing a cell — open your editor at `(row, col)` seeded with `initialText`. |
| `cellChange` | `void` | A cell value changed. |
| `invalidFormula` | `void` | An invalid formula was entered. |
| `error` | `Error` | An internal error occurred. |

```ts
engine.on('selectionChange', (data) => setSelection(data))
engine.on('gridChange', (grid) => setGrid(grid))
engine.on('startEdit', ({row, col, initialText}) => openEditor(row, col, initialText))
```

## Reading and pushing state

The engine caches the current grid/selection/sheet so you can read them
synchronously, and lets you push state back in imperatively.

| Method | Signature | Description |
| --- | --- | --- |
| `getGrid` | `getGrid(): Grid \| null` | The currently rendered grid. |
| `getSelection` | `getSelection(): SelectedData` | Current selection. |
| `setSelection` | `setSelection(selection: SelectedData): void` | Move the selection programmatically. |
| `getCurrentSheetIndex` | `getCurrentSheetIndex(): number` | Active sheet index. |
| `setCurrentSheetIndex` | `setCurrentSheetIndex(index: number): void` | Switch the active sheet (refreshes the grid). |
| `getSheets` | `getSheets(): readonly SheetInfo[]` | Cached sheet info. |
| `getConfig` | `getConfig(): EngineConfig` | The resolved configuration. |

## Multiple views (Sessions)

By default you have one view, and the legacy `mount` / `setSelection` /
`render` / `setCurrentSheetIndex` methods on `Engine` operate on it. Under the
hood that view is a **`Session`** — and you can create more of them to show the
**same workbook in several windows at once** (a split pane, a "second view", a
pop-out). All sessions share the engine's single worker and workbook, so an edit
in one is reflected in every other immediately.

The split of responsibility:

- **`Engine`** — everything *shared*: the worker, the workbook, the sheet-info
  cache, and the workbook-level events (`ready`, `sheetChange`, `cellChange`).
  One engine per workbook.
- **`Session`** — everything *per view*: its mounted UI, active sheet,
  selection, rendered grid and viewport. Each session renders to its own
  `OffscreenCanvas` in the shared worker, so views scroll independently and can
  even display different sheets.

```ts
const engine = new Engine()
engine.on('ready', async () => {
    await engine.loadFile(bytes, 'book.xlsx') // load once, on the engine

    // First view.
    const main = engine.createSession()
    main.mount(document.getElementById('view-main')!)

    // Second view of the SAME workbook — edits sync both ways.
    const second = engine.createSession()
    second.mount(document.getElementById('view-second')!)
    second.setCurrentSheetIndex(1) // independent active sheet

    second.on('selectionChange', (sel) => console.log('view 2', sel))

    // When the second window closes:
    second.destroy() // unmounts and frees its canvas in the worker
})
```

::: tip Backwards compatible
You don't need sessions for a single view. `new Engine()` + `engine.mount(...)`
keeps working exactly as before — those calls delegate to a lazily-created
default (primary) session. Reach for `createSession()` only when you want more
than one view.
:::

### `Session` methods

A `Session` carries the same per-view surface the legacy `Engine` methods
delegate to:

| Method | Signature | Description |
| --- | --- | --- |
| `mount` / `unmount` | `(container, options?)` / `()` | Render / remove this view's UI. Same [mount options](#mount-options) as the engine. |
| `isMounted` / `getMountContainer` | `(): boolean` / `(): HTMLElement \| null` | Mount state. |
| `initOffscreen` | `(canvas: HTMLCanvasElement): Promise<void>` | Headless rendering without a mounted UI. |
| `render` / `resize` | `(…) => Promise<Grid \| null>` | Manual render / canvas resize (usually automatic while mounted). |
| `getGrid` | `(): Grid \| null` | This view's last rendered grid. |
| `getSelection` / `setSelection` | `(…)` | Read / set this view's selection. |
| `getCurrentSheetIndex` / `setCurrentSheetIndex` | `(…)` | Read / switch **this view's** active sheet. |
| `getSheets` | `(): readonly SheetInfo[]` | Shared sheet list. |
| `getConfig` | `(): EngineConfig` | Resolved configuration. |
| `on` / `off` | `(type, cb)` | Per-view events: `selectionChange`, `gridChange`, `activeSheetChange`, `startEdit`, `invalidFormula`, `error`. |
| `destroy` | `(): void` | Unmount and release this session from the engine. |

Workbook-level events (`ready`, `sheetChange`, `cellChange`) stay on the
`Engine` — subscribe to those once, no matter how many views you open.

## Loading, saving and rendering

| Method | Signature | Description |
| --- | --- | --- |
| `loadFile` | `loadFile(buffer: Uint8Array, filename: string): Promise<Grid \| null>` | Load `.xlsx` bytes **and** refresh the mounted grid. Prefer this over `DataService.loadWorkbook` when the UI is mounted — it also updates the Svelte component's dimensions/anchors. |
| `render` | `render(anchorX?: number, anchorY?: number): Promise<Grid \| null>` | Force a render at a scroll anchor. Usually automatic while mounted. |
| `resize` | `resize(width: number, height: number): Promise<Grid \| null>` | Resize the canvas. Usually automatic while mounted. |

```ts
const buf = await fetch('workbook.xlsx').then((r) => r.arrayBuffer())
const grid = await engine.loadFile(new Uint8Array(buf), 'workbook.xlsx')

// save
const result = await engine.getWorkbook().save({}) // result.data: Uint8Array
```

## Display settings

Runtime display options that change how the grid is painted. They update the
shared config and re-render every mounted view of the workbook.

| Method | Signature | Description |
| --- | --- | --- |
| `setShowGridLines` | `setShowGridLines(show: boolean): Promise<void>` | Show or hide the default cell grid lines across all views. Sets both `showHorizontalGridLines` and `showVerticalGridLines`. |

```ts
// e.g. wired to a "Show gridlines" toggle in your toolbar
await engine.setShowGridLines(false) // hide; pass true to show again
```

The initial value comes from [`EngineConfig`](#constructor-config-engineconfig)
(`showHorizontalGridLines` / `showVerticalGridLines`, both `true` by default).

## Editing data — `DataService`

`engine.getDataService()` is the high-level service for edits and rendering. It
speaks the same [transaction / payload](/usage#editing-transactions-and-payloads)
model as the core SDK, but every call is async (the work runs in the worker).
Most methods return `Promise<T | ErrorMessage>` — check with `isErrorMessage()`.

| Method | Signature | Description |
| --- | --- | --- |
| `handleTransaction` | `handleTransaction(tx: Transaction, temp?: boolean): Promise<void \| ErrorMessage>` | Apply a transaction of payloads. `temp: true` previews without committing to history. |
| `handleTransactionAndAdjustRowHeights` | `(tx, onlyIncrease?, fromRowIdx?, toRowIdx?): Promise<void \| ErrorMessage>` | Apply a transaction and auto-fit row heights in the given range. |
| `checkFormula` | `checkFormula(formula: string): Promise<boolean>` | Validate a formula's syntax. |
| `undo` / `redo` | `(): Promise<void \| ErrorMessage>` | Undo / redo the last undoable transaction. |
| `render` | `render(sheetId: number, anchorX: number, anchorY: number): Promise<Grid \| ErrorMessage>` | Render a sheet at a scroll anchor. |
| `resize` | `resize(width: number, height: number, dpr: number): Promise<Grid \| ErrorMessage>` | Resize and re-render. `dpr` is the device pixel ratio. |
| `loadWorkbook` | `loadWorkbook(buf: Uint8Array, name: string): Promise<Grid \| ErrorMessage>` | Load `.xlsx` (worker side only — prefer `engine.loadFile` while mounted). |
| `initOffscreen` | `initOffscreen(canvas: OffscreenCanvas): Promise<void \| ErrorMessage>` | Bind an offscreen canvas for rendering. |
| `setShowGridLines` | `setShowGridLines(horizontal: boolean, vertical: boolean): void` | Show/hide grid lines (worker-global). Prefer `engine.setShowGridLines`, which also re-renders. |
| `getCurrentSheetIdx` | `(): number` | Active sheet index. |
| `setCurrentSheetIdx` | `(idx: number): void` | Set the active sheet. |
| `getCurrentSheetId` | `(): number` | Stable id of the active sheet. |
| `getCurrentSheetName` | `(): string` | Name of the active sheet. |
| `getCacheAllSheetInfo` | `(): readonly SheetInfo[]` | Cached sheet info (sync). |
| `getSheetDimension` | `(sheetIdx: number): Promise<SheetDimension \| ErrorMessage>` | Max row/col and total height/width. |
| `getCellInfo` | `(sheetIdx, row, col): Promise<Cell \| ErrorMessage>` | Full cell (value + style + formula). |
| `getMergedCells` | `(sheetIdx, startRow, startCol, endRow, endCol): Promise<readonly MergeCell[] \| ErrorMessage>` | Merged ranges intersecting the region. |
| `getAvailableBlockId` | `(sheetIdx: number): Promise<number \| ErrorMessage>` | Allocate a fresh block id (for crafts). |
| `getWorkbook` | `(): WorkbookClient` | The full workbook client (below). |
| `registerCellUpdatedCallback` | `(f: () => void, callbackId?: number): void` | Fire on any cell update. |
| `registerSheetUpdatedCallback` | `(f: () => void): void` | Fire when sheets change. |
| `registerHeaderUpdatedCallback` | `(f: (sheetIdxes: readonly number[]) => void): void` | Fire when headers of the given sheets change. |

```ts
import {CellInputBuilder, tx, type Payload} from 'logisheets-engine'

const dataSvc = engine.getDataService()

const payload: Payload = {
    type: 'cellInput',
    value: new CellInputBuilder()
        .sheetIdx(dataSvc.getCurrentSheetIdx())
        .row(row)
        .col(col)
        .content(newText)
        .build(),
}

await dataSvc.handleTransaction(tx([payload], /* undoable */ true))
await dataSvc.checkFormula('=SUM(A1:A10)')
```

::: tip
`logisheets-engine` re-exports everything from `logisheets-web`, so payload
types, builders and bindings are imported from the same place.
:::

## Full workbook API — `WorkbookClient`

`engine.getWorkbook()` exposes the complete [workbook API](/usage) — the same
surface as `logisheets-web`, but Promise-based and running in the worker. Use it
when `DataService` doesn't have what you need. Selected methods:

| Method | Signature | Description |
| --- | --- | --- |
| `loadWorkbook` | `({content: Uint8Array; name: string}): Promise<void>` | Load `.xlsx`. |
| `save` | `({appData?: string}): Promise<{data: Uint8Array; ...}>` | Export to `.xlsx`; `appData` persists custom JSON. |
| `getAllSheetInfo` | `(): Promise<readonly SheetInfo[]>` | All sheets. |
| `getSheetDimension` | `(sheetIdx: number): Promise<SheetDimension>` | Sheet bounds. |
| `getSheetIdx` / `getSheetId` | `({sheetId})` / `({sheetIdx})` | Convert between sheet idx and stable id. |
| `getSheetNameByIdx` | `(idx: number): Promise<string>` | Sheet name. |
| `getCell` | `({sheetIdx, row, col}): Promise<CellInfo>` | One cell. |
| `getCells` | `({sheetIdx, ...range}): Promise<...>` | A cell range. |
| `getCellPosition` | `({sheetIdx, row, col}): Promise<...>` | Pixel position of a cell. |
| `getCellId` | `({sheetIdx, row, col}): Promise<SheetCellId>` | Stable id for a cell. |
| `batchGetCellInfoById` | `(...)` | Resolve many cells by id at once. |
| `getNextVisibleCell` | `(...)` | Skip hidden rows/cols when navigating. |
| `getMergedCells` | `({sheetIdx, ...range}): Promise<readonly MergeCell[]>` | Merged ranges. |
| `getBlockInfo` | `({sheetId, blockId}): Promise<BlockInfo>` | Block metadata. |
| `getFullyCoveredBlocks` | `(...)` | Blocks fully inside a region. |
| `getAvailableBlockId` | `({sheetIdx}): Promise<number>` | New block id. |
| `getCellIdByBlockRef` | `(...)` | Resolve a cell from a block + key + field. |
| `getAllBlockFields` | `(): Promise<readonly BlockField[]>` | All block fields. |
| `handleTransaction` | `({transaction, temp}): Promise<void>` | Apply edits. |
| `handleTransactionWithoutEvents` | `(...)` | Apply edits without firing update callbacks. |
| `undo` / `redo` | `(): Promise<void>` | History. |
| `commitTempStatus` / `cleanTempStatus` | `(): Promise<void>` | Commit or discard a temp (preview) transaction. |
| `getTempStatusChanges` | `(): Promise<TempStatusDiff>` | Pending temp changes. |
| `checkFormula` | `({formula}): Promise<boolean>` | Validate a formula. |
| `getDisplayUnitsOfFormula` | `(f: string): Promise<FormulaDisplayInfo>` | Tokenized formula for display/highlighting. |
| `getAppData` | `(): Promise<readonly AppData[]>` | Custom workbook metadata. |
| `getShadowCellId` / `getShadowInfoById` | `(...)` | Shadow (off-grid) cells. |
| `registerCellUpdatedCallback` | `(f, callbackId?): void` | Fire on cell updates. |
| `registerSheetUpdatedCallback` | `(f): void` | Fire on sheet changes. |
| `registerHeaderUpdatedCallback` | `(f): void` | Fire on header changes. |
| `registerCellValueChangedCallback` | `(...)` | Watch a specific cell. |
| `registerCellValueChangedByCellId` | `(...)` | Watch a specific cell by stable id. |

## Blocks & crafts — `BlockManager`

`engine.getBlockManager()` is the entry point for craft/structured-data state.
It holds two sub-managers:

- **`fieldManager`** (`FieldManager`) — create/query/update/delete the named
  *fields* of a block: `create`, `get`, `getByBlock`, `getBySheet`, `getAll`,
  `update`, `setBlockRefName`, `delete`, `deleteBlock`, `deleteSheet`,
  `search`, `count`.
- **`enumSetManager`** (`EnumSetManager`) — manage reusable enum value sets:
  `set`, `get`, `getAll`, `update`, `addVariant`, `removeVariant`, `delete`,
  `search`, `count`.

It also serializes craft state alongside the workbook:

- `getPersistentData(): string` — serialize fields/enums to embed via `save`.
- `parseAppData(data: string): void` — restore them after `loadFile`.

This is an advanced area tied to the [craft system](/craft/craft); reach for it
only when building structured data regions.

## Supporting types

### `Grid`

What a render returns and what `gridChange` carries — the visible viewport:

```ts
interface Grid {
    anchorX: number
    anchorY: number
    subOffsetX: number // pixels the first visible col is scrolled past the canvas left
    subOffsetY: number // pixels the first visible row is scrolled past the canvas top
    rows: readonly {idx: number; height: number}[]
    columns: readonly {idx: number; width: number}[]
    mergeCells?: readonly MergeCell[]
    blockInfos?: readonly BlockDisplayInfo[]
    preRowHeight?: number
    preColWidth?: number
    nextRowHeight?: number
    nextColWidth?: number
}
```

### `SelectedData`

```ts
interface SelectedData {
    data?:
        | {ty: 'line'; d: {start: number; end: number; type: 'row' | 'col'}}
        | {ty: 'cellRange'; d: {startRow; endRow; startCol; endCol}}
    source: 'editbar' | 'none'
}
```

Helpers are exported to build/read it: `buildSelectedDataFromCell`,
`buildSelectedDataFromCellRange`, `getSelectedCellRange`, `getSelectedLines`,
`getSelectedRows`, `getSelectedColumns`.

### `CellLayout`

Per-cell visual override passed via the `cellLayouts` mount option:

```ts
interface CellLayout {
    sheetIdx: number
    row: number
    col: number
    background?: string // CSS color
    tooltip?: string
}
```

### `ContextMenuItem`

```ts
interface ContextMenuItem {
    id: string
    label: string
    icon?: string          // emoji or text
    disabled?: boolean
    separator?: boolean     // show a divider after this item
    shortcut?: string       // display-only hint
    children?: ContextMenuItem[]
}
```

The click handler receives a `ContextMenuContext`: `{selectedData, target:
'cell' | 'row' | 'column', row?, col?, event: MouseEvent}`.

## Using with a framework

The engine is **framework-agnostic**. It renders into a plain DOM element via
`engine.mount(el)`, so there is no per-framework component to install and no
React/Vue/Angular peer dependency. Your framework only owns the *lifecycle* —
create the engine, mount on attach, tear down on unmount — and everything else
is the same `Engine` API everywhere.

The recipe is always the same:

1. Construct **one** `Engine` (it spins up its own Web Worker — keep it in a
   module/store/context, don't recreate it on every render).
2. Wait for the `ready` event — the worker + WASM initialize asynchronously.
3. `mount(element, options)` into a **sized** container (give it `width`/`height`).
4. Subscribe to events (`gridChange`, `selectionChange`, …) and drive edits
   through `getDataService()` / `getWorkbook()`.
5. On teardown: `unmount()` (the engine stays alive and re-mountable); call
   `destroy()` when you're done with it for good (terminates the worker).

A small "mount once ready" helper captures step 2–3 (handles the case where the
engine is already ready, since `ready` won't fire again):

```ts
import type {Engine} from 'logisheets-engine'

export function mountWhenReady(engine: Engine, el: HTMLElement) {
    const run = () => engine.mount(el, {showSheetTabs: true, showScrollbars: true})
    engine.isReady() ? run() : engine.on('ready', run)
}
```

::: tip Full runnable versions
The snippets below are intentionally minimal. For complete, runnable apps for
each framework — wired up with the [formula editor](#formula-editor-logisheets-formula-editor)
and the required bundler config — see the
[**logisheets-examples**](https://github.com/logisky/logisheets-examples/tree/main/logisheets-engine)
repo.
:::

::: warning Bundler config
`logisheets-engine` ships as a pre-built ES module that spawns a Web Worker and
loads WASM (both **inlined** into the bundle — no asset copying needed). Tell
your bundler not to re-process it:

- **Vite** — exclude it from dependency pre-bundling, or the worker/WASM URLs break:
  ```ts
  // vite.config.ts
  export default defineConfig({optimizeDeps: {exclude: ['logisheets-engine']}})
  ```
- **Angular** — the bundle is large; raise the build budgets in `angular.json`
  and keep the `zone.js` polyfill. No worker/WASM config is needed.
:::

### React

```tsx
import {useEffect, useRef} from 'react'
import {Engine, type Grid} from 'logisheets-engine'
import 'logisheets-engine/style.css'

// Created once at module scope so it survives re-renders. In a real app you'd
// usually hold it in a context/store (the LogiSheets app uses `initEngine()` +
// an `EngineProvider`, see `src/core/engine/`).
const engine = new Engine()

export function Spreadsheet() {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const onReady = () => engine.mount(ref.current!, {showSheetTabs: true})
        engine.isReady() ? onReady() : engine.on('ready', onReady)

        const onGrid = (_g: Grid | null) => {
            /* react to each render, e.g. update overlays */
        }
        engine.on('gridChange', onGrid)

        return () => {
            engine.off('gridChange', onGrid)
            engine.unmount() // keep `engine` alive for the next mount
        }
    }, [])

    return <div ref={ref} style={{width: '100%', height: '100%'}} />
}
```

### Vue 3

```vue
<script setup lang="ts">
import {onMounted, onBeforeUnmount, ref} from 'vue'
import {Engine} from 'logisheets-engine'
import 'logisheets-engine/style.css'

const host = ref<HTMLDivElement>()
const engine = new Engine()

onMounted(() => {
    const mount = () => engine.mount(host.value!, {showSheetTabs: true})
    engine.isReady() ? mount() : engine.on('ready', mount)
})
onBeforeUnmount(() => engine.destroy())
</script>

<template>
    <div ref="host" style="width: 100%; height: 100%" />
</template>
```

### Svelte

```svelte
<script lang="ts">
import {onMount, onDestroy} from 'svelte'
import {Engine} from 'logisheets-engine'
import 'logisheets-engine/style.css'

let host: HTMLDivElement
const engine = new Engine()

onMount(() => {
    const mount = () => engine.mount(host, {showSheetTabs: true})
    engine.isReady() ? mount() : engine.on('ready', mount)
})
onDestroy(() => engine.destroy())
</script>

<div bind:this={host} style="width: 100%; height: 100%"></div>
```

### Angular

```ts
import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core'
import {Engine} from 'logisheets-engine'
import 'logisheets-engine/style.css'

@Component({
    selector: 'app-spreadsheet',
    template: `<div #host style="width:100%;height:100%"></div>`,
})
export class SpreadsheetComponent implements AfterViewInit, OnDestroy {
    @ViewChild('host', {static: true}) host!: ElementRef<HTMLDivElement>
    private engine = new Engine()

    ngAfterViewInit() {
        const mount = () => this.engine.mount(this.host.nativeElement, {showSheetTabs: true})
        this.engine.isReady() ? mount() : this.engine.on('ready', mount)
    }
    ngOnDestroy() {
        this.engine.destroy()
    }
}
```

### Vanilla JS / `<script>` tag

As an ES module (with a bundler):

```ts
import {Engine} from 'logisheets-engine'
import 'logisheets-engine/style.css'

const engine = new Engine()
engine.on('ready', () => engine.mount(document.getElementById('app')!))
```

Or via the UMD build with no bundler — the whole API hangs off the
`LogiSheetsEngine` global:

```html
<link rel="stylesheet" href="logisheets-engine.css" />
<script src="logisheets-engine.umd.js"></script>
<script>
  const engine = new LogiSheetsEngine.Engine()
  engine.on('ready', () => engine.mount(document.getElementById('app')))
</script>
```

::: warning Common gotchas
- **Size the container.** The grid fills its host element; a `<div>` with no
  height renders nothing.
- **One engine, mount/unmount many times.** Don't `new Engine()` on every
  render — reuse the instance and `destroy()` only on final teardown.
- **Strict / double-invoked effects** (React 18 dev, etc.): `mount()` warns if
  already mounted. Pair every `mount` with an `unmount` in the cleanup, as above.
:::

### Advanced: custom layouts

For fully custom layouts you can import the raw Svelte components directly —
`Spreadsheet`, `ColumnHeaders`, `RowHeaders`, `Selector`, `SheetTabs`,
`Scrollbar`, `ContextMenu` — and compose them yourself instead of using
`mount()`. The `adapters` module additionally exports React-oriented **prop
types** (`SpreadsheetAdapterProps`, `CanvasAdapterProps`) and a
`convertCanvasPropsToAdapterProps` helper for teams writing their own React
wrapper; these are type-level conveniences, not a shipped React component.

## Formula editor (`logisheets-formula-editor`)

The engine renders the grid but does **not** ship a formula bar or an in-cell
editor — it only emits `startEdit` and lets you read/write cells. The companion
package [`logisheets-formula-editor`](https://www.npmjs.com/package/logisheets-formula-editor)
provides both, built on CodeMirror 6 with function autocomplete, signature help
and cell-reference highlighting.

```bash
npm install logisheets-formula-editor
```

It is framework-agnostic, with entry points for each use:

| Import | What it is |
| --- | --- |
| `logisheets-formula-editor` | React `<FormulaEditor>` component (thin wrapper over `/core`). |
| `logisheets-formula-editor/core` | `createFormulaEditor(el, opts)` — the vanilla editor, no framework. |
| `logisheets-formula-editor/engine` | `createEngineFormulaSource(dataService)` — one-call wiring from the engine. |
| `logisheets-formula-editor/inline` | `createInlineCellEditor(opts)` — the in-cell editor controller. |

Styles are injected at runtime, so there is no stylesheet to import.

### Wiring it to the engine

`createEngineFormulaSource` turns `engine.getDataService()` into the tokenizer +
function list the editor needs. Spread the result into either editor.

**Formula bar** (vanilla `/core`; the React `<FormulaEditor>` takes the same props):

```ts
import {createFormulaEditor} from 'logisheets-formula-editor/core'
import {createEngineFormulaSource} from 'logisheets-formula-editor/engine'

const source = createEngineFormulaSource(engine.getDataService())
const bar = createFormulaEditor(document.getElementById('formula-bar')!, {
    ...source,
    onSubmit: (value) => {
        const sel = engine.getSelection()
        if (sel.data?.ty !== 'cellRange') return
        const {startRow, startCol} = sel.data.d
        // commit — see "Editing data" above
        engine.getWorkbook().handleTransaction({
            transaction: {
                payloads: [{type: 'cellInput', value: {sheetIdx: engine.getCurrentSheetIndex(), row: startRow, col: startCol, content: value}}],
                undoable: true,
                temp: false,
            },
            temp: false,
        })
    },
})
// keep the bar showing the selected cell
engine.on('selectionChange', async (sel) => {
    if (sel.data?.ty !== 'cellRange') return
    const {startRow, startCol} = sel.data.d
    const cell = await engine.getDataService().getCellInfo(engine.getCurrentSheetIndex(), startRow, startCol)
    if (!isErrorMessage(cell)) bar.setValue(cell.getFormula() ? `=${cell.getFormula()}` : cell.getText())
})
```

**In-cell editor** — the controller listens for the engine's `startEdit`,
positions an editor over the target cell, commits, and paints reference
highlights. Keep it in sync with `gridChange`:

```ts
import {createInlineCellEditor} from 'logisheets-formula-editor/inline'

const inline = createInlineCellEditor({
    container: gridEl, // the same element you mounted the engine into
    eventSource: engine, // the Engine (or a Session) emitting startEdit
    dataService: engine.getDataService(),
    sheetIdx: engine.getCurrentSheetIndex(),
    getSheetName: () => engine.getSheets()[engine.getCurrentSheetIndex()]?.name ?? '',
    inputCell: (sheetIdx, row, col, text) => engine.getWorkbook().handleTransaction({
        transaction: {payloads: [{type: 'cellInput', value: {sheetIdx, row, col, content: text}}], undoable: true, temp: false},
        temp: false,
    }),
    setSelection: (sel) => engine.setSelection(sel),
    grid: engine.getGrid(),
})
engine.on('gridChange', (g) => inline.setGrid(g))
```

For full, runnable wiring in every framework, see the
[**logisheets-examples**](https://github.com/logisky/logisheets-examples/tree/main/logisheets-engine)
repo.
