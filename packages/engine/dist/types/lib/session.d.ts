/**
 * Session - per-view state for a single spreadsheet window.
 *
 * A Session owns everything that is specific to ONE on-screen view of the
 * workbook: its mounted UI, the active sheet, the current selection, the
 * rendered grid, and the viewport anchor. Multiple Sessions share a single
 * {@link Engine} (and therefore a single worker / workbook), so editing in
 * one Session is reflected in the others.
 *
 * The shared, workbook-level concerns (the worker, the WorkbookClient, the
 * sheet-info cache, the `ready`/`sheetChange`/`cellChange` events) stay on
 * the Engine. Anything per-view lives here.
 *
 * Frontends decide where a Session lives — keep it in component state, a
 * store, a context, wherever. The Engine just hands one back from
 * `engine.createSession()`.
 */
import type { SheetInfo, SelectedData, CellLayout } from "logisheets-web";
import type { DataService } from "./clients/service";
import type { Grid, EngineConfig } from "$types/index";
import type { ContextMenuItem } from "./components/contextMenuTypes";
/** Events scoped to a single view. */
export type SessionEventType = "selectionChange" | "gridChange" | "activeSheetChange" | "startEdit" | "invalidFormula" | "error";
export interface SessionEventMap {
    selectionChange: SelectedData;
    gridChange: Grid | null;
    activeSheetChange: number;
    startEdit: {
        row: number;
        col: number;
        initialText: string;
    };
    invalidFormula: void;
    error: Error;
}
type SessionEventCallback<T extends SessionEventType> = (data: SessionEventMap[T]) => void;
export interface SessionMountOptions {
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
 * Hooks the owning Engine provides so a Session can read shared sheet info
 * and bubble workbook-level changes back up to the Engine's shared listeners.
 */
export interface SessionHost {
    /** Current cached sheet info (shared across all sessions). */
    getSheets(): readonly SheetInfo[];
    /** Bubble a sheet-list change up to the Engine's shared `sheetChange`. */
    notifySheetsChange(sheets: readonly SheetInfo[]): void;
    /** Tell the Engine this session is destroyed so it can drop it. */
    releaseSession(session: Session): void;
}
export declare class Session {
    private readonly _dataService;
    private readonly _config;
    private readonly _host;
    private _currentSheetIdx;
    private _grid;
    private _selectedData;
    private _mountedComponent;
    private _mountContainer;
    private _listeners;
    private readonly _canvasId;
    private _isPrimary;
    /** Mark this session as the primary view. Called by the Engine for its
     *  default session. */
    markPrimary(): void;
    constructor(_dataService: DataService, _config: EngineConfig, _host: SessionHost);
    /**
     * Mount the spreadsheet UI to a container element.
     */
    mount(container: HTMLElement, options?: SessionMountOptions): void;
    /**
     * Unmount the spreadsheet UI.
     */
    unmount(): void;
    isMounted(): boolean;
    getMountContainer(): HTMLElement | null;
    /**
     * Initialize offscreen canvas for headless rendering (no mounted UI).
     */
    initOffscreen(canvas: HTMLCanvasElement): Promise<void>;
    /**
     * Destroy this view. Does NOT terminate the shared worker — that belongs
     * to the Engine.
     */
    destroy(): void;
    on<T extends SessionEventType>(type: T, callback: SessionEventCallback<T>): void;
    off<T extends SessionEventType>(type: T, callback: SessionEventCallback<T>): void;
    private _emit;
    /**
     * Load a workbook from a file buffer and refresh this view.
     *
     * When the UI is mounted, delegate to the Spreadsheet component's own
     * `loadWorkbook` so it can call `updateDocumentDimensions` and refresh its
     * internal Svelte state. Going through `dataService.loadWorkbook` directly
     * paints the worker side but leaves the Svelte component with stale
     * dimensions/anchors from the previous workbook — visible as blank
     * canvases when switching sheets after a file load.
     */
    loadFile(buffer: Uint8Array, filename: string): Promise<Grid | null>;
    /**
     * Render the spreadsheet. When UI is mounted, rendering is handled
     * automatically by the component.
     */
    render(anchorX?: number, anchorY?: number): Promise<Grid | null>;
    /**
     * Resize the canvas. When UI is mounted, resizing is handled automatically.
     */
    resize(width: number, height: number): Promise<Grid | null>;
    getGrid(): Grid | null;
    getSelection(): SelectedData;
    setSelection(selection: SelectedData): void;
    getCurrentSheetIndex(): number;
    setCurrentSheetIndex(index: number): void;
    /** Cached sheet info (shared, read through the host). */
    getSheets(): readonly SheetInfo[];
    getConfig(): EngineConfig;
}
export default Session;
