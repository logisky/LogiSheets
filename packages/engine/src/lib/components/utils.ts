/**
 * Utility functions for the canvas component.
 */

import type { Grid, Range, Cell as CellType } from "$types/index";
import { Range as RangeClass, Cell } from "$types/index";

// ============================================================================
// Grid Helper Functions
// ============================================================================

// Returned values are in canvas-pixel space. The first visible row/column
// may be partially scrolled off the top/left of the canvas — its top edge is
// at `-grid.subOffsetY` / `-grid.subOffsetX`, not zero.

export const xForColStart = (colIdx: number, grid: Grid): number => {
  let acc = -grid.subOffsetX;
  for (const c of grid.columns) {
    if (c.idx >= colIdx) break;
    acc += c.width;
  }
  return acc;
};

export const xForColEnd = (colIdx: number, grid: Grid): number => {
  let acc = -grid.subOffsetX;
  for (const c of grid.columns) {
    acc += c.width;
    if (c.idx >= colIdx) break;
  }
  return acc;
};

export const yForRowStart = (rowIdx: number, grid: Grid): number => {
  let acc = -grid.subOffsetY;
  for (const r of grid.rows) {
    if (r.idx >= rowIdx) break;
    acc += r.height;
  }
  return acc;
};

export const yForRowEnd = (rowIdx: number, grid: Grid): number => {
  let acc = -grid.subOffsetY;
  for (const r of grid.rows) {
    acc += r.height;
    if (r.idx >= rowIdx) break;
  }
  return acc;
};

export interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Pixel rectangle (in canvas space) of a single cell — where an in-cell
 * editor should sit. `originX`/`originY` offset by the header panel sizes
 * (e.g. the engine config's leftTopWidth/leftTopHeight). `defaultWidth`/
 * `defaultHeight` are used only if the cell isn't in the visible window.
 */
export const getCellRect = (
  grid: Grid,
  row: number,
  col: number,
  opts: {
    originX?: number;
    originY?: number;
    defaultWidth?: number;
    defaultHeight?: number;
  } = {},
): CellRect => {
  const { originX = 0, originY = 0, defaultWidth = 0, defaultHeight = 0 } = opts;
  const colInfo = grid.columns.find((c) => c.idx === col);
  const rowInfo = grid.rows.find((r) => r.idx === row);
  return {
    x: xForColStart(col, grid) + originX,
    y: yForRowStart(row, grid) + originY,
    width: colInfo?.width ?? defaultWidth,
    height: rowInfo?.height ?? defaultHeight,
  };
};

/** Whether a cell is within the grid's currently rendered window. */
export const isCellInGridWindow = (
  grid: Grid,
  row: number,
  col: number,
): boolean => {
  const minRow = grid.rows[0]?.idx ?? 0;
  const maxRow = grid.rows[grid.rows.length - 1]?.idx ?? 0;
  const minCol = grid.columns[0]?.idx ?? 0;
  const maxCol = grid.columns[grid.columns.length - 1]?.idx ?? 0;
  return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
};

/** A cell reference as parsed by the backend (getDisplayUnitsOfFormula). */
export interface FormulaCellRef {
  workbook?: string;
  sheet1?: string;
  sheet2?: string;
  row1?: number;
  col1?: number;
  row2?: number;
  col2?: number;
}

export interface HighlightRect extends CellRect {
  /** Index into the caller's color palette (refs are colored in order). */
  colorIndex: number;
}

/**
 * Pixel rectangles (canvas space) for highlighting the local cell references
 * of a formula being edited — one rect per local, single-sheet ref, in order,
 * with a `colorIndex` the caller maps to its palette. Cross-workbook /
 * cross-sheet / other-sheet refs are skipped; ranges and merged single cells
 * are expanded; indices are clamped to the visible window.
 */
export const getReferenceHighlightRects = (
  cellRefs: readonly FormulaCellRef[],
  grid: Grid,
  sheetName: string,
  opts: { originX?: number; originY?: number } = {},
): HighlightRect[] => {
  const { originX = 0, originY = 0 } = opts;
  if (cellRefs.length === 0) return [];

  const rects: HighlightRect[] = [];
  let colorIndex = 0;
  const firstCol = grid.columns[0]?.idx ?? 0;
  const lastCol = grid.columns[grid.columns.length - 1]?.idx ?? firstCol;
  const firstRow = grid.rows[0]?.idx ?? 0;
  const lastRow = grid.rows[grid.rows.length - 1]?.idx ?? firstRow;
  const clampCol = (c: number) => Math.min(Math.max(c, firstCol), lastCol);
  const clampRow = (r: number) => Math.min(Math.max(r, firstRow), lastRow);

  for (const cellRef of cellRefs) {
    if (cellRef.workbook) continue;
    if (
      cellRef.sheet1 !== undefined &&
      cellRef.sheet2 !== undefined &&
      cellRef.sheet1 !== cellRef.sheet2
    )
      continue;
    if (cellRef.sheet1 && cellRef.sheet1 !== sheetName) continue;
    if (cellRef.row1 === undefined || cellRef.col1 === undefined) continue;

    const idx = colorIndex++;
    const r1 = clampRow(cellRef.row1);
    const c1 = clampCol(cellRef.col1);
    let endRow: number;
    let endCol: number;
    let startRow: number;
    let startCol: number;

    if (cellRef.row2 !== undefined && cellRef.col2 !== undefined) {
      const r2 = clampRow(cellRef.row2);
      const c2 = clampCol(cellRef.col2);
      startRow = Math.min(r1, r2);
      endRow = Math.max(r1, r2);
      startCol = Math.min(c1, c2);
      endCol = Math.max(c1, c2);
    } else {
      startRow = r1;
      startCol = c1;
      endRow = r1;
      endCol = c1;
      // A single ref over a merged cell covers the whole merge.
      if (grid.mergeCells) {
        for (const m of grid.mergeCells) {
          if (
            m.startCol <= c1 &&
            c1 <= m.endCol &&
            m.startRow <= r1 &&
            r1 <= m.endRow
          ) {
            endRow = Math.max(endRow, m.endRow);
            endCol = Math.max(endCol, m.endCol);
          }
        }
      }
    }

    const sx = originX + xForColStart(startCol, grid);
    const ex = originX + xForColEnd(endCol, grid);
    const sy = originY + yForRowStart(startRow, grid);
    const ey = originY + yForRowEnd(endRow, grid);
    rects.push({
      x: sx,
      y: sy,
      width: Math.max(0, ex - sx),
      height: Math.max(0, ey - sy),
      colorIndex: idx,
    });
  }

  return rects;
};

export const getPosition = (rowIdx: number, colIdx: number, grid: Grid) => {
  let xAcc = -grid.subOffsetX;
  let x0 = 0;
  let x1 = 0;
  for (const c of grid.columns) {
    if (c.idx < colIdx) {
      xAcc += c.width;
      continue;
    }
    x0 = xAcc;
    x1 = xAcc + c.width;
    break;
  }

  let yAcc = -grid.subOffsetY;
  let y0 = 0;
  let y1 = 0;
  for (const r of grid.rows) {
    if (r.idx < rowIdx) {
      yAcc += r.height;
      continue;
    }
    y0 = yAcc;
    y1 = yAcc + r.height;
    break;
  }

  return { startX: x0, startY: y0, endX: x1, endY: y1 };
};

export const findVisibleRowIdxRange = (
  anchor: number,
  height: number,
  grid: Grid,
): [number, number] => {
  // First row's actual data-y start (the painter's row[0] sits at
  // canvasY = -subOffsetY, equivalent to data-y = anchorY - subOffsetY).
  let s = grid.anchorY - grid.subOffsetY;
  let startIdx = 0;
  for (let i = 0; i < grid.rows.length; i += 1) {
    if (s >= anchor) {
      startIdx = i;
      break;
    }
    s += grid.rows[i].height;
  }
  let endIdx = startIdx;
  let acc = 0;
  for (let j = startIdx; j < grid.rows.length; j += 1) {
    acc += grid.rows[j].height;
    if (acc >= height) {
      endIdx = j - 1;
      break;
    }
  }
  return [startIdx, endIdx];
};

export const findVisibleColIdxRange = (
  anchor: number,
  width: number,
  grid: Grid,
): [number, number] => {
  let s = grid.anchorX - grid.subOffsetX;
  let startIdx = 0;
  for (let i = 0; i < grid.columns.length; i += 1) {
    if (s >= anchor) {
      startIdx = i;
      break;
    }
    s += grid.columns[i].width;
  }
  let endIdx = grid.columns.length - 1;
  let acc = 0;
  for (let j = startIdx; j < grid.columns.length; j += 1) {
    acc += grid.columns[j].width;
    if (acc > width) {
      endIdx = j;
    }
  }
  return [startIdx, endIdx];
};

// ============================================================================
// Cell Matching
// ============================================================================

export function match(
  canvasX: number,
  canvasY: number,
  anchorX: number,
  anchorY: number,
  data: Grid,
): Cell {
  const clickX = canvasX + anchorX;
  const clickY = canvasY + anchorY;

  // Accumulator starts at the first row/col's actual data-y/x start.
  // With sub-row anchor, that's `anchor - subOffset` (not the anchor itself).
  let h = data.anchorY - data.subOffsetY;
  let rowIdx = 0;
  let rowHeight = 0;
  for (const row of data.rows) {
    h += row.height;
    if (h > clickY) {
      rowIdx = row.idx;
      rowHeight = row.height;
      break;
    }
  }

  let w = data.anchorX - data.subOffsetX;
  let colIdx = 0;
  let colWidth = 0;
  for (const col of data.columns) {
    w += col.width;
    if (w > clickX) {
      colIdx = col.idx;
      colWidth = col.width;
      break;
    }
  }

  let pStartRow = h - rowHeight;
  let pEndRow = h;
  let pStartCol = w - colWidth;
  let pEndCol = w;
  let startRow = rowIdx;
  let endRow = rowIdx;
  let startCol = colIdx;
  let endCol = colIdx;

  if (data.mergeCells && data.mergeCells.length > 0) {
    const mergedCell = data.mergeCells.find(
      (c) =>
        c.startRow <= rowIdx &&
        c.endRow >= rowIdx &&
        c.startCol <= colIdx &&
        c.endCol >= colIdx,
    );
    if (mergedCell) {
      startRow = mergedCell.startRow;
      endRow = mergedCell.endRow;
      startCol = mergedCell.startCol;
      endCol = mergedCell.endCol;

      let sRow = 0;
      let eRow = 0;
      for (const row of data.rows) {
        if (row.idx > endRow) break;
        if (row.idx > startRow) {
          eRow += row.height;
        } else {
          sRow += row.height;
          eRow += row.height;
        }
      }
      pStartRow = sRow;
      pEndRow = eRow;

      let sCol = 0;
      let eCol = 0;
      for (const col of data.columns) {
        if (col.idx > endCol) break;
        if (col.idx > startCol) {
          eCol += col.width;
        } else {
          sCol += col.width;
          eCol += col.width;
        }
      }
      pStartCol = sCol;
      pEndCol = eCol;
    }
  }

  return new Cell("Cell")
    .setPosition(
      new RangeClass()
        .setStartRow(pStartRow)
        .setEndRow(pEndRow)
        .setStartCol(pStartCol)
        .setEndCol(pEndCol),
    )
    .setCoordinate(
      new RangeClass()
        .setStartRow(startRow)
        .setEndRow(endRow)
        .setStartCol(startCol)
        .setEndCol(endCol),
    );
}

// ============================================================================
// Selected Data Helpers
// ============================================================================

import type {
  SelectedData,
  SelectedCellRange,
  SelectedLines,
} from "logisheets-web";

export function getSelectedCellRange(
  v: SelectedData,
): SelectedCellRange | undefined {
  if (v.data?.ty === "cellRange") return v.data.d;
  return undefined;
}

export function getSelectedLines(v: SelectedData): SelectedLines | undefined {
  if (v.data?.ty === "line") return v.data.d;
  return undefined;
}

export function buildSelectedDataFromCell(
  row: number,
  col: number,
  source: "editbar" | "none",
): SelectedData {
  return {
    source,
    data: {
      ty: "cellRange",
      d: { startRow: row, endRow: row, startCol: col, endCol: col },
    },
  };
}

export function buildSelectedDataFromCellRange(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  source: "editbar" | "none",
): SelectedData {
  return {
    source,
    data: {
      ty: "cellRange",
      d: { startRow, endRow, startCol, endCol },
    },
  };
}

export function buildSelectedDataFromLines(
  start: number,
  end: number,
  type: "row" | "col",
  source: "editbar" | "none",
): SelectedData {
  return {
    source,
    data: {
      ty: "line",
      d: { start, end, type },
    },
  };
}

export function getSelectedRows(v: SelectedData): number[] {
  if (v.data?.ty === "cellRange") {
    return [v.data.d.startRow, v.data.d.endRow];
  }
  if (v.data?.ty === "line" && v.data.d.type === "row") {
    return [v.data.d.start, v.data.d.end];
  }
  return [];
}

export function getSelectedColumns(v: SelectedData): number[] {
  if (v.data?.ty === "cellRange") {
    return [v.data.d.startCol, v.data.d.endCol];
  }
  if (v.data?.ty === "line" && v.data.d.type === "col") {
    return [v.data.d.start, v.data.d.end];
  }
  return [];
}

// ============================================================================
// A1 Notation
// ============================================================================

export function toA1notation(col: number): string {
  let result = "";
  let c = col;
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result;
    c = Math.floor(c / 26) - 1;
  }
  return result;
}

export function getReferenceString(v: SelectedData): string {
  if (v.data === undefined) return "";
  if (v.data.ty === "cellRange") {
    const startRow = v.data.d.startRow;
    const endRow = v.data.d.endRow;
    const startCol = v.data.d.startCol;
    const endCol = v.data.d.endCol;
    if (startRow === endRow && startCol === endCol) {
      return `${toA1notation(startCol)}${startRow + 1}`;
    }
    return `${toA1notation(startCol)}${startRow + 1}:${toA1notation(endCol)}${endRow + 1}`;
  }
  if (v.data.ty === "line") {
    if (v.data.d.type === "col") {
      return `${toA1notation(v.data.d.start)}:${toA1notation(v.data.d.end)}`;
    }
    return `${v.data.d.start + 1}:${v.data.d.end + 1}`;
  }
  return "";
}

// ============================================================================
// Unit Conversions
// ============================================================================

const DEFAULT_PPI = 96;

export function ptToPx(pt: number): number {
  return Math.round(((pt * DEFAULT_PPI) / 72) * 100) / 100;
}

export function pxToPt(px: number): number {
  return Math.round(((px * 72) / DEFAULT_PPI) * 100) / 100;
}

export function widthToPx(w: number): number {
  return w * 7;
}

export function pxToWidth(px: number): number {
  return px / 7;
}

// ============================================================================
// UUID Generator
// ============================================================================

export function simpleUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
