/**
 * LogiSheets Engine - shared workbook layer and factory for views (Sessions).
 *
 * The Engine owns everything shared across all on-screen views of a single
 * workbook:
 * 1. The Worker and DataService (one worker / one workbook).
 * 2. The sheet-info cache and workbook-level events (ready/sheetChange/cellChange).
 * 3. A factory, `createSession()`, that hands back a {@link Session} — the
 *    per-view object that owns its own mounted UI, selection, active sheet,
 *    grid and viewport. Frontends decide where to keep each Session.
 *
 * The Engine does NOT re-invent the workbook API. Use `getWorkbook()` to
 * access the original logisheets-web API.
 *
 * For backwards compatibility, the Engine lazily owns a `_defaultSession` and
 * forwards the legacy per-view methods (mount/setSelection/render/…) to it, so
 * single-window callers can keep using `new Engine()` + `engine.mount(...)`
 * unchanged. Multi-window callers should use `engine.createSession()`.
 */
import type { SheetInfo, SelectedData } from "logisheets-web";
import { DataService } from "./clients/service";
import { WorkbookClient } from "./clients/workbook";
import { BlockManager } from "./block";
import type { Grid, EngineConfig } from "$types/index";
import { Session } from "./session";
import type { SessionMountOptions, SessionEventType, SessionEventMap } from "./session";
/** Workbook-level events, shared across all views. */
export type EngineEventType = "ready" | "sheetChange" | "cellChange" | "error";
export interface EngineEventMap {
    ready: void;
    sheetChange: readonly SheetInfo[];
    cellChange: void;
    error: Error;
}
type EventCallback<T extends EngineEventType> = (data: EngineEventMap[T]) => void;
/** @deprecated Use {@link SessionMountOptions}. Kept as an alias. */
export type EngineMountOptions = SessionMountOptions;
export declare class Engine {
    private _dataService;
    private _worker;
    private _blockManager;
    private _config;
    private _ready;
    private _sheets;
    private _sessions;
    private _defaultSession;
    private _listeners;
    constructor(config?: Partial<EngineConfig>);
    /**
     * Create a new view (Session) backed by this engine's shared worker and
     * workbook. The caller owns the returned Session and decides where it
     * lives (component state, store, context, …). Mount it with
     * `session.mount(container)`.
     */
    createSession(): Session;
    /**
     * Lazily-created default session that backs the legacy per-view methods on
     * Engine (mount/setSelection/render/…). Most single-window callers never
     * touch this directly.
     */
    getDefaultSession(): Session;
    mount(container: HTMLElement, options?: SessionMountOptions): void;
    unmount(): void;
    isMounted(): boolean;
    getMountContainer(): HTMLElement | null;
    initOffscreen(canvas: HTMLCanvasElement): Promise<void>;
    loadFile(buffer: Uint8Array, filename: string): Promise<Grid | null>;
    render(anchorX?: number, anchorY?: number): Promise<Grid | null>;
    resize(width: number, height: number): Promise<Grid | null>;
    getGrid(): Grid | null;
    getSelection(): SelectedData;
    setSelection(selection: SelectedData): void;
    getCurrentSheetIndex(): number;
    setCurrentSheetIndex(index: number): void;
    /**
     * Destroy the engine: tear down every session and terminate the worker.
     */
    destroy(): void;
    /**
     * Subscribe to an event. Workbook-level events (ready/sheetChange/
     * cellChange) are handled by the Engine; per-view events (selectionChange/
     * gridChange/activeSheetChange/startEdit/invalidFormula) are forwarded to
     * the default session for backwards compatibility. `error` fires for both.
     */
    on<T extends EngineEventType | SessionEventType>(type: T, callback: T extends EngineEventType ? EventCallback<T & EngineEventType> : (data: SessionEventMap[T & SessionEventType]) => void): void;
    off<T extends EngineEventType | SessionEventType>(type: T, callback: T extends EngineEventType ? EventCallback<T & EngineEventType> : (data: SessionEventMap[T & SessionEventType]) => void): void;
    private _emit;
    /**
     * Get the workbook client for all workbook operations.
     * This provides access to the original logisheets-web API.
     */
    getWorkbook(): WorkbookClient;
    /**
     * Get the data service for rendering operations.
     */
    getDataService(): DataService;
    /**
     * Get the block manager for field/enum management.
     */
    getBlockManager(): BlockManager;
    /**
     * Get cached sheet info.
     */
    getSheets(): readonly SheetInfo[];
    /**
     * Get engine configuration.
     */
    getConfig(): EngineConfig;
    /**
     * Check if engine is ready.
     */
    isReady(): boolean;
    /**
     * Set the license key (API key) to activate the engine.
     * If valid, the watermark will be removed.
     *
     * License validation happens INSIDE the worker - cannot be bypassed.
     */
    setLicense(apiKey: string): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    /**
     * Clear the current license and show watermark again.
     */
    clearLicense(): void;
    private _ensureReady;
}
export default Engine;
