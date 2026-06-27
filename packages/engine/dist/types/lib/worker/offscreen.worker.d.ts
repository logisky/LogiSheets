/**
 * Offscreen worker service - handles rendering operations in a Web Worker.
 */
import type { Grid, AppropriateHeight } from "$types/index";
import type { IWorkbookWorker, Result } from "./types";
import { type LicenseStatus } from "./license";
export declare class OffscreenWorkerService {
    private readonly _workbook;
    private readonly _ctx;
    constructor(_workbook: IWorkbookWorker, _ctx: Worker);
    private _canvases;
    private _painter;
    private _getCanvas;
    init(canvasId: number, canvas: OffscreenCanvas, dpr: number): void;
    /** Release a canvas when its view unmounts. No-op if already gone. */
    dispose(canvasId: number): void;
    /**
     * Set license - validates the license inside the worker
     * This is the ONLY way to hide the watermark - no bypass possible
     */
    setLicense(apiKey: string, domain: string): Promise<LicenseStatus>;
    /**
     * Clear license and show watermark again
     */
    clearLicense(): void;
    /**
     * Show/hide the default cell gridlines. Module-level in border_helper, so
     * one call affects every canvas this worker renders. Callers re-render.
     */
    setGridLines(horizontal: boolean, vertical: boolean): void;
    resize(canvasId: number, width: number, height: number, dpr: number): Result<Grid>;
    render(canvasId: number, sheetId: number, anchorX: number, anchorY: number): Result<Grid>;
    getAppropriateHeights(canvasId: number, sheetId: number, anchorX: number, anchorY: number): Result<AppropriateHeight[]>;
    handleRequest(request: {
        m: string;
        args: any;
        rid: number;
    }): void;
}
