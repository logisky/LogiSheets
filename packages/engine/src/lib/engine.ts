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

import type { SheetInfo, SelectedData, CellLayout } from "logisheets-web";
import { isErrorMessage } from "logisheets-web";
import { DataService } from "./clients/service";
import { WorkbookClient } from "./clients/workbook";
import { BlockManager } from "./block";
import type { Grid, EngineConfig } from "$types/index";
import { DEFAULT_ENGINE_CONFIG } from "$types/index";
import { Session } from "./session";
import type {
  SessionHost,
  SessionMountOptions,
  SessionEventType,
  SessionEventMap,
} from "./session";
// Import the worker INLINED (base64 blob) rather than as a separate asset.
// A separate worker chunk is emitted with an absolute `/assets/worker-*.js`
// URL, which only resolves when the host statically serves the engine's dist
// at the web root. Inlining makes the published bundle self-contained, so any
// consumer (Vite / webpack / Angular / plain script) boots the engine with no
// asset-copying or base-path configuration. (The WASM is already inlined.)
import MyWorker from "./worker/worker.ts?worker&inline";

/** Workbook-level events, shared across all views. */
export type EngineEventType = "ready" | "sheetChange" | "cellChange" | "error";

export interface EngineEventMap {
  ready: void;
  sheetChange: readonly SheetInfo[];
  cellChange: void;
  error: Error;
}

type EventCallback<T extends EngineEventType> = (
  data: EngineEventMap[T],
) => void;

/** Session-scoped event names, forwarded by the legacy on()/off() surface. */
const SESSION_EVENT_TYPES: readonly SessionEventType[] = [
  "selectionChange",
  "gridChange",
  "activeSheetChange",
  "startEdit",
  "invalidFormula",
  "error",
];

function isSessionEvent(type: string): type is SessionEventType {
  return (SESSION_EVENT_TYPES as readonly string[]).includes(type);
}

/** @deprecated Use {@link SessionMountOptions}. Kept as an alias. */
export type EngineMountOptions = SessionMountOptions;

export class Engine {
  private _dataService: DataService;
  private _worker: Worker;
  private _blockManager: BlockManager;
  private _config: EngineConfig;
  private _ready = false;
  private _sheets: readonly SheetInfo[] = [];

  // Per-view sessions sharing this engine's worker/workbook.
  private _sessions: Set<Session> = new Set();
  // Lazily-created default session backing the legacy per-view API.
  private _defaultSession: Session | null = null;

  // Workbook-level event listeners.
  private _listeners: Map<EngineEventType, Set<EventCallback<any>>> = new Map();

  constructor(config?: Partial<EngineConfig>) {
    this._config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this._blockManager = new BlockManager();

    (
      ["ready", "sheetChange", "cellChange", "error"] as EngineEventType[]
    ).forEach((type) => {
      this._listeners.set(type, new Set());
    });

    // Create worker immediately using the bundled inline worker
    this._worker = new MyWorker();

    // Create data service immediately
    this._dataService = new DataService(this._worker);

    // Push the initial gridline visibility to the worker so a non-default
    // config is honored from the first render (the worker defaults to
    // showing both, matching DEFAULT_ENGINE_CONFIG).
    this._dataService.setShowGridLines(
      this._config.showHorizontalGridLines,
      this._config.showVerticalGridLines,
    );

    // Auto-stamp schema ref names from `bindFormSchema` payloads onto
    // the host-side FieldManager so the block-interface widgets can
    // include refName in edit-bus events. Crafts just send the payload
    // as usual — they don't need to register the refName twice.
    //
    // The payload carries sheetIdx; FieldManager keys by sheetId, so we
    // resolve through the data service's cached sheet info.
    this._dataService.getWorkbook().registerPayloadObserver((payload) => {
      if (
        payload &&
        typeof payload === "object" &&
        payload.type === "bindFormSchema"
      ) {
        const v = payload.value;
        if (!v) return;
        const sheets = this._dataService.getCacheAllSheetInfo();
        const sheet = sheets[v.sheetIdx];
        if (!sheet) return;
        this._blockManager.fieldManager.setBlockRefName(
          sheet.id,
          v.blockId,
          v.refName,
        );
      }
    });

    // Register shared callbacks
    this._dataService.registerCellUpdatedCallback(() => {
      this._sheets = this._dataService.getCacheAllSheetInfo();
      this._emit("cellChange", undefined);
      this._emit("sheetChange", this._sheets);
    });

    this._dataService.registerSheetUpdatedCallback(() => {
      this._sheets = this._dataService.getCacheAllSheetInfo();
      this._emit("sheetChange", this._sheets);
    });

    // Mark as ready once the worker is initialized
    this._dataService
      .getWorkbook()
      .getAllSheetInfo()
      .then((result) => {
        if (!isErrorMessage(result)) {
          this._sheets = result;
        }
        this._ready = true;
        this._emit("ready", undefined);
      });
  }

  // ========================================================================
  // Session factory
  // ========================================================================

  /**
   * Create a new view (Session) backed by this engine's shared worker and
   * workbook. The caller owns the returned Session and decides where it
   * lives (component state, store, context, …). Mount it with
   * `session.mount(container)`.
   */
  createSession(): Session {
    const host: SessionHost = {
      getSheets: () => this._sheets,
      notifySheetsChange: (sheets) => {
        this._sheets = sheets;
        this._emit("sheetChange", sheets);
      },
      releaseSession: (session) => {
        this._sessions.delete(session);
        if (this._defaultSession === session) {
          this._defaultSession = null;
        }
      },
    };
    const session = new Session(this._dataService, this._config, host);
    this._sessions.add(session);
    return session;
  }

  /**
   * Lazily-created default session that backs the legacy per-view methods on
   * Engine (mount/setSelection/render/…). Most single-window callers never
   * touch this directly.
   */
  getDefaultSession(): Session {
    if (!this._defaultSession) {
      this._defaultSession = this.createSession();
      this._defaultSession.markPrimary();
    }
    return this._defaultSession;
  }

  // ========================================================================
  // Legacy per-view API (delegates to the default session)
  // ========================================================================

  mount(container: HTMLElement, options: SessionMountOptions = {}): void {
    this.getDefaultSession().mount(container, options);
  }

  unmount(): void {
    this._defaultSession?.unmount();
  }

  isMounted(): boolean {
    return this._defaultSession?.isMounted() ?? false;
  }

  getMountContainer(): HTMLElement | null {
    return this._defaultSession?.getMountContainer() ?? null;
  }

  async initOffscreen(canvas: HTMLCanvasElement): Promise<void> {
    return this.getDefaultSession().initOffscreen(canvas);
  }

  async loadFile(buffer: Uint8Array, filename: string): Promise<Grid | null> {
    this._ensureReady();
    return this.getDefaultSession().loadFile(buffer, filename);
  }

  async render(anchorX = 0, anchorY = 0): Promise<Grid | null> {
    this._ensureReady();
    return this.getDefaultSession().render(anchorX, anchorY);
  }

  async resize(width: number, height: number): Promise<Grid | null> {
    this._ensureReady();
    return this.getDefaultSession().resize(width, height);
  }

  getGrid(): Grid | null {
    return this._defaultSession?.getGrid() ?? null;
  }

  getSelection(): SelectedData {
    return this._defaultSession?.getSelection() ?? { source: "none" };
  }

  setSelection(selection: SelectedData): void {
    this.getDefaultSession().setSelection(selection);
  }

  getCurrentSheetIndex(): number {
    return this._defaultSession?.getCurrentSheetIndex() ?? 0;
  }

  setCurrentSheetIndex(index: number): void {
    this._ensureReady();
    this.getDefaultSession().setCurrentSheetIndex(index);
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Destroy the engine: tear down every session and terminate the worker.
   */
  destroy(): void {
    // Snapshot first: Session.destroy() calls back into releaseSession,
    // which mutates _sessions.
    [...this._sessions].forEach((s) => s.destroy());
    this._sessions.clear();
    this._defaultSession = null;
    if (this._worker) {
      this._worker.terminate();
    }
    this._ready = false;
    this._listeners.forEach((set) => set.clear());
  }

  // ========================================================================
  // Event Handling (workbook-level)
  // ========================================================================

  /**
   * Subscribe to an event. Workbook-level events (ready/sheetChange/
   * cellChange) are handled by the Engine; per-view events (selectionChange/
   * gridChange/activeSheetChange/startEdit/invalidFormula) are forwarded to
   * the default session for backwards compatibility. `error` fires for both.
   */
  on<T extends EngineEventType | SessionEventType>(
    type: T,
    callback: T extends EngineEventType
      ? EventCallback<T & EngineEventType>
      : (data: SessionEventMap[T & SessionEventType]) => void,
  ): void {
    if (this._listeners.has(type as EngineEventType)) {
      this._listeners.get(type as EngineEventType)?.add(callback as any);
    }
    if (isSessionEvent(type)) {
      this.getDefaultSession().on(type, callback as any);
    }
  }

  off<T extends EngineEventType | SessionEventType>(
    type: T,
    callback: T extends EngineEventType
      ? EventCallback<T & EngineEventType>
      : (data: SessionEventMap[T & SessionEventType]) => void,
  ): void {
    this._listeners.get(type as EngineEventType)?.delete(callback as any);
    if (isSessionEvent(type)) {
      this._defaultSession?.off(type, callback as any);
    }
  }

  private _emit<T extends EngineEventType>(
    type: T,
    data: EngineEventMap[T],
  ): void {
    this._listeners.get(type)?.forEach((cb) => cb(data));
  }

  // ========================================================================
  // Core Accessors (the original logisheets-web API)
  // ========================================================================

  /**
   * Get the workbook client for all workbook operations.
   * This provides access to the original logisheets-web API.
   */
  getWorkbook(): WorkbookClient {
    return this._dataService.getWorkbook();
  }

  /**
   * Get the data service for rendering operations.
   */
  getDataService(): DataService {
    return this._dataService;
  }

  /**
   * Get the block manager for field/enum management.
   */
  getBlockManager(): BlockManager {
    return this._blockManager;
  }

  // ========================================================================
  // Shared State Accessors
  // ========================================================================

  /**
   * Get cached sheet info.
   */
  getSheets(): readonly SheetInfo[] {
    return this._sheets;
  }

  /**
   * Get engine configuration.
   */
  getConfig(): EngineConfig {
    return this._config;
  }

  /**
   * Check if engine is ready.
   */
  isReady(): boolean {
    return this._ready;
  }

  // ========================================================================
  // Display Settings
  // ========================================================================

  /**
   * Show or hide the default cell gridlines across every view of this
   * workbook. Updates the shared config and re-renders all mounted views.
   */
  async setShowGridLines(show: boolean): Promise<void> {
    this._config.showHorizontalGridLines = show;
    this._config.showVerticalGridLines = show;
    this._dataService.setShowGridLines(show, show);
    await Promise.all(
      [...this._sessions].map((s) =>
        s.getGrid() ? s.render() : Promise.resolve(null),
      ),
    );
  }

  // ========================================================================
  // Private
  // ========================================================================

  private _ensureReady(): void {
    if (!this._ready) {
      throw new Error("Engine is not ready. Wait for the 'ready' event.");
    }
  }
}

// Default export for convenience
export default Engine;
