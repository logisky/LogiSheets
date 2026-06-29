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
import { isErrorMessage } from "logisheets-web";
import type { DataService } from "./clients/service";
import type { Grid, EngineConfig } from "$types/index";
import { mount, unmount } from "svelte";
import Spreadsheet from "./components/Spreadsheet.svelte";
import type { ContextMenuContext } from "./components/contextMenuTypes";

/** Events scoped to a single view. */
export type SessionEventType =
  | "selectionChange"
  | "gridChange"
  | "activeSheetChange"
  | "startEdit"
  | "invalidFormula"
  | "contextMenu"
  | "error";

export interface SessionEventMap {
  selectionChange: SelectedData;
  gridChange: Grid | null;
  activeSheetChange: number;
  startEdit: { row: number; col: number; initialText: string };
  invalidFormula: void;
  /**
   * The user opened the context menu (right-clicked a cell or a row/column
   * header). The engine renders NO menu of its own — the host listens for
   * this and renders whatever menu it likes at `(x, y)` (viewport
   * coordinates), using `context` to decide the items.
   */
  contextMenu: { context: ContextMenuContext; x: number; y: number };
  error: Error;
}

type SessionEventCallback<T extends SessionEventType> = (
  data: SessionEventMap[T],
) => void;

export interface SessionMountOptions {
  /** Show sheet tabs at bottom */
  showSheetTabs?: boolean;
  /** Show scrollbars */
  showScrollbars?: boolean;
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

// Each Session renders to its own OffscreenCanvas in the shared worker,
// keyed by a process-unique canvasId. Start at 1 so the legacy single-canvas
// default of 0 never collides with a real session.
let _nextCanvasId = 1;

export class Session {
  private _currentSheetIdx = 0;
  private _grid: Grid | null = null;
  private _selectedData: SelectedData = { source: "none" };

  // Mount state
  private _mountedComponent: ReturnType<typeof mount> | null = null;
  private _mountContainer: HTMLElement | null = null;

  // Event listeners (per-view)
  private _listeners: Map<SessionEventType, Set<SessionEventCallback<any>>> =
    new Map();

  // Unique id for this view's OffscreenCanvas in the shared worker. Shared
  // with the mounted Spreadsheet component so engine-side render() and the
  // component's own render target the same canvas.
  private readonly _canvasId = _nextCanvasId++;

  // Whether this is the primary view. Only the primary keeps the data
  // service's legacy "active view" sheet pointer in sync — secondary views
  // switch their own sheet without clobbering what app-level consumers
  // (toolbar, edit bar) read for the main view.
  private _isPrimary = false;

  /** Mark this session as the primary view. Called by the Engine for its
   *  default session. */
  markPrimary(): void {
    this._isPrimary = true;
  }

  constructor(
    private readonly _dataService: DataService,
    private readonly _config: EngineConfig,
    private readonly _host: SessionHost,
  ) {
    (
      [
        "selectionChange",
        "gridChange",
        "activeSheetChange",
        "startEdit",
        "invalidFormula",
        "contextMenu",
        "error",
      ] as SessionEventType[]
    ).forEach((type) => {
      this._listeners.set(type, new Set());
    });
  }

  // ========================================================================
  // Mount / Unmount (UI)
  // ========================================================================

  /**
   * Mount the spreadsheet UI to a container element.
   */
  mount(container: HTMLElement, options: SessionMountOptions = {}): void {
    if (this._mountedComponent) {
      console.warn("Session is already mounted. Call unmount() first.");
      return;
    }

    this._mountContainer = container;

    this._mountedComponent = mount(Spreadsheet, {
      target: container,
      props: {
        canvasId: this._canvasId,
        selectedData: this._selectedData,
        activeSheet: this._currentSheetIdx,
        cellLayouts: options.cellLayouts ?? [],
        config: this._config,
        showSheetTabs: options.showSheetTabs ?? true,
        showScrollbars: options.showScrollbars ?? true,
        getIsEditingFormula: options.getIsEditingFormula,
        onSelectedDataChange: (data: SelectedData) => {
          this._selectedData = data;
          this._emit("selectionChange", data);
        },
        onActiveSheetChange: (sheet: number) => {
          this._currentSheetIdx = sheet;
          this._emit("activeSheetChange", sheet);
        },
        onGridChange: (grid: Grid | null) => {
          this._grid = grid;
          this._emit("gridChange", grid);
        },
        onSheetsChange: (sheets: readonly SheetInfo[]) => {
          this._host.notifySheetsChange(sheets);
        },
        // Engine renders no menu — surface the trigger so the host can.
        onContextMenu: (context: ContextMenuContext, x: number, y: number) => {
          this._emit("contextMenu", { context, x, y });
        },
        onStartEdit: (row: number, col: number, initialText: string) => {
          this._emit("startEdit", { row, col, initialText });
        },
        onInvalidFormula: () => {
          this._emit("invalidFormula", undefined);
          options.onInvalidFormula?.();
        },
        // Pass data service for internal use
        dataService: this._dataService,
      },
    });
  }

  /**
   * Unmount the spreadsheet UI.
   */
  unmount(): void {
    if (this._mountedComponent) {
      unmount(this._mountedComponent);
      this._mountedComponent = null;
      this._mountContainer = null;
    }
  }

  isMounted(): boolean {
    return this._mountedComponent !== null;
  }

  getMountContainer(): HTMLElement | null {
    return this._mountContainer;
  }

  /**
   * Initialize offscreen canvas for headless rendering (no mounted UI).
   */
  async initOffscreen(canvas: HTMLCanvasElement): Promise<void> {
    if ("transferControlToOffscreen" in canvas) {
      const offscreen = canvas.transferControlToOffscreen();
      await this._dataService.initOffscreen(offscreen, this._canvasId);
    }
  }

  /**
   * Destroy this view. Does NOT terminate the shared worker — that belongs
   * to the Engine.
   */
  destroy(): void {
    this.unmount();
    this._listeners.forEach((set) => set.clear());
    this._host.releaseSession(this);
  }

  // ========================================================================
  // Event Handling (per-view)
  // ========================================================================

  on<T extends SessionEventType>(
    type: T,
    callback: SessionEventCallback<T>,
  ): void {
    this._listeners.get(type)?.add(callback);
  }

  off<T extends SessionEventType>(
    type: T,
    callback: SessionEventCallback<T>,
  ): void {
    this._listeners.get(type)?.delete(callback);
  }

  private _emit<T extends SessionEventType>(
    type: T,
    data: SessionEventMap[T],
  ): void {
    this._listeners.get(type)?.forEach((cb) => cb(data));
  }

  // ========================================================================
  // File / Render
  // ========================================================================

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
  async loadFile(buffer: Uint8Array, filename: string): Promise<Grid | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mounted = this._mountedComponent as any;
    if (mounted && typeof mounted.loadWorkbook === "function") {
      await mounted.loadWorkbook(buffer, filename);
      return this._grid;
    }
    const result = await this._dataService.loadWorkbook(
      buffer,
      filename,
      this._canvasId,
    );
    if (isErrorMessage(result)) {
      this._emit("error", new Error(result.msg));
      return null;
    }
    this._grid = result;
    this._emit("gridChange", result);
    return result;
  }

  /**
   * Render the spreadsheet. When UI is mounted, rendering is handled
   * automatically by the component.
   */
  async render(anchorX = 0, anchorY = 0): Promise<Grid | null> {
    const sheetId = this._dataService.getSheetIdByIdx(this._currentSheetIdx);
    const result = await this._dataService.render(
      sheetId,
      anchorX,
      anchorY,
      this._canvasId,
    );
    if (isErrorMessage(result)) {
      this._emit("error", new Error(result.msg));
      return null;
    }
    this._grid = result;
    this._emit("gridChange", result);
    return result;
  }

  /**
   * Resize the canvas. When UI is mounted, resizing is handled automatically.
   */
  async resize(width: number, height: number): Promise<Grid | null> {
    const result = await this._dataService.resize(
      width,
      height,
      window.devicePixelRatio,
      this._canvasId,
    );
    if (isErrorMessage(result)) {
      this._emit("error", new Error(result.msg));
      return null;
    }
    this._grid = result;
    this._emit("gridChange", result);
    return result;
  }

  // ========================================================================
  // State Accessors
  // ========================================================================

  getGrid(): Grid | null {
    return this._grid;
  }

  getSelection(): SelectedData {
    return this._selectedData;
  }

  setSelection(selection: SelectedData): void {
    this._selectedData = selection;
    this._emit("selectionChange", selection);
    // Push the new value into the mounted Svelte component so its selector
    // overlay re-renders and its auto-scroll $effect fires. Without this
    // delegation, the engine's internal state and the canvas-side state
    // diverge.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mounted = this._mountedComponent as any;
    if (mounted && typeof mounted.setSelectedData === "function") {
      mounted.setSelectedData(selection);
    }
  }

  getCurrentSheetIndex(): number {
    return this._currentSheetIdx;
  }

  setCurrentSheetIndex(index: number): void {
    this._currentSheetIdx = index;
    // Keep the data service's legacy "active view" pointer in sync — but
    // only for the primary view, so a secondary view switching its own sheet
    // doesn't clobber what app-level consumers (toolbar, edit bar) read.
    if (this._isPrimary) {
      this._dataService.setCurrentSheetIdx(index);
    }
    // When the UI is mounted, delegate to the Spreadsheet component's own
    // setActiveSheet so it can refresh its internal grid state (and thus
    // column/row headers and overlays).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mounted = this._mountedComponent as any;
    if (mounted && typeof mounted.setActiveSheet === "function") {
      mounted.setActiveSheet(index);
    }
    this._emit("activeSheetChange", index);
  }

  /** Cached sheet info (shared, read through the host). */
  getSheets(): readonly SheetInfo[] {
    return this._host.getSheets();
  }

  getConfig(): EngineConfig {
    return this._config;
  }
}

export default Session;
