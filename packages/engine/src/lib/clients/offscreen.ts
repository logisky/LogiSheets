/**
 * Offscreen Client - communicates with the worker for rendering operations.
 */

import type { Grid, AppropriateHeight } from "$types/index";
import type { ErrorMessage } from "logisheets-web";
import { OffscreenRenderName } from "../worker/types";

type Resp<T> = Promise<T | ErrorMessage>;

export class OffscreenClient {
  private _worker: Worker;
  private _resolvers: Map<number, (arg: any) => void> = new Map();
  private _rid = 10;

  constructor(worker: Worker) {
    this._worker = worker;
    // Listen separately so we don't override WorkbookClient's onmessage
    this._worker.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as {
        rid?: number;
        result?: unknown;
        error?: unknown;
      };
      const rid = data?.rid;
      if (typeof rid !== "number") return;
      const resolver = this._resolvers.get(rid);
      if (resolver) {
        resolver(data.error ?? data.result);
        this._resolvers.delete(rid);
      }
    });
  }

  init(canvasId: number, canvas: OffscreenCanvas, dpr: number): Resp<void> {
    return this._call(OffscreenRenderName.Init, { canvasId, canvas, dpr }, [
      canvas,
    ]) as Resp<void>;
  }

  render(
    canvasId: number,
    sheetId: number,
    anchorX: number,
    anchorY: number,
  ): Resp<Grid> {
    return this._call(OffscreenRenderName.Render, {
      canvasId,
      sheetId,
      anchorX,
      anchorY,
    }) as Resp<Grid>;
  }

  getAppropriateHeights(
    canvasId: number,
    sheetId: number,
    anchorX: number,
    anchorY: number,
  ): Resp<readonly AppropriateHeight[]> {
    return this._call(OffscreenRenderName.GetAppropriateHeights, {
      canvasId,
      sheetId,
      anchorX,
      anchorY,
    }) as Resp<readonly AppropriateHeight[]>;
  }

  resize(
    canvasId: number,
    width: number,
    height: number,
    dpr: number,
  ): Resp<Grid> {
    return this._call(OffscreenRenderName.Resize, {
      canvasId,
      width,
      height,
      dpr,
    }) as Resp<Grid>;
  }

  setGridLines(horizontal: boolean, vertical: boolean): void {
    this._call(OffscreenRenderName.SetGridLines, { horizontal, vertical });
  }

  dispose(canvasId: number): void {
    this._call(OffscreenRenderName.Dispose, { canvasId });
  }

  private _call(
    method: OffscreenRenderName,
    params?: any,
    transfer?: Transferable[],
  ): Promise<any> {
    const rid = this._rid++;
    if (transfer) {
      this._worker.postMessage({ m: method, args: params, rid }, transfer);
    } else {
      this._worker.postMessage({ m: method, args: params, rid });
    }
    return new Promise((resolve) => {
      this._resolvers.set(rid, resolve);
    });
  }
}
