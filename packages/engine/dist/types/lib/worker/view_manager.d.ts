/**
 * ViewManager - responsible for efficiently generating CellViewData for rendering.
 */
import type { BlockDisplayInfo, Comment } from "logisheets-web";
import type { IWorkbookWorker, Result } from "./types";
import type { Pool } from "./pool";
import { RenderCell } from "./render";
export declare class CellView {
    readonly data: CellViewData[];
    constructor(data: CellViewData[]);
    get fromRow(): number;
    get toRow(): number;
    get fromCol(): number;
    get toCol(): number;
    get rows(): readonly RenderCell[];
    get cols(): readonly RenderCell[];
    get cells(): readonly RenderCell[];
    get mergeCells(): readonly RenderCell[];
    get blocks(): readonly BlockDisplayInfo[];
}
export declare class CellViewData {
    rows: readonly RenderCell[];
    cols: readonly RenderCell[];
    cells: readonly RenderCell[];
    mergeCells: readonly RenderCell[];
    comments: readonly Comment[];
    blocks: readonly BlockDisplayInfo[];
    fromRow: number;
    toRow: number;
    fromCol: number;
    toCol: number;
    constructor(rows: readonly RenderCell[], cols: readonly RenderCell[], cells: readonly RenderCell[], mergeCells: readonly RenderCell[], comments: readonly Comment[], blocks: readonly BlockDisplayInfo[]);
}
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
export declare enum CellViewRespType {
    Existed = 0,
    Incremental = 1,
    New = 2
}
export declare class ViewManager {
    private _workbook;
    private _sheetIdx;
    private _pool;
    constructor(_workbook: IWorkbookWorker, _sheetIdx: number, _pool: Pool);
    dataChunks: CellViewData[];
    getViewResponse(startX: number, startY: number, height: number, width: number): Result<CellViewResponse>;
}
