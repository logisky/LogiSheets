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
