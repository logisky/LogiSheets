/**
 * Offscreen worker service - handles rendering operations in a Web Worker.
 */

import { isErrorMessage } from "logisheets-web";
import type { Grid, AppropriateHeight } from "$types/index";
import type { IWorkbookWorker, Result } from "./types";
import { OffscreenRenderName } from "./types";
import { ViewManager } from "./view_manager";
import { Painter } from "./painter";
import { Pool } from "./pool";
import { setGridVisibility } from "./border_helper";

const pool = new Pool();

/** Per-canvas rendering state. One entry per on-screen view. */
interface CanvasState {
  canvas: OffscreenCanvas;
  dpr: number;
  sheetId: number;
  anchorX: number;
  anchorY: number;
}

export class OffscreenWorkerService {
  constructor(
    private readonly _workbook: IWorkbookWorker,
    private readonly _ctx: Worker,
  ) {}

  // One canvas per view, keyed by canvasId. The painter has no retained
  // per-canvas state (it's re-pointed via setCanvas on every render), so a
  // single shared instance serves all canvases.
  private _canvases: Map<number, CanvasState> = new Map();
  private _painter: Painter = new Painter();

  private _getCanvas(canvasId: number): CanvasState {
    const state = this._canvases.get(canvasId);
    if (!state) {
      throw new Error(`Canvas ${canvasId} not initialized`);
    }
    return state;
  }

  // ========================================================================
  // Public API
  // ========================================================================

  public init(canvasId: number, canvas: OffscreenCanvas, dpr: number): void {
    this._canvases.set(canvasId, {
      canvas,
      dpr,
      sheetId: 0,
      anchorX: 0,
      anchorY: 0,
    });
    (self as any).window.devicePixelRatio = dpr;
  }

  /** Release a canvas when its view unmounts. No-op if already gone. */
  public dispose(canvasId: number): void {
    this._canvases.delete(canvasId);
  }

  /**
   * Show/hide the default cell gridlines. Module-level in border_helper, so
   * one call affects every canvas this worker renders. Callers re-render.
   */
  public setGridLines(horizontal: boolean, vertical: boolean): void {
    setGridVisibility(horizontal, vertical);
  }

  public resize(
    canvasId: number,
    width: number,
    height: number,
    dpr: number,
  ): Result<Grid> {
    const state = this._getCanvas(canvasId);

    state.canvas.width = width * dpr;
    state.canvas.height = height * dpr;
    state.dpr = dpr;
    (self as any).window.devicePixelRatio = dpr;

    return this.render(canvasId, state.sheetId, state.anchorX, state.anchorY);
  }

  public render(
    canvasId: number,
    sheetId: number,
    anchorX: number,
    anchorY: number,
  ): Result<Grid> {
    const state = this._getCanvas(canvasId);
    const canvas = state.canvas;
    const dpr = state.dpr;
    state.sheetId = sheetId;
    (self as any).window.devicePixelRatio = dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    const sheetIdx = this._workbook.getSheetIdx({ sheetId });
    if (isErrorMessage(sheetIdx)) return sheetIdx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    // After scale, clearRect uses CSS pixel coordinates
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const viewManager = new ViewManager(this._workbook, sheetIdx, pool);

    // Pass CSS pixel dimensions - all position values are in CSS pixels
    const viewResponse = viewManager.getViewResponse(
      anchorX,
      anchorY,
      canvas.height / dpr,
      canvas.width / dpr,
    );
    if (isErrorMessage(viewResponse)) return viewResponse;

    state.anchorX = viewResponse.anchorX;
    state.anchorY = viewResponse.anchorY;
    this._painter.setCanvas(canvas);
    this._painter.render(
      viewResponse.data,
      viewResponse.anchorX,
      viewResponse.anchorY,
    );

    // Include all visible rows/columns (including partially visible ones)
    // A row/column is visible if its end position extends beyond the anchor
    const visibleRows = viewResponse.data.rows.filter(
      (r) => r.position.endRow > viewResponse.anchorY,
    );
    const visibleCols = viewResponse.data.cols.filter(
      (c) => c.position.endCol > viewResponse.anchorX,
    );
    const rows = visibleRows.map((r) => ({
      idx: r.coordinate.startRow,
      height: r.position.height,
    }));
    const columns = visibleCols.map((c) => ({
      idx: c.coordinate.startCol,
      width: c.position.width,
    }));
    // Sub-row/col offset: pixels by which the first visible row/col is
    // scrolled past the canvas top/left. Overlay helpers subtract this so
    // their results stay in canvas-pixel space.
    const subOffsetY =
      visibleRows.length > 0
        ? viewResponse.anchorY - visibleRows[0].position.startRow
        : 0;
    const subOffsetX =
      visibleCols.length > 0
        ? viewResponse.anchorX - visibleCols[0].position.startCol
        : 0;
    const mergeCells = viewResponse.data.mergeCells.map((m) => ({
      startRow: m.coordinate.startRow,
      startCol: m.coordinate.startCol,
      endRow: m.coordinate.endRow,
      endCol: m.coordinate.endCol,
    }));

    const getRowHeight = (rowIdx: number): number | undefined => {
      const r = this._workbook
        .getWorkbook()
        .getWorksheetById(sheetId)
        .getRowHeight(rowIdx);
      if (isErrorMessage(r)) {
        return undefined;
      }
      return r;
    };

    const getColWidth = (colIdx: number): number | undefined => {
      const c = this._workbook
        .getWorkbook()
        .getWorksheetById(sheetId)
        .getColWidth(colIdx);
      if (isErrorMessage(c)) {
        return undefined;
      }
      return c;
    };

    const preRow = rows[0].idx > 1 ? rows[0].idx - 1 : undefined;
    let preRowHeight = undefined;
    if (preRow !== undefined) {
      preRowHeight = getRowHeight(preRow);
    }
    const nextRow = rows[rows.length - 1].idx + 1;
    const nextRowHeight = getRowHeight(nextRow);
    const preCol = columns[0].idx > 1 ? columns[0].idx - 1 : undefined;
    let preColWidth = undefined;
    if (preCol !== undefined) {
      preColWidth = getColWidth(preCol);
    }
    const nextCol = columns[columns.length - 1].idx + 1;
    const nextColWidth = getColWidth(nextCol);

    const result: Grid = {
      anchorX: viewResponse.anchorX,
      anchorY: viewResponse.anchorY,
      subOffsetX,
      subOffsetY,
      rows,
      columns,
      mergeCells,
      blockInfos: viewResponse.data.blocks,
      preRowHeight,
      preColWidth,
      nextRowHeight,
      nextColWidth,
    };

    pool.releaseCellView(viewResponse.data);

    return result;
  }

  public getAppropriateHeights(
    canvasId: number,
    sheetId: number,
    anchorX: number,
    anchorY: number,
  ): Result<AppropriateHeight[]> {
    const state = this._getCanvas(canvasId);
    const canvas = state.canvas;
    const dpr = state.dpr;
    state.sheetId = sheetId;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }

    const sheetIdx = this._workbook.getSheetIdx({ sheetId });
    if (isErrorMessage(sheetIdx)) return sheetIdx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const viewManager = new ViewManager(this._workbook, sheetIdx, pool);

    // Pass CSS pixel dimensions
    const viewResponse = viewManager.getViewResponse(
      anchorX,
      anchorY,
      canvas.height / dpr,
      canvas.width / dpr,
    );
    if (isErrorMessage(viewResponse)) return viewResponse;

    state.anchorX = viewResponse.anchorX;
    state.anchorY = viewResponse.anchorY;
    this._painter.setCanvas(canvas);
    return this._painter.getAppropriateHeights(
      viewResponse.data,
      anchorX,
      anchorY,
    );
  }

  // ========================================================================
  // Request Handler
  // ========================================================================

  public handleRequest(request: { m: string; args: any; rid: number }): void {
    const { m, args, rid: id } = request;

    // canvasId defaults to 0 so single-canvas callers that don't pass one
    // still work (backwards compatible).
    const canvasId: number = args?.canvasId ?? 0;

    if (
      m !== OffscreenRenderName.Init &&
      m !== OffscreenRenderName.Dispose &&
      m !== OffscreenRenderName.SetGridLines &&
      !this._canvases.has(canvasId)
    ) {
      this._ctx.postMessage({
        error: `OffscreenWorkerService canvas ${canvasId} not initialized`,
        rid: id,
      });
      return;
    }

    let result;
    try {
      switch (m) {
        case OffscreenRenderName.Render:
          result = this.render(
            canvasId,
            args.sheetId,
            args.anchorX,
            args.anchorY,
          );
          break;
        case OffscreenRenderName.Resize:
          result = this.resize(canvasId, args.width, args.height, args.dpr);
          break;
        case OffscreenRenderName.Init:
          result = this.init(canvasId, args.canvas, args.dpr);
          break;
        case OffscreenRenderName.Dispose:
          result = this.dispose(canvasId);
          break;
        case OffscreenRenderName.GetAppropriateHeights:
          result = this.getAppropriateHeights(
            canvasId,
            args.sheetId,
            args.anchorX,
            args.anchorY,
          );
          break;
        case OffscreenRenderName.SetGridLines:
          result = this.setGridLines(args.horizontal, args.vertical);
          break;
        default:
          this._ctx.postMessage({
            error: "Unknown method",
            rid: id,
          });
          return;
      }
    } catch (error) {
      this._ctx.postMessage({
        error: String(error),
        rid: id,
      });
      return;
    }

    this._ctx.postMessage({ result, rid: id });
  }
}
