/**
 * Type declarations for the main library exports.
 * This file provides types for consumers using the library from non-Svelte environments.
 */

import type { ComponentType, SvelteComponent } from "svelte";
import type { SelectedData, SheetInfo, CellLayout } from "logisheets-web";

import type { Grid, EngineConfig, CanvasProps } from "../types/index";

import type {
  ContextMenuItem,
  ContextMenuContext,
} from "./components/contextMenuTypes";

// ============================================================================
// Core Engine
// ============================================================================

export { Engine, default } from "./engine";
export type {
  EngineEventType,
  EngineEventMap,
  EngineMountOptions,
} from "./engine";

// ============================================================================
// Component Props Types
// ============================================================================

export interface SpreadsheetProps {
  selectedData?: SelectedData;
  activeSheet?: number;
  cellLayouts?: CellLayout[];
  config?: Partial<EngineConfig>;
  showSheetTabs?: boolean;
  showScrollbars?: boolean;
  contextMenuItems?: ContextMenuItem[];
  onSelectedDataChange?: (data: SelectedData) => void;
  onActiveSheetChange?: (sheet: number) => void;
  onGridChange?: (grid: Grid | null) => void;
  onSheetsChange?: (sheets: readonly SheetInfo[]) => void;
  onContextMenuItemClick?: (
    item: ContextMenuItem,
    context: ContextMenuContext | null,
  ) => void;
}

export interface ColumnHeadersProps {
  grid: Grid;
  leftTopWidth: number;
  leftTopHeight: number;
  selectedColumns?: [number, number];
}

export interface RowHeadersProps {
  grid: Grid;
  leftTopWidth: number;
  leftTopHeight: number;
  selectedRows?: [number, number];
}

export interface SelectorProps {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SheetTabsProps {
  sheets: readonly SheetInfo[];
  activeSheet: number;
  onSheetChange?: (index: number) => void;
}

export interface ScrollbarProps {
  orientation: "horizontal" | "vertical";
  documentSize: number;
  visibleSize: number;
  scrollPosition: number;
  onScroll?: (position: number) => void;
}

export interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  context: ContextMenuContext | null;
  onItemClick?: (
    item: ContextMenuItem,
    context: ContextMenuContext | null,
  ) => void;
  onClose?: () => void;
}

// ============================================================================
// Svelte Component Declarations
// ============================================================================

export const Spreadsheet: ComponentType<SvelteComponent<SpreadsheetProps>>;
export const ColumnHeaders: ComponentType<SvelteComponent<ColumnHeadersProps>>;
export const RowHeaders: ComponentType<SvelteComponent<RowHeadersProps>>;
export const Selector: ComponentType<SvelteComponent<SelectorProps>>;
export const SheetTabs: ComponentType<SvelteComponent<SheetTabsProps>>;
export const Scrollbar: ComponentType<SvelteComponent<ScrollbarProps>>;
export const ContextMenu: ComponentType<SvelteComponent<ContextMenuProps>>;

// ============================================================================
// Utility Functions
// ============================================================================

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
  ptToPx,
  pxToPt,
  pxToWidth,
  simpleUuid,
} from "./components/utils";

// ============================================================================
// Context Menu Types
// ============================================================================

export type {
  ContextMenuItem,
  ContextMenuContext,
} from "./components/contextMenuTypes";

// ============================================================================
// Client Exports
// ============================================================================

export { DataService, WorkbookClient, OffscreenClient } from "./clients";

// ============================================================================
// Worker Exports
// ============================================================================

export { WorkbookWorkerService, OffscreenWorkerService } from "./worker";
export type {
  WorkerUpdate,
  MethodName,
  OffscreenRenderName,
  Result,
  IWorkbookWorker,
  IOffscreenWorker,
  WorkerRequest,
  WorkerResponse,
  OffscreenRequest,
  OffscreenResponse,
} from "./worker/types";

// ============================================================================
// Block Management Exports
// ============================================================================

export {
  BlockManager,
  EnumSetManager,
  FieldManager,
  LOGISHEETS_BUILTIN_CRAFT_ID,
  FIELD_AND_VALIDATION_TAG,
} from "./block";

export type { EnumInfo, EnumVariant, FieldInfo, FieldTypeEnum } from "./block";

// ============================================================================
// Type Exports
// ============================================================================

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
} from "../types/index";

export {
  DEFAULT_ENGINE_CONFIG,
  Range as RangeClass,
  Cell as CellClass,
} from "../types/index";

// ============================================================================
// Re-exports from logisheets-web
// ============================================================================

export type {
  SelectedData,
  SelectedLines,
  SelectedCellRange,
  Transaction,
  Payload,
  SheetInfo,
  CellInfo,
  BlockInfo,
  MergeCell,
  SheetDimension,
  ErrorMessage,
} from "logisheets-web";

export {
  isErrorMessage,
  Transaction as TransactionClass,
  SetColWidthBuilder,
  SetRowHeightBuilder,
  CellInputBuilder,
  CellClearBuilder,
  CreateSheetBuilder,
  DeleteSheetBuilder,
  SheetRenameBuilder,
  InsertColsBuilder,
  InsertRowsBuilder,
  DeleteColsBuilder,
  DeleteRowsBuilder,
  getFirstCell,
  Cell as CellInstance,
} from "logisheets-web";

// ============================================================================
// Framework Adapters
// ============================================================================

export { convertCanvasPropsToAdapterProps } from "./adapters";

export type {
  SpreadsheetAdapterProps,
  CanvasAdapterProps,
  UseSpreadsheetConfig,
  UseSpreadsheetReturn,
} from "./adapters";
