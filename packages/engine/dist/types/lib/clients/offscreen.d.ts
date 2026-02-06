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
    init(canvas: OffscreenCanvas, dpr: number): Resp<void>;
    render(sheetId: number, anchorX: number, anchorY: number): Resp<Grid>;
    getAppropriateHeights(sheetId: number, anchorX: number, anchorY: number): Resp<readonly AppropriateHeight[]>;
    resize(width: number, height: number, dpr: number): Resp<Grid>;
    setLicense(apiKey: string, domain: string): Resp<{
        valid: boolean;
        reason?: string;
    }>;
    clearLicense(): void;
    private _call;
}
export {};
