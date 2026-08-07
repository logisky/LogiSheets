// Enterprise integration for the headless runtime (logisheets-enterprise
// RUNTIME_CHANGES.md). One runtime process that:
//
//   1. registers with the control panel on startup and gets back registry
//      creds + its runtimeId (§2.2),
//   2. exposes its own RPC the control panel dials (§2.3):
//        POST /pin   {wbUrl}                    → load + keep resident (serving)
//        POST /unpin {wbId}                     → release
//        POST /task  {workbookUrl, rpcCall, params} → one-shot (extract/what-if)
//        GET  /status                            → pins + load
//   3. pulls crafts from the enterprise registry using those creds (§2.5).
//
// Transport + lifecycle live here; the actual business RPCs (extractIndicators,
// what-if compute) are registered as task handlers by the consumer, since they
// depend on the merged data-gateway craft + engine cell ops (DATA_GATEWAY_CHANGES).

import {
    createServer,
    type Server,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http'
import type {AddressInfo} from 'node:net'
import {SpreadsheetRuntime, type Workbook} from './index.js'
import {
    loadCrafts,
    runCraftExchange,
    type CraftRegistry,
    type LoadedCraft,
} from './craft.js'
import {WorkbookWatcher} from './watcher.js'
import type {CraftManifest, JsonRpcRequest} from 'logisheets-core'

// ── Control-plane client (§2.2) ──────────────────────────────────────────────

export interface ControlPlaneOptions {
    /** Base URL of the enterprise control panel, e.g. http://cp.internal:3000 */
    controlPlaneUrl: string
    /** Shared secret presented as Bearer to CP-facing endpoints. Optional (dev). */
    secret?: string
}

export interface RegisterResult {
    runtimeId: string
    registryUrl: string | null
    registryToken: string | null
}

export interface AccessEvent {
    wbStringId?: string
    version?: string
    caller?: string
    method?: string
}

export class ControlPlaneClient {
    constructor(private readonly opts: ControlPlaneOptions) {}

    private headers(): Record<string, string> {
        return {
            'content-type': 'application/json',
            ...(this.opts.secret
                ? {authorization: `Bearer ${this.opts.secret}`}
                : {}),
        }
    }

    private url(path: string): string {
        return `${this.opts.controlPlaneUrl.replace(/\/$/, '')}${path}`
    }

    async register(input: {
        address: string
        name?: string
        mode?: 'serving' | 'ephemeral' | 'both'
        capacity?: number
        id?: string
    }): Promise<RegisterResult> {
        const res = await fetch(this.url('/api/runtimes/register'), {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(input),
        })
        if (!res.ok) throw new Error(`register failed: ${res.status}`)
        return (await res.json()) as RegisterResult
    }

    async heartbeat(runtimeId: string): Promise<void> {
        await fetch(this.url(`/api/runtimes/${runtimeId}/heartbeat`), {
            method: 'POST',
            headers: this.headers(),
        }).catch(() => {})
    }

    async ingest(
        runtimeId: string,
        accessEvents: AccessEvent[]
    ): Promise<void> {
        if (accessEvents.length === 0) return
        await fetch(this.url('/api/ingest'), {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({runtimeId, accessEvents}),
        }).catch(() => {})
    }
}

// ── Enterprise craft registry (§2.5) ─────────────────────────────────────────

// Pulls craft manifests + runtime modules from the enterprise registry using
// the creds handed back at registration. Best-effort import via a data: URL
// (works for self-contained ESM bundles; host-SDK externals must be provided by
// the runtime's own module resolution). TODO: tarball unpack + external mapping
// to match craft-registry's bundle format.
export class HttpCraftRegistry implements CraftRegistry {
    constructor(
        private readonly registryUrl: string,
        private readonly token: string | null
    ) {}

    private headers(): Record<string, string> {
        return this.token ? {'x-api-key': this.token} : {}
    }

    async getManifest(craftId: string): Promise<CraftManifest | undefined> {
        const res = await fetch(
            `${this.registryUrl.replace(
                /\/$/,
                ''
            )}/api/craft/${encodeURIComponent(craftId)}`,
            {headers: this.headers()}
        ).catch(() => undefined)
        if (!res || !res.ok) return undefined
        const body = (await res.json()) as {
            logisheets?: {runtime?: string; html?: string}
            manifest?: CraftManifest
        }
        if (body.manifest) return body.manifest
        // Map the registry's `logisheets` metadata to the manifest shape.
        const rtJs = body.logisheets?.runtime
        if (!rtJs) return undefined
        return {rtJs, html: body.logisheets?.html ?? ''}
    }

    async importRuntime(
        _craftId: string,
        manifest: CraftManifest
    ): Promise<unknown | undefined> {
        if (!manifest.rtJs) return undefined
        // manifest.rtJs is expected to be a fetchable URL to the runtime bundle.
        const res = await fetch(manifest.rtJs, {headers: this.headers()}).catch(
            () => undefined
        )
        if (!res || !res.ok) return undefined
        const code = await res.text()
        const dataUrl = `data:text/javascript;base64,${Buffer.from(
            code
        ).toString('base64')}`
        try {
            return await import(dataUrl)
        } catch {
            return undefined
        }
    }
}

// ── Task handlers ────────────────────────────────────────────────────────────

/** Context handed to a task handler: the loaded workbook + its crafts. */
export interface TaskContext {
    readonly workbook: Workbook
    readonly crafts: readonly LoadedCraft[]
    readonly params: unknown
}

/** A task handler runs one `rpcCall` against an ephemerally-loaded workbook. */
export type TaskHandler = (ctx: TaskContext) => unknown | Promise<unknown>

/**
 * The standard `compute` task handler: drive the workbook's loaded crafts
 * through one JSON-RPC exchange (see {@link runCraftExchange}). Generic and
 * craft-agnostic — the crafts loaded from the workbook's AppData define what
 * "compute" does via their `onRequest`/`onResponse`; a runtime serving craft
 * workbooks uses this instead of hand-writing the exchange. `ctx.params` is
 * forwarded verbatim as the request params (e.g. `{inputs}`) and the JSON-RPC
 * response envelope is returned.
 */
export const craftComputeHandler: TaskHandler = (ctx) => {
    const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'compute',
        params: ctx.params,
    }
    return runCraftExchange(ctx.crafts, ctx.workbook, req)
}

// ── Enterprise runtime server (§2.3) ─────────────────────────────────────────

export interface EnterpriseServerOptions {
    runtime: SpreadsheetRuntime
    /** Registry to load crafts from. Set after registration via {@link setRegistry}. */
    registry?: CraftRegistry
    /** Shared secret the control panel presents (Bearer). Open when unset. */
    secret?: string
    /** rpcCall → handler (e.g. extractIndicators, compute). */
    taskHandlers?: Record<string, TaskHandler>
}

/**
 * A framework-neutral view of an incoming HTTP request. Lets a non-Node host
 * (e.g. a Cloudflare Worker `fetch` handler) drive {@link
 * EnterpriseRuntimeServer.handleRequest} without Node's `IncomingMessage`.
 * `body` is the ALREADY-PARSED JSON body (POST only; the host owns parsing).
 */
export interface RuntimeHttpRequest {
    method: string
    /** URL pathname, e.g. `/task`. */
    path: string
    /** The `Authorization` header value, for the shared-secret gate. */
    authorization?: string
    body?: unknown
}

/** The framework-neutral result of {@link EnterpriseRuntimeServer.handleRequest};
 *  a `body` of `undefined` means "no content" (write just the status). */
export interface RuntimeHttpResponse {
    status: number
    body?: unknown
}

export class EnterpriseRuntimeServer {
    private readonly runtime: SpreadsheetRuntime
    private registry?: CraftRegistry
    private readonly secret?: string
    private readonly handlers = new Map<string, TaskHandler>()
    // Resident (pinned) workbooks, keyed by the engine's numeric id as a string.
    private readonly pins = new Map<string, Workbook>()
    private server?: Server

    constructor(opts: EnterpriseServerOptions) {
        this.runtime = opts.runtime
        this.registry = opts.registry
        this.secret = opts.secret
        // Ship a generic `compute` by default so a craft-serving runtime needs
        // no bespoke handler; anything in opts.taskHandlers can override it.
        this.handlers.set('compute', craftComputeHandler)
        for (const [name, h] of Object.entries(opts.taskHandlers ?? {}))
            this.handlers.set(name, h)
    }

    setRegistry(registry: CraftRegistry): void {
        this.registry = registry
    }

    registerTask(name: string, handler: TaskHandler): this {
        this.handlers.set(name, handler)
        return this
    }

    listen(port: number, host = '0.0.0.0'): Promise<AddressInfo> {
        if (this.server) throw new Error('server already listening')
        const server = createServer((req, res) => void this.onRequest(req, res))
        this.server = server
        return new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, host, () => {
                server.removeListener('error', reject)
                resolve(server.address() as AddressInfo)
            })
        })
    }

    close(): Promise<void> {
        const server = this.server
        if (!server) return Promise.resolve()
        this.server = undefined
        return new Promise((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        )
    }

    private authOk(authorization: string | undefined): boolean {
        if (!this.secret) return true
        return authorization === `Bearer ${this.secret}`
    }

    /**
     * Transport-agnostic request handler: the `/pin` · `/unpin` · `/task` ·
     * `/status` routing with NO dependency on Node's http types. The Node
     * server ({@link onRequest}) routes through this, and so can any other host
     * — e.g. a Cloudflare Worker, which cannot use {@link listen} (Workers have
     * no listening socket; they're `fetch`-driven):
     *
     * ```ts
     * export default {
     *   async fetch(request: Request) {
     *     const url = new URL(request.url)
     *     const body =
     *       request.method === 'POST' ? await request.json() : undefined
     *     const {status, body: out} = await server.handleRequest({
     *       method: request.method,
     *       path: url.pathname,
     *       authorization: request.headers.get('authorization') ?? undefined,
     *       body,
     *     })
     *     return out === undefined
     *       ? new Response(null, {status})
     *       : Response.json(out, {status})
     *   },
     * }
     * ```
     */
    public async handleRequest(
        req: RuntimeHttpRequest
    ): Promise<RuntimeHttpResponse> {
        if (req.method === 'GET' && req.path === '/status') {
            if (!this.authOk(req.authorization))
                return {status: 403, body: {error: 'forbidden'}}
            return {
                status: 200,
                body: {
                    pins: [...this.pins.keys()],
                    open: this.runtime.workbooks.length,
                },
            }
        }
        if (req.method !== 'POST') return {status: 405}
        if (!this.authOk(req.authorization))
            return {status: 403, body: {error: 'forbidden'}}
        const body = req.body ?? {}
        try {
            if (req.path === '/pin')
                return {
                    status: 200,
                    body: await this.pin(body as {wbUrl?: string}),
                }
            if (req.path === '/unpin')
                return {status: 200, body: this.unpin(body as {wbId?: string})}
            if (req.path === '/task')
                return {
                    status: 200,
                    body: await this.task(
                        body as {
                            workbookUrl?: string
                            rpcCall?: string
                            params?: unknown
                        }
                    ),
                }
            return {status: 404, body: {error: 'not found'}}
        } catch (e) {
            return {
                status: 500,
                body: {error: e instanceof Error ? e.message : String(e)},
            }
        }
    }

    private async loadFromUrl(url: string): Promise<Workbook> {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`fetch workbook failed: ${res.status}`)
        const bytes = new Uint8Array(await res.arrayBuffer())
        const wb = this.runtime.loadWorkbookFromBytes(bytes, nameFromUrl(url))
        if (this.registry) await loadCrafts(wb, this.registry)
        return wb
    }

    // Node http transport: parse the request into a framework-neutral shape,
    // route it through {@link handleRequest}, and write the result back. All
    // routing/auth lives in handleRequest so non-Node hosts share it verbatim.
    private async onRequest(
        req: IncomingMessage,
        res: ServerResponse
    ): Promise<void> {
        try {
            const body =
                req.method === 'POST'
                    ? JSON.parse((await readBody(req)) || '{}')
                    : undefined
            const out = await this.handleRequest({
                method: req.method ?? 'GET',
                path: req.url ?? '/',
                authorization: req.headers.authorization,
                body,
            })
            if (out.body === undefined)
                return void res.writeHead(out.status).end()
            json(res, out.status, out.body)
        } catch (e) {
            json(res, 500, {error: e instanceof Error ? e.message : String(e)})
        }
    }

    // Load a workbook and keep it resident (= serving it).
    private async pin(body: {wbUrl?: string}): Promise<{wbId: string}> {
        if (!body.wbUrl) throw new Error('wbUrl required')
        const wb = await this.loadFromUrl(body.wbUrl)
        const wbId = String(wb.id)
        this.pins.set(wbId, wb)
        return {wbId}
    }

    private unpin(body: {wbId?: string}): {ok: true} {
        if (!body.wbId) throw new Error('wbId required')
        const wb = this.pins.get(body.wbId)
        if (wb) {
            this.runtime.close(wb)
            this.pins.delete(body.wbId)
        }
        return {ok: true}
    }

    // One-shot: load → run handler → release (ephemeral, workbookless).
    private async task(body: {
        workbookUrl?: string
        rpcCall?: string
        params?: unknown
    }): Promise<unknown> {
        if (!body.workbookUrl || !body.rpcCall)
            throw new Error('workbookUrl and rpcCall required')
        const handler = this.handlers.get(body.rpcCall)
        if (!handler) throw new Error(`unknown rpcCall: ${body.rpcCall}`)
        const wb = await this.loadFromUrl(body.workbookUrl)
        try {
            const crafts = this.registry
                ? await loadCrafts(wb, this.registry)
                : []
            return await handler({workbook: wb, crafts, params: body.params})
        } finally {
            this.runtime.close(wb)
        }
    }
}

// ── Orchestration ────────────────────────────────────────────────────────────

export interface EnterpriseRuntimeOptions extends ControlPlaneOptions {
    /** Externally-reachable base URL of THIS runtime (control panel dials it). */
    address: string
    /** Port to listen on. Default 0 (OS-assigned; then set `address` accordingly). */
    port?: number
    host?: string
    name?: string
    mode?: 'serving' | 'ephemeral' | 'both'
    heartbeatMs?: number
    taskHandlers?: Record<string, TaskHandler>
    /**
     * Optional local-directory watcher (pull-based `wb_*.json` loading). **Off by
     * default** — the enterprise model is control-plane-driven (the panel pushes
     * via `/pin`), so this is only for standalone / hybrid setups that also want
     * the file-drop convention. Enable by giving it a directory to watch.
     */
    watch?: {dir: string; intervalMs?: number}
}

export interface EnterpriseRuntimeHandle {
    runtimeId: string
    address: AddressInfo
    server: EnterpriseRuntimeServer
    /** The local-dir watcher, if `watch` was enabled (§ opts.watch). */
    watcher?: WorkbookWatcher
    stop: () => Promise<void>
}

/**
 * Bring up an enterprise runtime: start the RPC server, register with the
 * control panel (getting registry creds), wire the craft registry, and begin
 * heartbeating. The control panel then dials this runtime for pin/task.
 */
export async function startEnterpriseRuntime(
    opts: EnterpriseRuntimeOptions
): Promise<EnterpriseRuntimeHandle> {
    const runtime = new SpreadsheetRuntime()
    const server = new EnterpriseRuntimeServer({
        runtime,
        secret: opts.secret,
        taskHandlers: opts.taskHandlers,
    })
    const address = await server.listen(opts.port ?? 0, opts.host)

    const client = new ControlPlaneClient(opts)
    const reg = await client.register({
        address: opts.address,
        name: opts.name,
        mode: opts.mode ?? 'both',
    })

    if (reg.registryUrl) {
        server.setRegistry(
            new HttpCraftRegistry(reg.registryUrl, reg.registryToken)
        )
    }

    const interval = setInterval(
        () => void client.heartbeat(reg.runtimeId),
        opts.heartbeatMs ?? 30_000
    )
    interval.unref?.()

    // Opt-in local-dir watcher (off by default; enterprise is pin-driven).
    let watcher: WorkbookWatcher | undefined
    if (opts.watch) {
        watcher = new WorkbookWatcher(runtime, opts.watch.dir, {
            intervalMs: opts.watch.intervalMs,
        })
        watcher.start()
    }

    return {
        runtimeId: reg.runtimeId,
        address,
        server,
        watcher,
        stop: async () => {
            clearInterval(interval)
            watcher?.stop()
            await server.close()
            runtime.closeAll()
        },
    }
}

function nameFromUrl(url: string): string {
    try {
        const last = new URL(url).pathname.split('/').filter(Boolean).pop()
        if (last) return decodeURIComponent(last)
    } catch {
        /* not a URL — fall through */
    }
    return 'workbook.xlsx'
}

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
    })
}

function json(res: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload)
    res.writeHead(status, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
    }).end(body)
}
