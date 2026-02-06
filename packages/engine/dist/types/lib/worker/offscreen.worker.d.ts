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
    private _canvas;
    private _dpr;
    private _painter;
    private _sheetId;
    private _anchorX;
    private _anchorY;
    init(canvas: OffscreenCanvas, dpr: number): void;
    /**
     * Set license - validates the license inside the worker
     * This is the ONLY way to hide the watermark - no bypass possible
     */
    setLicense(apiKey: string, domain: string): Promise<LicenseStatus>;
    /**
     * Clear license and show watermark again
     */
    clearLicense(): void;
    resize(width: number, height: number, dpr: number): Result<Grid>;
    render(sheetId: number, anchorX: number, anchorY: number): Result<Grid>;
    getAppropriateHeights(sheetId: number, anchorX: number, anchorY: number): Result<AppropriateHeight[]>;
    handleRequest(request: {
        m: string;
        args: any;
        rid: number;
    }): void;
}
