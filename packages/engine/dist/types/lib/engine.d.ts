/**
 * LogiSheets Engine - Core engine class providing UI mounting and workbook access.
 * This is the main entry point for using the spreadsheet engine in any framework.
 *
 * The Engine does NOT re-invent the workbook API. Instead, it:
 * 1. Creates and manages the Worker and DataService
 * 2. Provides mount()/unmount() for UI rendering
 * 3. Exposes getWorkbook() to access the original logisheets-web API
 */
import type { SheetInfo, SelectedData, CellLayout } from "logisheets-web";
import { DataService } from "./clients/service";
import { WorkbookClient } from "./clients/workbook";
import { BlockManager } from "./block";
import type { Grid, EngineConfig } from "$types/index";
import type { ContextMenuItem } from "./components/contextMenuTypes";
export type EngineEventType = "ready" | "sheetChange" | "cellChange" | "selectionChange" | "error" | "gridChange" | "activeSheetChange" | "startEdit" | "invalidFormula";
export interface EngineEventMap {
    ready: void;
    sheetChange: readonly SheetInfo[];
    cellChange: void;
    selectionChange: SelectedData;
    error: Error;
    gridChange: Grid | null;
    activeSheetChange: number;
    startEdit: {
        row: number;
        col: number;
        initialText: string;
    };
    invalidFormula: void;
}
type EventCallback<T extends EngineEventType> = (data: EngineEventMap[T]) => void;
export interface EngineMountOptions {
    /** Show sheet tabs at bottom */
    showSheetTabs?: boolean;
    /** Show scrollbars */
    showScrollbars?: boolean;
    /** Custom context menu items */
    contextMenuItems?: ContextMenuItem[];
    /** Cell layouts for custom rendering */
    cellLayouts?: CellLayout[];
    /** Getter for whether a formula is being edited (prevents canvas from taking focus) */
    getIsEditingFormula?: () => boolean;
    /** Callback when an invalid formula is entered */
    onInvalidFormula?: () => void;
}
/**
 * LogiSheets Engine - The main interface for the spreadsheet.
 *
 * Usage:
 * ```javascript
 * import { Engine } from 'logisheets-engine';
 *
 * // Create engine instance
 * const engine = new Engine();
 *
 * // Wait for ready
 * engine.on('ready', async () => {
 *   // Mount the UI to a container
 *   engine.mount(document.getElementById('spreadsheet'));
 *
 *   // Access the workbook API (same as logisheets-web)
 *   const workbook = engine.getWorkbook();
 *
 *   // Load a file
 *   await workbook.loadWorkbook({ content: buffer, name: 'file.xlsx' });
 *
 *   // Use original logisheets-web API
 *   const sheets = await workbook.getAllSheetInfo();
 *   const cell = await workbook.getCell({ sheetIdx: 0, row: 0, col: 0 });
 *
 *   // Execute transactions
 *   await workbook.handleTransaction({ transaction: tx, temp: false });
 * });
 * ```
 */
export declare class Engine {
    private _dataService;
    private _worker;
    private _blockManager;
    private _config;
    private _ready;
    private _currentSheetIdx;
    private _grid;
    private _selectedData;
    private _sheets;
    private _mountedComponent;
    private _mountContainer;
    private _listeners;
    constructor(config?: Partial<EngineConfig>);
    /**
     * Mount the spreadsheet UI to a container element.
     * @param container - The HTML element to mount the spreadsheet into
     * @param options - Mount options
     */
    mount(container: HTMLElement, options?: EngineMountOptions): void;
    /**
     * Unmount the spreadsheet UI.
     */
    unmount(): void;
    /**
     * Check if the UI is mounted.
     */
    isMounted(): boolean;
    /**
     * Get the mount container element.
     */
    getMountContainer(): HTMLElement | null;
    /**
     * Initialize offscreen canvas for headless rendering.
     * Only needed if you want to render without mounting UI.
     * @param canvas - The canvas element for offscreen rendering
     */
    initOffscreen(canvas: HTMLCanvasElement): Promise<void>;
    /**
     * Destroy the engine and release all resources.
     */
    destroy(): void;
    /**
     * Subscribe to an event.
     */
    on<T extends EngineEventType>(type: T, callback: EventCallback<T>): void;
    /**
     * Unsubscribe from an event.
     */
    off<T extends EngineEventType>(type: T, callback: EventCallback<T>): void;
    private _emit;
    /**
     * Get the workbook client for all workbook operations.
     * This provides access to the original logisheets-web API.
     *
     * @example
     * ```javascript
     * const workbook = engine.getWorkbook();
     *
     * // Load file
     * await workbook.loadWorkbook({ content: buffer, name: 'file.xlsx' });
     *
     * // Get sheets
     * const sheets = await workbook.getAllSheetInfo();
     *
     * // Get cell
     * const cell = await workbook.getCell({ sheetIdx: 0, row: 0, col: 0 });
     *
     * // Execute transaction
     * await workbook.handleTransaction({ transaction: tx, temp: false });
     *
     * // Undo/Redo
     * await workbook.undo();
     * await workbook.redo();
     *
     * // Save
     * const result = await workbook.save({});
     * ```
     */
    getWorkbook(): WorkbookClient;
    /**
     * Get the data service for rendering operations.
     * Use this for render(), resize(), and other display-related operations.
     */
    getDataService(): DataService;
    /**
     * Get the block manager for field/enum management.
     */
    getBlockManager(): BlockManager;
    /**
     * Load a workbook from a file buffer.
     * Convenience wrapper for getWorkbook().loadWorkbook()
     */
    loadFile(buffer: Uint8Array, filename: string): Promise<Grid | null>;
    /**
     * Render the spreadsheet.
     * Note: When UI is mounted, rendering is handled automatically.
     */
    render(anchorX?: number, anchorY?: number): Promise<Grid | null>;
    /**
     * Resize the canvas.
     * Note: When UI is mounted, resizing is handled automatically.
     */
    resize(width: number, height: number): Promise<Grid | null>;
    /**
     * Get the current grid data.
     */
    getGrid(): Grid | null;
    /**
     * Get current selection.
     */
    getSelection(): SelectedData;
    /**
     * Set current selection.
     */
    setSelection(selection: SelectedData): void;
    /**
     * Get current sheet index.
     */
    getCurrentSheetIndex(): number;
    /**
     * Set current sheet by index.
     */
    setCurrentSheetIndex(index: number): void;
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
     *
     * @param apiKey - The license key provided to customers
     * @returns License validation status
     *
     * @example
     * ```javascript
     * const status = await engine.setLicense('eyJkb21haW4i...');
     * if (status.valid) {
     *   console.log('License activated!');
     * } else {
     *   console.log('License invalid:', status.reason);
     * }
     * ```
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
