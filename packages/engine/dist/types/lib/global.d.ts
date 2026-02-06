/**
 * LogiSheets Engine - Global entry point
 *
 * This file exposes the entire engine API to the global `window.LogiSheetsEngine` object.
 * It can be used in any framework or vanilla JavaScript.
 *
 * Usage in browser:
 * ```html
 * <script src="logisheets-engine.umd.js"></script>
 * <script>
 *   const engine = new LogiSheetsEngine.Engine();
 *   await engine.init(document.getElementById('canvas'));
 * </script>
 * ```
 *
 * Usage as ES module:
 * ```javascript
 * import { Engine, Transaction, CellInputBuilder } from 'logisheets-engine';
 * const engine = new Engine();
 * ```
 */
export { Engine, default } from "./engine";
export type { EngineEventType, EngineEventMap } from "./engine";
export type { License, LicenseStatus } from "./license";
export { DataService, WorkbookClient, OffscreenClient } from "./clients";
export { WorkbookWorkerService, OffscreenWorkerService } from "./worker";
export { BlockManager, EnumSetManager, FieldManager, LOGISHEETS_BUILTIN_CRAFT_ID, FIELD_AND_VALIDATION_TAG, } from "./block";
export type { EnumInfo, EnumVariant, FieldInfo, FieldTypeEnum } from "./block";
export type { Grid, Row, Column, Range, Cell, SelectorStyle, CellLayout, CanvasProps, EngineConfig, } from "$types/index";
export { DEFAULT_ENGINE_CONFIG, Range as RangeClass, Cell as CellClass, } from "$types/index";
export * from "logisheets-web";
export { match, xForColStart, xForColEnd, yForRowStart, yForRowEnd, getPosition, getSelectedCellRange, getSelectedLines, getSelectedRows, getSelectedColumns, findVisibleRowIdxRange, findVisibleColIdxRange, buildSelectedDataFromCell, buildSelectedDataFromCellRange, buildSelectedDataFromLines, getReferenceString, ptToPx, pxToPt, pxToWidth, simpleUuid, } from "./components/utils";
export type { ContextMenuItem, ContextMenuContext, } from "./components/contextMenuTypes";
export { convertCanvasPropsToAdapterProps } from "./adapters";
export type { SpreadsheetAdapterProps, CanvasAdapterProps, UseSpreadsheetConfig, UseSpreadsheetReturn, } from "./adapters";
export { Spreadsheet, ColumnHeaders, RowHeaders, Selector, SheetTabs, Scrollbar, ContextMenu, } from "./components";
