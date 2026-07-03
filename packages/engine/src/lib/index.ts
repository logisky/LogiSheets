// Main library exports
export {
  Spreadsheet,
  ColumnHeaders,
  RowHeaders,
  Selector,
  SheetTabs,
  Scrollbar,
  ContextMenu,
  // Utility functions
  match,
  xForColStart,
  xForColEnd,
  yForRowStart,
  yForRowEnd,
  getPosition,
  getSelectedCellRange,
  getSelectedRows,
  getSelectedColumns,
  getSelectedLines,
  findVisibleRowIdxRange,
  findVisibleColIdxRange,
  buildSelectedDataFromCell,
  buildSelectedDataFromCellRange,
  ptToPx,
  pxToPt,
  pxToWidth,
  simpleUuid,
} from "./components";

// Context menu types
export type {
  ContextMenuItem,
  ContextMenuContext,
  ContextMenuTarget,
} from "./components/contextMenuTypes";

// Client exports
export {
  DataService,
  WorkbookClient,
  OffscreenClient,
  WORKBOOK_LOAD_CANCELLED,
  isLoadCancelled,
} from "./clients";
export type { BeforeLoadWorkbook } from "./clients";

// Worker exports
export { WorkbookWorkerService, OffscreenWorkerService } from "./worker";

// Block management exports
export {
  BlockManager,
  EnumSetManager,
  FieldManager,
  LOGISHEETS_BUILTIN_CRAFT_ID,
  FIELD_AND_VALIDATION_TAG,
} from "./block";

export type { EnumInfo, EnumVariant, FieldInfo, FieldTypeEnum } from "./block";

// Re-export types
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
} from "$types/index";

// Re-export default config
export { DEFAULT_ENGINE_CONFIG } from "$types/index";

// Re-export Range and Cell classes (not just types)
export { Range as RangeClass, Cell as CellClass } from "$types/index";

// Engine class - main entry point
export { Engine, default as EngineDefault } from "./engine";
export type {
  EngineEventType,
  EngineEventMap,
  EngineMountOptions,
} from "./engine";

// Session class - per-view handle returned by engine.createSession()
export { Session, default as SessionDefault } from "./session";
export type {
  SessionEventType,
  SessionEventMap,
  SessionMountOptions,
  SessionHost,
} from "./session";

export type {
  SelectedData,
  Transaction,
  Payload,
  SheetInfo,
} from "logisheets-web";

// Re-export commonly used logisheets-web utilities
export {
  isErrorMessage,
  getFirstCell,
} from "logisheets-web";

// Framework adapters
export { convertCanvasPropsToAdapterProps } from "./adapters";

export type {
  SpreadsheetAdapterProps,
  CanvasAdapterProps,
  UseSpreadsheetConfig,
  UseSpreadsheetReturn,
} from "./adapters";
