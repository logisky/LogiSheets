/**
 * Utility functions for the canvas component.
 */
import type { Grid } from "$types/index";
import { Cell } from "$types/index";
export declare const xForColStart: (colIdx: number, grid: Grid) => number;
export declare const xForColEnd: (colIdx: number, grid: Grid) => number;
export declare const yForRowStart: (rowIdx: number, grid: Grid) => number;
export declare const yForRowEnd: (rowIdx: number, grid: Grid) => number;
export declare const getPosition: (rowIdx: number, colIdx: number, grid: Grid) => {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
};
export declare const findVisibleRowIdxRange: (anchor: number, height: number, grid: Grid) => [number, number];
export declare const findVisibleColIdxRange: (anchor: number, width: number, grid: Grid) => [number, number];
export declare function match(canvasX: number, canvasY: number, anchorX: number, anchorY: number, data: Grid): Cell;
import type { SelectedData, SelectedCellRange, SelectedLines } from "logisheets-web";
export declare function getSelectedCellRange(v: SelectedData): SelectedCellRange | undefined;
export declare function getSelectedLines(v: SelectedData): SelectedLines | undefined;
export declare function buildSelectedDataFromCell(row: number, col: number, source: "editbar" | "none"): SelectedData;
export declare function buildSelectedDataFromCellRange(startRow: number, startCol: number, endRow: number, endCol: number, source: "editbar" | "none"): SelectedData;
export declare function buildSelectedDataFromLines(start: number, end: number, type: "row" | "col", source: "editbar" | "none"): SelectedData;
export declare function getSelectedRows(v: SelectedData): number[];
export declare function getSelectedColumns(v: SelectedData): number[];
export declare function toA1notation(col: number): string;
export declare function getReferenceString(v: SelectedData): string;
export declare function ptToPx(pt: number): number;
export declare function pxToPt(px: number): number;
export declare function widthToPx(w: number): number;
export declare function pxToWidth(px: number): number;
export declare function simpleUuid(): string;
