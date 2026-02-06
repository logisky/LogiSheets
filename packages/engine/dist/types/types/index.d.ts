/**
 * Core types for the LogiSheets engine.
 * This file contains all the interfaces that the engine interacts with externally.
 */
import type { BlockDisplayInfo, CellInfo, MergeCell, SelectedData, SheetInfo, CellLayout } from "logisheets-web";
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
export declare class Range {
    static fromMergeCell(mergeCell: MergeCell): Range;
    get width(): number;
    get height(): number;
    get startRow(): number;
    get startCol(): number;
    get endRow(): number;
    get endCol(): number;
    setStartRow(startRow: number): this;
    setStartCol(startCol: number): this;
    setEndRow(endRow: number): this;
    setEndCol(endCol: number): this;
    setStartEndRow(row: number): this;
    setStartEndCol(col: number): this;
    reset(): void;
    cover(range: Range): boolean;
    equals(other: Range): boolean;
    private _startRow;
    private _startCol;
    private _endRow;
    private _endCol;
}
export type CellType = "Cell" | "LeftTop" | "FixedLeftHeader" | "FixedTopHeader" | "unknown";
export declare class Cell {
    type: CellType;
    constructor(type: CellType);
    get width(): number;
    get height(): number;
    setCoordinate(coordinate: Range): this;
    setPosition(position: Range): this;
    equals(cell: Cell): boolean;
    coordinate: Range;
    position: Range;
    info?: CellInfo;
}
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
export interface EngineEvents {
    onSheetChange: (sheets: readonly SheetInfo[]) => void;
    onCellUpdate: () => void;
    onError: (error: Error) => void;
}
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
export declare const DEFAULT_ENGINE_CONFIG: EngineConfig;
export type { SelectedData, SelectedCellRange, SelectedLines, SheetInfo, CellInfo, CellRef, FormulaDisplayInfo, MergeCell, BlockDisplayInfo, CellLayout, Transaction, Payload, } from "logisheets-web";
