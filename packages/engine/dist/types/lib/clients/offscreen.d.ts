/**
 * Offscreen Client - communicates with the worker for rendering operations.
 */
import type { Grid, AppropriateHeight } from "$types/index";
import type { ErrorMessage } from "logisheets-web";
type Resp<T> = Promise<T | ErrorMessage>;
export declare class OffscreenClient {
    private _worker;
    private _resolvers;
    private _rid;
    constructor(worker: Worker);
    init(canvasId: number, canvas: OffscreenCanvas, dpr: number): Resp<void>;
    render(canvasId: number, sheetId: number, anchorX: number, anchorY: number): Resp<Grid>;
    getAppropriateHeights(canvasId: number, sheetId: number, anchorX: number, anchorY: number): Resp<readonly AppropriateHeight[]>;
    resize(canvasId: number, width: number, height: number, dpr: number): Resp<Grid>;
    setLicense(apiKey: string, domain: string): Resp<{
        valid: boolean;
        reason?: string;
    }>;
    clearLicense(): void;
    setGridLines(horizontal: boolean, vertical: boolean): void;
    dispose(canvasId: number): void;
    private _call;
}
export {};
