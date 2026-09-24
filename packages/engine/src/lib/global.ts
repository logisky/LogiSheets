/**
 * logisheets-engine — embeddable, canvas-rendered spreadsheet UI.
 *
 * This is the package's real build entry (vite.config.lib.ts `lib.entry`,
 * package.json `types` → dist/types/lib/global.d.ts). The UMD build also
 * exposes it as `window.LogiSheetsEngine`. `./index.ts` is an older, partly
 * overlapping export list that the build does not use.
 *
 * Main exports:
 * - {@link Engine} — one per workbook. Owns the Web Worker (Rust/WASM engine
 *   + OffscreenCanvas painter), the shared sheet-info cache and workbook
 *   events. Hands out per-view {@link Session}s; the legacy
 *   `engine.mount()`/`render()`/… methods drive a lazily-created default one.
 * - {@link Session} — one on-screen view: mounted Svelte UI, active sheet,
 *   selection, viewport.
 * - `engine.getWorkbook()` → {@link WorkbookClient}, the full logisheets-web
 *   workbook API proxied to the worker. Everything in `logisheets-web` is
 *   re-exported below, so hosts need not depend on it directly.
 * - Geometry/selection helpers from components/utils, block managers,
 *   Svelte components (for Svelte hosts) and adapter prop types.
 *
 * Sibling packages: `logisheets-web` supplies the WASM bindings and payload
 * types (bundled in, not a peer); `logisheets-formula-editor` is the formula
 * input a host typically pairs with the `startEdit` event. The engine renders
 * no toolbar, edit bar or context menu — the host builds those on top.
 *
 * Usage:
 * ```javascript
 * import {Engine} from 'logisheets-engine'
 * import 'logisheets-engine/style.css'
 * const engine = new Engine()
 * engine.on('ready', async () => {
 *     engine.mount(document.getElementById('sheet'))
 *     await engine.loadFile(bytes, 'book.xlsx')
 * })
 * ```
 * The legacy Engine methods that touch the workbook (loadFile, render,
 * resize, setCurrentSheetIndex, insertChart, updateChart) throw until
 * `ready` has fired. UMD consumers must provide `echarts` as a
 * global (it is external to the bundle).
 */

// Core Engine
export {Engine, default} from './engine'
export type {EngineEventType, EngineEventMap} from './engine'

// Per-view session (engine.createSession())
export {Session} from './session'
export type {
    SessionEventType,
    SessionEventMap,
    SessionMountOptions,
} from './session'

// Client exports (for advanced usage)
export {DataService, WorkbookClient, OffscreenClient} from './clients'

// Worker exports
export {WorkbookWorkerService, OffscreenWorkerService} from './worker'

// Block management
export {
    BlockManager,
    EnumSetManager,
    FieldManager,
    LOGISHEETS_BUILTIN_CRAFT_ID,
    FIELD_AND_VALIDATION_TAG,
} from './block'

export type {EnumInfo, EnumVariant, FieldInfo, FieldTypeEnum} from './block'

// Types
export type {
    Grid,
    Row,
    Column,
    Range,
    Cell,
    SelectorStyle,
    CellLayout,
    CanvasProps,
    EngineConfig,
    ZoomOrigin,
} from '$types/index'

export {
    DEFAULT_ENGINE_CONFIG,
    Range as RangeClass,
    Cell as CellClass,
} from '$types/index'

// Re-export everything from logisheets-web
export * from 'logisheets-web'

// Utility functions
export {
    match,
    xForColStart,
    xForColEnd,
    yForRowStart,
    yForRowEnd,
    getPosition,
    getSelectedCellRange,
    getSelectedLines,
    getSelectedRows,
    getSelectedColumns,
    findVisibleRowIdxRange,
    findVisibleColIdxRange,
    buildSelectedDataFromCell,
    buildSelectedDataFromCellRange,
    buildSelectedDataFromLines,
    getReferenceString,
    quoteSheetName,
    qualifyReference,
    getCellRect,
    isCellInGridWindow,
    getReferenceHighlightRects,
    ptToPx,
    pxToPt,
    pxToWidth,
    simpleUuid,
} from './components/utils'

export type {CellRect, HighlightRect, FormulaCellRef} from './components/utils'

// Context menu types
export type {
    ContextMenuItem,
    ContextMenuContext,
} from './components/contextMenuTypes'

// Framework adapters
export {convertCanvasPropsToAdapterProps} from './adapters'

export type {
    SpreadsheetAdapterProps,
    CanvasAdapterProps,
    UseSpreadsheetConfig,
    UseSpreadsheetReturn,
} from './adapters'

// Svelte components (for Svelte users)
export {
    Spreadsheet,
    ColumnHeaders,
    RowHeaders,
    Selector,
    SheetTabs,
    Scrollbar,
    ContextMenu,
} from './components'
