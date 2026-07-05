// Directory watcher: hot-(re)load workbooks from descriptor files.
//
// A host process drops small JSON descriptor files named `wb_*.json` into a
// watched directory, each naming a workbook by a stable *string* id, a version,
// and where to fetch its .xlsx — a local `path`, a `url`, or both:
//
//   { "id": "sales-2026", "version": 7, "path": "books/sales.xlsx" }
//   { "id": "sales-2026", "version": 7, "url": "https://host/books/sales.xlsx" }
//
// On a fixed interval (10s by default, configurable) the {@link WorkbookWatcher}
// scans the directory, and for every descriptor whose version differs from what
// it last loaded it (re)loads the workbook and swaps it in under that string id.
// This lets an external system publish new workbook revisions — bumping the
// version each time — and have the running runtime pick them up automatically.
//
// The string id namespace is the watcher's own, distinct from the engine's
// numeric {@link Workbook.id}; use {@link WorkbookWatcher.get} to resolve a
// string id to its currently-loaded live {@link Workbook}.

import {readFile, readdir} from 'node:fs/promises'
import {basename, isAbsolute, resolve} from 'node:path'
import type {SpreadsheetRuntime, Workbook} from './index.js'

/** The descriptor persisted in each `wb_*.json` file. */
export interface WorkbookDescriptor {
    /** Stable external string id for this workbook (the watcher's key). */
    id: string
    /**
     * Revision marker. Any change from the last-loaded value triggers a reload;
     * accepted as a number or string and compared as its string form.
     */
    version: number | string
    /**
     * Path to the .xlsx file. Absolute, or resolved relative to the watched
     * directory. Optional when {@link url} is given; if both are present,
     * `path` wins (local reads are cheaper).
     */
    path?: string
    /**
     * URL to fetch the .xlsx from (via `fetch`). Used when {@link path} is
     * absent. At least one of `path`/`url` must be present.
     */
    url?: string
}

/** Options for {@link WorkbookWatcher}. */
export interface WorkbookWatcherOptions {
    /** Poll interval in milliseconds. Default `10_000` (10s). */
    intervalMs?: number
    /**
     * Called after a workbook is (re)loaded and swapped in, with the string id,
     * the new live handle, and the descriptor that triggered the load.
     */
    onLoad?: (
        id: string,
        wb: Workbook,
        descriptor: WorkbookDescriptor
    ) => void
    /**
     * Called when a descriptor file can't be read, parsed, or loaded. The
     * previously-loaded workbook (if any) is left in place. `file` is the
     * descriptor's absolute path.
     */
    onError?: (file: string, err: unknown) => void
}

/** A workbook currently held by the watcher, plus the version it was loaded at. */
interface Entry {
    version: string
    wb: Workbook
    /** Absolute path the descriptor last pointed at. */
    source: string
}

/**
 * Polls a directory for `wb_*.json` descriptors and keeps the runtime's
 * workbooks in sync with them — loading new ones and replacing changed ones.
 *
 * ```ts
 * const rt = new SpreadsheetRuntime()
 * const watcher = new WorkbookWatcher(rt, './watch', {
 *     intervalMs: 10_000,
 *     onLoad: (id) => console.log('loaded', id),
 * })
 * watcher.start()
 * // ... later ...
 * const wb = watcher.get('sales-2026')
 * watcher.stop()
 * ```
 */
export class WorkbookWatcher {
    private readonly dir: string
    private readonly intervalMs: number
    private readonly loaded = new Map<string, Entry>()
    private timer?: ReturnType<typeof setInterval>
    /** Guards against a slow scan overlapping the next interval tick. */
    private scanning = false

    public constructor(
        private readonly runtime: SpreadsheetRuntime,
        dir: string,
        private readonly options: WorkbookWatcherOptions = {}
    ) {
        this.dir = resolve(dir)
        this.intervalMs = options.intervalMs ?? 10_000
    }

    /**
     * Begin polling. Runs one scan immediately, then every `intervalMs`. The
     * interval is `unref`'d so it never keeps the process alive on its own.
     * Calling {@link start} while already running is a no-op.
     */
    public start(): void {
        if (this.timer !== undefined) return
        this.timer = setInterval(() => void this.scanOnce(), this.intervalMs)
        this.timer.unref?.()
        void this.scanOnce()
    }

    /** Stop polling. Loaded workbooks stay open — {@link close} them if needed. */
    public stop(): void {
        if (this.timer === undefined) return
        clearInterval(this.timer)
        this.timer = undefined
    }

    /** The live workbook currently loaded under `id`, if any. */
    public get(id: string): Workbook | undefined {
        return this.loaded.get(id)?.wb
    }

    /** The string ids of every workbook currently loaded by the watcher. */
    public get ids(): readonly string[] {
        return [...this.loaded.keys()]
    }

    /**
     * Run a single scan pass now: read every `wb_*.json` descriptor and reload
     * any whose version changed. Exposed for tests and manual triggering; the
     * interval calls it for you. Overlapping calls are skipped (a scan already
     * in flight wins), so this never runs two passes concurrently.
     */
    public async scanOnce(): Promise<void> {
        if (this.scanning) return
        this.scanning = true
        try {
            await this.scan()
        } finally {
            this.scanning = false
        }
    }

    private async scan(): Promise<void> {
        let files: string[]
        try {
            files = await readdir(this.dir)
        } catch (err) {
            this.options.onError?.(this.dir, err)
            return
        }
        for (const name of files) {
            if (!isDescriptorFile(name)) continue
            const file = resolve(this.dir, name)
            // eslint-disable-next-line no-await-in-loop
            await this.reconcile(file)
        }
    }

    /** Load-or-replace the workbook described by a single descriptor file. */
    private async reconcile(file: string): Promise<void> {
        let descriptor: WorkbookDescriptor
        try {
            descriptor = parseDescriptor(await readFile(file, 'utf8'))
        } catch (err) {
            this.options.onError?.(file, err)
            return
        }

        const version = String(descriptor.version)
        const prev = this.loaded.get(descriptor.id)
        if (prev && prev.version === version) return // unchanged — nothing to do

        // Fetch the bytes and load a fresh handle directly, bypassing
        // SpreadsheetRuntime.loadWorkbook's path-dedup: a new version usually
        // reuses the same source with changed content, so the dedup cache would
        // hand back the stale handle. Load the new one first, then swap and
        // release the old — on failure the old workbook is left untouched.
        let loaded: {wb: Workbook; source: string}
        try {
            loaded = await this.load(descriptor)
        } catch (err) {
            this.options.onError?.(file, err)
            return
        }

        this.loaded.set(descriptor.id, {version, ...loaded})
        if (prev) this.runtime.close(prev.wb)
        this.options.onLoad?.(descriptor.id, loaded.wb, descriptor)
    }

    /**
     * Fetch a descriptor's .xlsx bytes — from its local {@link
     * WorkbookDescriptor.path} if present, otherwise its {@link
     * WorkbookDescriptor.url} — and load a fresh workbook. Only the local-path
     * source records a `path` on the handle (a URL isn't a filesystem path).
     */
    private async load(
        d: WorkbookDescriptor
    ): Promise<{wb: Workbook; source: string}> {
        if (d.path !== undefined) {
            const source = isAbsolute(d.path)
                ? d.path
                : resolve(this.dir, d.path)
            const content = await readFile(source)
            const wb = this.runtime.loadWorkbookFromBytes(
                content,
                basename(source),
                source
            )
            return {wb, source}
        }
        // d.url is guaranteed present by parseDescriptor when path is absent.
        const url = d.url as string
        const res = await fetch(url)
        if (!res.ok)
            throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`)
        const content = new Uint8Array(await res.arrayBuffer())
        const wb = this.runtime.loadWorkbookFromBytes(content, nameFromUrl(url))
        return {wb, source: url}
    }
}

/** True for descriptor file names — `wb_*.json`. */
function isDescriptorFile(name: string): boolean {
    return /^wb_.*\.json$/i.test(name)
}

/** Parse and validate a descriptor's JSON text, throwing on a bad shape. */
function parseDescriptor(text: string): WorkbookDescriptor {
    const raw = JSON.parse(text) as unknown
    if (typeof raw !== 'object' || raw === null)
        throw new Error('descriptor must be a JSON object')
    const {id, version, path, url} = raw as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0)
        throw new Error('descriptor.id must be a non-empty string')
    if (typeof version !== 'string' && typeof version !== 'number')
        throw new Error('descriptor.version must be a string or number')
    if (path !== undefined && (typeof path !== 'string' || path.length === 0))
        throw new Error('descriptor.path, if present, must be a non-empty string')
    if (url !== undefined && (typeof url !== 'string' || url.length === 0))
        throw new Error('descriptor.url, if present, must be a non-empty string')
    if (path === undefined && url === undefined)
        throw new Error('descriptor must have a `path` or a `url`')
    return {id, version, path, url}
}

/** Derive a workbook file name from a URL, falling back to a generic name. */
function nameFromUrl(url: string): string {
    try {
        const last = new URL(url).pathname.split('/').filter(Boolean).pop()
        if (last) return decodeURIComponent(last)
    } catch {
        /* not a parseable URL — fall through */
    }
    return 'workbook.xlsx'
}
