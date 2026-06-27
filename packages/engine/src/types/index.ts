/**
 * Core types for the LogiSheets engine.
 * This file contains all the interfaces that the engine interacts with externally.
 */

import type {
  BlockDisplayInfo,
  CellInfo,
  CellRef,
  FormulaDisplayInfo,
  MergeCell,
  SelectedData,
  SheetInfo,
  CellLayout,
} from "logisheets-web";

// ============================================================================
// Grid Types - Used for rendering the spreadsheet
// ============================================================================

export interface Row {
  height: number;
  idx: number;
}

export interface Column {
  width: number;
  idx: number;
}

export interface Grid {
  anchorX: number;
  anchorY: number;
  /**
   * Pixels by which the first visible row/column is scrolled past the canvas
   * top/left. `anchorY - firstVisibleRow.position.startRow`. Overlay helpers
   * subtract these so positions stay in canvas-pixel space.
   */
  subOffsetX: number;
  subOffsetY: number;
  rows: readonly Row[];
  columns: readonly Column[];
  mergeCells?: readonly MergeCell[];
  blockInfos?: readonly BlockDisplayInfo[];
  preRowHeight?: number;
  preColWidth?: number;
  nextRowHeight?: number;
  nextColWidth?: number;
}

export interface AppropriateHeight {
  height: number;
  row: number;
  col: number;
}

// ============================================================================
// Selection Types - Used for cell selection
// ============================================================================

export interface SelectorStyle {
  x: number;
  y: number;
  width: number;
  height: number;
  borderTopWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderRightWidth: number;
}

// ============================================================================
// Range Types - Position and coordinate system
// ============================================================================

export class Range {
  static fromMergeCell(mergeCell: MergeCell): Range {
    return new Range()
      .setEndCol(mergeCell.endCol)
      .setStartCol(mergeCell.startCol)
      .setEndRow(mergeCell.endRow)
      .setStartRow(mergeCell.startRow);
  }

  get width(): number {
    return this._endCol - this._startCol;
  }

  get height(): number {
    return this._endRow - this._startRow;
  }

  get startRow(): number {
    return this._startRow;
  }

  get startCol(): number {
    return this._startCol;
  }

  get endRow(): number {
    return this._endRow;
  }

  get endCol(): number {
    return this._endCol;
  }

  setStartRow(startRow: number): this {
    this._startRow = startRow;
    return this;
  }

  setStartCol(startCol: number): this {
    this._startCol = startCol;
    return this;
  }

  setEndRow(endRow: number): this {
    this._endRow = endRow;
    return this;
  }

  setEndCol(endCol: number): this {
    this._endCol = endCol;
    return this;
  }

  setStartEndRow(row: number): this {
    this._startRow = row;
    this._endRow = row;
    return this;
  }

  setStartEndCol(col: number): this {
    this._startCol = col;
    this._endCol = col;
    return this;
  }

  reset(): void {
    this.setEndCol(0).setEndRow(0).setStartCol(0).setStartRow(0);
  }

  cover(range: Range): boolean {
    return (
      this._startRow <= range._startRow &&
      this._startCol <= range._startCol &&
      this._endRow >= range._endRow &&
      this._endCol >= range._endCol
    );
  }

  equals(other: Range): boolean {
    return (
      other._startRow === this._startRow &&
      other._startCol === this._startCol &&
      other._endCol === this._endCol &&
      other._endRow === this._endRow
    );
  }

  private _startRow = 0;
  private _startCol = 0;
  private _endRow = 0;
  private _endCol = 0;
}

// ============================================================================
// Cell Types - Cell representation
// ============================================================================

export type CellType =
  | "Cell"
  | "LeftTop"
  | "FixedLeftHeader"
  | "FixedTopHeader"
  | "unknown";

export class Cell {
  constructor(public type: CellType) {}

  get width(): number {
    return this.position.width;
  }

  get height(): number {
    return this.position.height;
  }

  setCoordinate(coordinate: Range): this {
    this.coordinate = coordinate;
    return this;
  }

  setPosition(position: Range): this {
    this.position = position;
    return this;
  }

  equals(cell: Cell): boolean {
    return cell.type === this.type && this.position.equals(cell.position);
  }

  public coordinate = new Range();
  public position = new Range();
  public info?: CellInfo;
}

// ============================================================================
// Canvas Component Props - External interface for the Canvas component
// ============================================================================

export interface CanvasProps {
  selectedData: SelectedData;
  onSelectedDataChange: (e: SelectedData) => void;
  activeSheet: number;
  onActiveSheetChange: (s: number) => void;
  onSelectedDataContentChanged: (e: object) => void;
  grid: Grid | null;
  onGridChange: (grid: Grid | null) => void;
  cellLayouts: CellLayout[];
}

// ============================================================================
// Engine Events - Events emitted by the engine
// ============================================================================

export interface EngineEvents {
  onSheetChange: (sheets: readonly SheetInfo[]) => void;
  onCellUpdate: () => void;
  onError: (error: Error) => void;
}

// ============================================================================
// Engine Configuration
// ============================================================================

export interface EngineConfig {
  /** Width of the left header panel in pixels */
  leftTopWidth: number;
  /** Height of the top header panel in pixels */
  leftTopHeight: number;
  /** Show horizontal grid lines */
  showHorizontalGridLines: boolean;
  /** Show vertical grid lines */
  showVerticalGridLines: boolean;
  /** Default cell width in pt */
  defaultCellWidth: number;
  /** Default cell height in pt */
  defaultCellHeight: number;
  /** Scrollbar size in pixels */
  scrollbarSize: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  leftTopWidth: 32,
  leftTopHeight: 24,
  showHorizontalGridLines: true,
  showVerticalGridLines: true,
  defaultCellWidth: 6,
  defaultCellHeight: 25,
  scrollbarSize: 16,
};

// ============================================================================
// Re-exports from logisheets-web for convenience
// ============================================================================

export type {
  SelectedData,
  SelectedCellRange,
  SelectedLines,
  SheetInfo,
  CellInfo,
  CellRef,
  FormulaDisplayInfo,
  MergeCell,
  BlockDisplayInfo,
  CellLayout,
  Transaction,
  Payload,
} from "logisheets-web";
