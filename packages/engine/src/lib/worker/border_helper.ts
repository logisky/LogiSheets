/**
 * BorderHelper is used to generate the continuous borders. Drawing borders
 * cell by cell will make the borders discontinuous.
 */

import type { BorderPr } from "logisheets-web";
import type { CellView } from "./view_manager";

// Grid settings. Module-level so a single worker drives all canvases; toggled
// at runtime via setGridVisibility (see Engine.setShowGridLines).
const SETTINGS = {
  grid: {
    showHorizontal: true,
    showVertical: true,
  },
};

/** Show/hide the default cell gridlines. Affects every subsequent render. */
export function setGridVisibility(horizontal: boolean, vertical: boolean): void {
  SETTINGS.grid.showHorizontal = horizontal;
  SETTINGS.grid.showVertical = vertical;
}

export interface BorderSegment {
  pr: BorderPr | undefined;
  from: number;
  to: number;
  start: number;
  coordinateX: number;
  coordinateY: number;
}

function initBorderSegment(): BorderSegment {
  return {
    pr: undefined,
    from: 0,
    to: 0,
    start: 0,
    coordinateX: 0,
    coordinateY: 0,
  };
}

function getDefaultBorder(horizontal: boolean): BorderPr {
  if (horizontal && SETTINGS.grid.showHorizontal) {
    return {
      color: { red: 224, green: 224, blue: 224 },
      style: "thin",
    };
  }

  if (!horizontal && SETTINGS.grid.showVertical) {
    return {
      color: { red: 224, green: 224, blue: 224 },
      style: "thin",
    };
  }

  return {
    color: undefined,
    style: "none",
  };
}

/** A border edge that actually draws a line (not unset / not `none`). */
function isVisibleBorder(pr?: BorderPr): boolean {
  return !!pr && !!pr.style && pr.style !== "none";
}

function isSameBorder(a: BorderPr, b: BorderPr): boolean {
  return (
    a.style === b.style &&
    a.color?.red === b.color?.red &&
    a.color?.green === b.color?.green &&
    a.color?.blue === b.color?.blue
  );
}

export class BorderHelper {
  private _rowBorderStore!: BorderSegment[][];
  private _colBorderStore!: BorderSegment[][];

  constructor(private readonly _data: CellView) {
    const fromRow = this._data.fromRow;
    const toRow = this._data.toRow;
    const fromCol = this._data.fromCol;
    const toCol = this._data.toCol;

    this._rowBorderStore = Array.from({ length: toRow - fromRow + 2 }, () =>
      Array.from({ length: toCol - fromCol + 2 }, () => initBorderSegment()),
    );

    this._colBorderStore = Array.from({ length: toCol - fromCol + 2 }, () =>
      Array.from({ length: toRow - fromRow + 2 }, () => initBorderSegment()),
    );

    this._data.cells.concat(this._data.mergeCells).forEach((cell) => {
      const borderInfo = cell.info?.style?.border;
      const left = borderInfo?.left;
      const right = borderInfo?.right;
      const top = borderInfo?.top;
      const bottom = borderInfo?.bottom;
      const { startRow, endRow, startCol, endCol } = cell.coordinate;

      const {
        startRow: posStartRow,
        endRow: posEndRow,
        startCol: posStartCol,
        endCol: posEndCol,
      } = cell.position;

      for (let j = startCol; j <= endCol; j++) {
        const topSeg: BorderSegment = {
          pr: top,
          from: posStartCol,
          to: posEndCol,
          start: posStartRow,
          coordinateX: endCol,
          coordinateY: endRow,
        };
        this._setRowBorder(startRow - fromRow, j - fromCol, topSeg);
        const bottomSeg: BorderSegment = {
          pr: bottom,
          from: posStartCol,
          to: posEndCol,
          start: posEndRow,
          coordinateX: endCol,
          coordinateY: endRow,
        };
        this._setRowBorder(endRow - fromRow + 1, j - fromCol, bottomSeg);
      }
      for (let i = startRow; i <= endRow; i++) {
        const leftSeg: BorderSegment = {
          pr: left,
          from: posStartRow,
          to: posEndRow,
          start: posStartCol,
          coordinateX: endCol,
          coordinateY: endRow,
        };
        this._setColBorder(i - fromRow, startCol - fromCol, leftSeg);
        const rightSeg: BorderSegment = {
          pr: right,
          from: posStartRow,
          to: posEndRow,
          start: posEndCol,
          coordinateX: endCol,
          coordinateY: endRow,
        };
        this._setColBorder(i - fromRow, endCol - fromCol + 1, rightSeg);
      }
    });

    this._data.mergeCells.forEach((m) => {
      const { startRow, endRow, startCol, endCol } = m.coordinate;
      const {
        startRow: posStartRow,
        endRow: posEndRow,
        startCol: posStartCol,
        endCol: posEndCol,
      } = m.position;
      for (let i = startRow; i <= endRow; i++) {
        for (let j = startCol; j <= endCol; j++) {
          if (i > startRow) {
            this._setRowBorder(
              i - fromRow,
              j - fromCol,
              {
                from: posStartRow,
                to: posEndRow,
                start: posStartCol,
                coordinateX: endCol,
                coordinateY: endRow,
                pr: { style: "none" },
              },
              true,
            );
          }
          if (j > startCol) {
            this._setColBorder(
              i - fromRow,
              j - fromCol,
              {
                from: posStartCol,
                to: posEndCol,
                start: posStartRow,
                coordinateX: endCol,
                coordinateY: endRow,
                pr: { style: "none" },
              },
              true,
            );
          }
        }
      }
    });
  }

  public generateRowBorder(r: number): BorderSegment[] {
    const result: BorderSegment[] = [];
    const row = r - this._data.fromRow;
    let currBorder = this._rowBorderStore[row][0];
    if (!currBorder.pr) {
      currBorder.pr = getDefaultBorder(true);
    }
    for (let i = 1; i < this._rowBorderStore[row].length; i++) {
      const seg = this._rowBorderStore[row][i];
      if (!seg.pr) {
        seg.pr = getDefaultBorder(true);
      }
      const pr = seg.pr as BorderPr;
      const currPr = currBorder.pr ?? getDefaultBorder(true);
      if (!isSameBorder(pr, currPr)) {
        result.push(currBorder);
        currBorder = seg;
      } else if (currBorder.to < seg.to) {
        currBorder.to = seg.to;
      }
    }
    result.push(currBorder);
    return result;
  }

  public generateColBorder(c: number): BorderSegment[] {
    const result: BorderSegment[] = [];
    const col = c - this._data.fromCol;
    let currBorder = this._colBorderStore[col][0];
    if (!currBorder.pr) {
      currBorder.pr = getDefaultBorder(false);
    }
    for (let i = 1; i < this._colBorderStore[col].length; i++) {
      const seg = this._colBorderStore[col][i];
      if (!seg.pr) {
        seg.pr = getDefaultBorder(false);
      }
      const pr = seg.pr;
      const currPr = currBorder.pr as BorderPr;
      if (!isSameBorder(pr, currPr)) {
        result.push(currBorder);
        currBorder = seg;
      } else if (currBorder.to < seg.to) {
        currBorder.to = seg.to;
      }
    }
    result.push(currBorder);
    return result;
  }

  // A shared edge between two cells maps to one slot (cell A's right border ==
  // cell B's left border). Precedence:
  //   - `force`: unconditional (used by merge cells to suppress interior lines).
  //   - An unset / `none` edge is normalized to `undefined` pr: it still carries
  //     geometry (so the default gridline can draw there) but never overwrites a
  //     real border on the shared edge, and never suppresses the gridline.
  //   - Between two real borders, the one with the larger coordinate wins.
  private _setRowBorder(
    row: number,
    col: number,
    border: BorderSegment,
    force = false,
  ): void {
    if (force) {
      this._rowBorderStore[row][col] = border;
      return;
    }
    const prev = this._rowBorderStore[row][col];
    const seg = isVisibleBorder(border.pr) ? border : { ...border, pr: undefined };
    if (!prev.pr) {
      this._rowBorderStore[row][col] = seg;
      return;
    }
    if (!seg.pr) return;
    if (seg.coordinateX >= prev.coordinateX && seg.coordinateY >= prev.coordinateY) {
      this._rowBorderStore[row][col] = seg;
    }
  }

  private _setColBorder(
    row: number,
    col: number,
    border: BorderSegment,
    force = false,
  ): void {
    if (force) {
      this._colBorderStore[col][row] = border;
      return;
    }
    const prev = this._colBorderStore[col][row];
    const seg = isVisibleBorder(border.pr) ? border : { ...border, pr: undefined };
    if (!prev.pr) {
      this._colBorderStore[col][row] = seg;
      return;
    }
    if (!seg.pr) return;
    if (seg.coordinateX >= prev.coordinateX && seg.coordinateY >= prev.coordinateY) {
      this._colBorderStore[col][row] = seg;
    }
  }
}
