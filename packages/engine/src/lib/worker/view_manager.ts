/**
 * ViewManager - responsible for efficiently generating CellViewData for rendering.
 */

import type {
  DisplayWindowWithStartPoint,
  BlockDisplayInfo,
  Comment,
} from "logisheets-web";
import { isErrorMessage } from "logisheets-web";
import type { IWorkbookWorker, Result } from "./types";
import type { Pool } from "./pool";
import { RenderCell } from "./render";
import {
  Range,
  StandardCell,
  StandardStyle,
  StandardValue,
  StandardRowInfo,
  StandardColInfo,
  ptToPx,
  pxToPt,
  widthToPx,
  pxToWidth,
} from "./standable";

// ============================================================================
// CellView Classes
// ============================================================================

export class CellView {
  public constructor(public readonly data: CellViewData[]) {}

  public get fromRow(): number {
    let min = Infinity;
    for (const d of this.data) {
      if (d.rows.length) {
        min = Math.min(min, d.rows[0].coordinate.startRow);
      }
    }
    return min;
  }

  public get toRow(): number {
    let max = -Infinity;
    for (const d of this.data) {
      if (d.rows.length) {
        max = Math.max(max, d.rows[d.rows.length - 1].coordinate.endRow);
      }
    }
    return max;
  }

  public get fromCol(): number {
    let min = Infinity;
    for (const d of this.data) {
      if (d.cols.length) {
        min = Math.min(min, d.cols[0].coordinate.startCol);
      }
    }
    return min;
  }

  public get toCol(): number {
    let max = -Infinity;
    for (const d of this.data) {
      if (d.cols.length) {
        max = Math.max(max, d.cols[d.cols.length - 1].coordinate.endCol);
      }
    }
    return max;
  }

  public get rows(): readonly RenderCell[] {
    let curr = -1;
    return this.data
      .flatMap((d) => d.rows)
      .sort((a, b) => a.coordinate.startRow - b.coordinate.startRow)
      .filter((r) => {
        if (r.position.startRow > curr) {
          curr = r.position.startRow;
          return true;
        }
        return false;
      });
  }

  public get cols(): readonly RenderCell[] {
    let curr = -1;
    return this.data
      .flatMap((d) => d.cols)
      .sort((a, b) => a.coordinate.startCol - b.coordinate.startCol)
      .filter((r) => {
        if (r.position.startCol > curr) {
          curr = r.position.startCol;
          return true;
        }
        return false;
      });
  }

  public get cells(): readonly RenderCell[] {
    let currRow = -1;
    let currCol = -1;
    return this.data
      .flatMap((d) => d.cells)
      .filter((c) => {
        const col = c.position.startCol;
        const row = c.position.startRow;
        if (col <= currCol && row <= currRow) {
          return false;
        }
        currCol = col;
        currRow = row;
        return true;
      });
  }

  public get mergeCells(): readonly RenderCell[] {
    return this.data.flatMap((d) => d.mergeCells);
  }

  public get blocks(): readonly BlockDisplayInfo[] {
    const set = new Set();
    const result: BlockDisplayInfo[] = [];
    this.data.forEach((d) => {
      if (!d.blocks.length) {
        return;
      }
      for (const block of d.blocks) {
        if (!set.has(block.info.blockId)) {
          set.add(block.info.blockId);
          result.push(block);
        }
      }
    });
    return result;
  }
}

export class CellViewData {
  public fromRow = 0;
  public toRow = 0;
  public fromCol = 0;
  public toCol = 0;

  constructor(
    public rows: readonly RenderCell[],
    public cols: readonly RenderCell[],
    public cells: readonly RenderCell[],
    public mergeCells: readonly RenderCell[],
    public comments: readonly Comment[],
    public blocks: readonly BlockDisplayInfo[],
  ) {
    if (rows.length === 0) {
      throw Error("rows should not be empty");
    }
    if (cols.length === 0) {
      throw Error("cols should not be empty");
    }
    if (cells.length === 0) {
      throw Error("cells should not be empty");
    }
    this.fromRow = rows[0].coordinate.startRow;
    this.toRow = rows[rows.length - 1].coordinate.endRow;
    this.fromCol = cols[0].coordinate.startCol;
    this.toCol = cols[cols.length - 1].coordinate.endCol;
  }
}

// ============================================================================
// ViewManager
// ============================================================================

export interface CellViewRequest {
  readonly startX: number;
  readonly startY: number;
  readonly height: number;
  readonly width: number;
}

export interface CellViewResponse {
  readonly type: CellViewRespType;
  readonly data: CellView;
  readonly request: CellViewRequest;
  readonly anchorX: number;
  readonly anchorY: number;
}

export enum CellViewRespType {
  Existed,
  Incremental,
  New,
}

export class ViewManager {
  constructor(
    private _workbook: IWorkbookWorker,
    private _sheetIdx: number,
    private _pool: Pool,
  ) {}

  public dataChunks: CellViewData[] = [];

  public getViewResponse(
    startX: number,
    startY: number,
    height: number,
    width: number,
  ): Result<CellViewResponse> {
    const x = Math.max(0, startX);
    const y = Math.max(0, startY);
    const type = CellViewRespType.New;

    const w = this._workbook.getDisplayWindow({
      sheetIdx: this._sheetIdx,
      startX: pxToWidth(x),
      startY: pxToPt(y),
      height: pxToPt(height),
      width: pxToWidth(width),
    });
    if (isErrorMessage(w)) return w;

    const data = parseDisplayWindow(
      w,
      this._pool.getRenderCell.bind(this._pool),
      this._pool.getRange.bind(this._pool),
      this._pool.getStandardCell.bind(this._pool),
      this._pool.getStandardValue.bind(this._pool),
      this._pool.getStandardStyle.bind(this._pool),
    );

    this.dataChunks = [data];
    this.dataChunks.sort((a, b) => {
      return a.fromRow < b.fromRow || a.fromCol < b.fromCol ? -1 : 1;
    });

    // anchorX/anchorY are the scroll position used by the painter to offset
    // every cell (canvasY = position.startRow - anchorY). We return the
    // requested y/x as-is — sub-row anchors are supported. Overlay helpers
    // compensate via `subOffsetY`/`subOffsetX` exposed on Grid (the gap
    // between the requested anchor and the first fully-visible row's
    // startRow).
    return {
      type,
      data: new CellView(this.dataChunks),
      request: { startX, startY, height, width },
      anchorX: x,
      anchorY: y,
    };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function locate(
  fromRow: number,
  fromCol: number,
  row: number,
  col: number,
  colCount: number,
): number {
  return (row - fromRow) * colCount + (col - fromCol);
}

function parseDisplayWindow(
  window: DisplayWindowWithStartPoint,
  getRenderCell: () => RenderCell,
  getRange: () => Range,
  getStandardCell: () => StandardCell,
  getStandardValue: () => StandardValue,
  getStandardStyle: () => StandardStyle,
): CellViewData {
  const xStart = widthToPx(window.startX);
  const yStart = ptToPx(window.startY);

  let x = xStart;
  const cols = window.window.cols.map((c) => {
    const colInfo = StandardColInfo.from(c);
    const renderCol = getRenderCell()
      .setCoordinate(getRange().setStartCol(colInfo.idx).setEndCol(colInfo.idx))
      .setPosition(
        getRange()
          .setStartCol(x)
          .setEndCol(x + colInfo.px)
          .setStartRow(0)
          .setEndRow(0),
      );
    x += colInfo.px;
    return renderCol;
  });

  let y = yStart;
  const rows = window.window.rows.map((r) => {
    const rowInfo = StandardRowInfo.from(r);
    const renderRow = getRenderCell()
      .setCoordinate(getRange().setStartRow(rowInfo.idx).setEndRow(rowInfo.idx))
      .setPosition(
        getRange()
          .setStartRow(y)
          .setEndRow(y + rowInfo.px)
          .setStartCol(0)
          .setEndCol(0),
      );
    y += rowInfo.px;
    return renderRow;
  });

  const skipRenderCells: Set<string> = new Set();

  const fieldFormatByCell: Map<string, string> = new Map();
  window.window.blocks.forEach((b) => {
    const rowStart = b.info.rowStart;
    const colStart = b.info.colStart;
    const schema = b.info.schema;
    const schemaType = schema?.schemaType;
    const renderInfoById = new Map(
      b.info.fieldRenders.map((e) => [e.renderId, e] as const),
    );
    for (let r = rowStart; r < rowStart + b.info.rowCnt; r += 1) {
      for (let c = colStart; c < colStart + b.info.colCnt; c += 1) {
        const colIdx = c - colStart;
        if (!schema) continue;
        if (schemaType !== "row") continue;
        const fieldEntry = schema.fields[colIdx];
        if (!fieldEntry) continue;
        const renderInfo = renderInfoById.get(fieldEntry.renderId);
        if (!renderInfo) continue;
        if (renderInfo.diyRender) {
          skipRenderCells.add(`${r}-${c}`);
        }
        const fmt = renderInfo.style?.formatter;
        if (fmt) {
          fieldFormatByCell.set(`${r}-${c}`, fmt);
        }
      }
    }
  });

  window.window.mergeCells.forEach((m) => {
    for (let r = m.startRow; r <= m.endRow; r += 1) {
      for (let c = m.startCol; c <= m.endCol; c += 1) {
        if (r === m.startRow && c === m.startCol) {
          skipRenderCells.add(`${r}-${c}`);
        }
      }
    }
  });

  const cells: RenderCell[] = [];
  let idx = 0;
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < cols.length; c += 1) {
      const row = rows[r];
      const col = cols[c];
      // skipRenderCells is keyed by ABSOLUTE sheet coordinates (the
      // population loop above uses `rowStart + offset`, `colStart +
      // offset`). The outer loop indices `r` / `c` here are POSITIONAL
      // indices into the visible window — they only equal absolute
      // coords when the viewport happens to start at (0,0). Using
      // them here was a latent bug: any scroll offset / partial
      // viewport made the check miss for blocks below the fold, so
      // the canvas would paint through `diyRender=true` widgets
      // (bool cells, enum chips, …) intermittently depending on
      // scroll state. Look up by the row/col's *coordinate* fields,
      // which carry the absolute sheet indices.
      let skip = false;
      if (
        skipRenderCells.has(
          `${row.coordinate.startRow}-${col.coordinate.startCol}`,
        )
      ) {
        skip = true;
      }
      const corrdinate = getRange()
        .setStartRow(row.coordinate.startRow)
        .setEndRow(row.coordinate.endRow)
        .setStartCol(col.coordinate.startCol)
        .setEndCol(col.coordinate.endCol);

      const position = getRange()
        .setStartRow(row.position.startRow)
        .setEndRow(row.position.endRow)
        .setStartCol(col.position.startCol)
        .setEndCol(col.position.endCol);

      const renderCell = getRenderCell()
        .setPosition(position)
        .setCoordinate(corrdinate)
        .setSkipRender(skip)
        .setInfo(
          window.window.cells[idx],
          getStandardCell,
          getStandardValue,
          getStandardStyle,
        );

      const fieldFmt = fieldFormatByCell.get(
        `${row.coordinate.startRow}-${col.coordinate.startCol}`,
      );
      if (fieldFmt && renderCell.info) {
        if (!renderCell.info.style) {
          const style = getStandardStyle();
          renderCell.info.setStyle(style);
        }
        if (renderCell.info.style) {
          const existing = renderCell.info.style.formatter;
          if (!existing || existing.toLowerCase() === "general") {
            renderCell.info.style.formatter = fieldFmt;
          }
        }
      }
      cells.push(renderCell);
      idx += 1;
    }
  }

  const mergeCells = window.window.mergeCells.map((m) => {
    const fromRow = rows[0].coordinate.startRow;
    const toRow = rows[rows.length - 1].coordinate.endRow;
    const fromCol = cols[0].coordinate.startCol;
    const toCol = cols[cols.length - 1].coordinate.endCol;
    const startRow = Math.min(Math.max(fromRow, m.startRow), toRow);
    const startCol = Math.min(Math.max(fromCol, m.startCol), toCol);
    const masterIdx = locate(fromRow, fromCol, startRow, startCol, cols.length);
    const masterCell = cells[masterIdx];

    const endRow = Math.min(Math.max(fromRow, m.endRow), toRow);
    const endCol = Math.min(Math.max(fromCol, m.endCol), toCol);
    const endIdx = locate(fromRow, fromCol, endRow, endCol, cols.length);
    const endCell = cells[endIdx];

    const coordinate = getRange()
      .setStartRow(masterCell.coordinate.startRow)
      .setStartCol(masterCell.coordinate.startCol)
      .setEndRow(endCell.coordinate.endRow)
      .setEndCol(endCell.coordinate.endCol);
    const position = getRange()
      .setStartRow(masterCell.position.startRow)
      .setStartCol(masterCell.position.startCol)
      .setEndRow(endCell.position.endRow)
      .setEndCol(endCell.position.endCol);

    const renderCell = getRenderCell()
      .setPosition(position)
      .setCoordinate(coordinate)
      .setStandardCell(masterCell.info);
    return renderCell;
  });

  return new CellViewData(
    rows,
    cols,
    cells,
    mergeCells,
    window.window.comments,
    window.window.blocks,
  );
}
