/* eslint-disable @typescript-eslint/no-explicit-any */
// A tiny, dependency-free JSON-RPC 2.0 server for the runtime.
//
// The framework here is generic: it owns the wire protocol (HTTP + JSON-RPC
// 2.0 envelope, dispatch, error mapping) but knows nothing about which methods
// exist. Developers define their own RPC methods — the params and the body are
// theirs — where the body reads/writes workbooks through the injected
// {@link SpreadsheetRuntime}. They `register()` each method, then `listen()`.
//
//   const rt = new SpreadsheetRuntime()
//   const server = new RpcServer(rt)
//   server.register('openSheet', async ({path}, {runtime}) => {
//       const wb = await runtime.loadWorkbook(path)
//       return {sheets: await wb.client.getAllSheetInfo()}
//   })
//   server.register('readCell', (p, {runtime}) => {
//       const wb = runtime.workbooks.find((w) => w.path === p.path)
//       if (!wb) throw new RpcError(RPC_INVALID_PARAMS, 'workbook not loaded')
//       return wb.getValue(p.sheet, p.row, p.col)
//   })
//   const addr = await server.listen(3000)

import {
    createServer,
    type Server,
    type IncomingMessage,
    type ServerResponse,
} from 'node:http'
import type {AddressInfo} from 'node:net'
import type {SpreadsheetRuntime, Workbook} from './index.js'

// Standard JSON-RPC 2.0 error codes. Developers can also throw {@link RpcError}
// with their own (positive) application codes.
export const RPC_PARSE_ERROR = -32700
export const RPC_INVALID_REQUEST = -32600
export const RPC_METHOD_NOT_FOUND = -32601
export const RPC_INVALID_PARAMS = -32602
export const RPC_INTERNAL_ERROR = -32603

/** Context handed to every RPC method: the runtime that owns the workbooks. */
export interface RpcContext {
    readonly runtime: SpreadsheetRuntime
    /** The raw HTTP request, for headers/auth if a method needs it. */
    readonly request: IncomingMessage
}

/**
 * A developer-defined RPC method. Receives the request's `params` and a
 * {@link RpcContext}, and returns (sync or async) the result to serialize back.
 * Throw {@link RpcError} to return a structured JSON-RPC error.
 */
export type RpcMethod<P = any, R = unknown> = (
    params: P,
    ctx: RpcContext
) => R | Promise<R>

/** Picks (or creates/loads) the workbook a mutation method operates on. */
export type WorkbookResolver<P = any> = (
    params: P,
    ctx: RpcContext
) => Workbook | Promise<Workbook>

/** The body of a mutation method, run against the resolved workbook. */
export type MutationRun<P = any, R = unknown> = (
    workbook: Workbook,
    params: P,
    ctx: RpcContext
) => R | Promise<R>

export interface MutationOptions {
    /**
     * Whether changes are persisted when the caller omits the `save` flag from
     * the request params. Defaults to `true`.
     */
    saveByDefault?: boolean
}

/**
 * Reserved request param read by {@link RpcServer.registerMutation}: a boolean
 * deciding whether the call's changes are kept (`true`) or rolled back
 * (`false`). Either way the workbook's history is cleaned afterwards.
 */
export const SAVE_PARAM = 'save'

/** Throw this from a method to return a specific JSON-RPC error to the caller. */
export class RpcError extends Error {
    public readonly code: number
    public readonly data?: unknown
    public constructor(code: number, message: string, data?: unknown) {
        super(message)
        this.name = 'RpcError'
        this.code = code
        this.data = data
    }
}

interface JsonRpcRequest {
    jsonrpc: '2.0'
    id?: string | number | null
    method: string
    params?: unknown
}

interface JsonRpcError {
    code: number
    message: string
    data?: unknown
}

interface JsonRpcResponse {
    jsonrpc: '2.0'
    id: string | number | null
    result?: unknown
    error?: JsonRpcError
}

/**
 * JSON-RPC 2.0 server over HTTP. Construct with a {@link SpreadsheetRuntime},
 * {@link register} methods, then {@link listen}. All registered methods run
 * against that one runtime, so they share its open workbooks.
 */
export class RpcServer {
    public readonly runtime: SpreadsheetRuntime
    private readonly methods = new Map<string, RpcMethod>()
    private server?: Server

    public constructor(runtime: SpreadsheetRuntime) {
        this.runtime = runtime
    }

    /**
     * Register an RPC method. The name must be unique. Returns `this` so
     * registrations can be chained.
     */
    public register<P = any, R = unknown>(
        method: string,
        handler: RpcMethod<P, R>
    ): this {
        if (this.methods.has(method))
            throw new Error(`duplicate RPC method "${method}"`)
        this.methods.set(method, handler as RpcMethod)
        return this
    }

    /**
     * Register a *mutating* RPC method that reads/writes a workbook. The
     * framework wraps the body with a save lifecycle:
     *
     *  1. resolve the target workbook from the params (`target`),
     *  2. clear its history so the baseline is clean,
     *  3. run the body (`run`),
     *  4. read the boolean `{@link SAVE_PARAM}` from the params — if it is
     *     `false`, roll back every change the body made,
     *  5. clear the workbook's history again.
     *
     * So callers control persistence per call via a `save` param (default
     * {@link MutationOptions.saveByDefault}, itself defaulting to `true`), and
     * the workbook never accumulates history across requests either way.
     */
    public registerMutation<P = any, R = unknown>(
        method: string,
        target: WorkbookResolver<P>,
        run: MutationRun<P, R>,
        options: MutationOptions = {}
    ): this {
        const saveByDefault = options.saveByDefault ?? true
        return this.register<P, R | null>(method, async (params, ctx) => {
            const wb = await target(params, ctx)
            await wb.cleanHistory()
            const result = await run(wb, params, ctx)
            if (!readSaveFlag(params, saveByDefault)) await wb.discardChanges()
            await wb.cleanHistory()
            return result ?? null
        })
    }

    /** Whether a method name is registered. */
    public has(method: string): boolean {
        return this.methods.has(method)
    }

    /**
     * Start listening. Resolves with the bound address once the socket is open.
     * Defaults to loopback (`127.0.0.1`); pass `'0.0.0.0'` to accept external
     * connections. Use port `0` for an OS-assigned ephemeral port.
     */
    public listen(port: number, host = '127.0.0.1'): Promise<AddressInfo> {
        if (this.server) throw new Error('server already listening')
        const server = createServer((req, res) => this.onRequest(req, res))
        this.server = server
        return new Promise((resolve, reject) => {
            server.once('error', reject)
            server.listen(port, host, () => {
                server.removeListener('error', reject)
                resolve(server.address() as AddressInfo)
            })
        })
    }

    /** Stop listening. Does not close the runtime's workbooks. */
    public close(): Promise<void> {
        const server = this.server
        if (!server) return Promise.resolve()
        this.server = undefined
        return new Promise((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        )
    }

    private async onRequest(
        req: IncomingMessage,
        res: ServerResponse
    ): Promise<void> {
        if (req.method !== 'POST') {
            res.writeHead(405, {Allow: 'POST'}).end()
            return
        }

        let body: unknown
        try {
            body = JSON.parse(await readBody(req))
        } catch {
            return send(res, 200, {
                jsonrpc: '2.0',
                id: null,
                error: {code: RPC_PARSE_ERROR, message: 'parse error'},
            })
        }

        // A JSON-RPC batch is an array; a single call is an object.
        if (Array.isArray(body)) {
            if (body.length === 0) return send(res, 200, invalidRequest(null))
            const responses = (
                await Promise.all(body.map((m) => this.dispatch(m, req)))
            ).filter((r): r is JsonRpcResponse => r !== null)
            // All-notification batch -> no content per spec.
            if (responses.length === 0) return void res.writeHead(204).end()
            return send(res, 200, responses)
        }

        const response = await this.dispatch(body, req)
        if (response === null) return void res.writeHead(204).end()
        send(res, 200, response)
    }

    // Returns null for notifications (no `id`), which get no response.
    private async dispatch(
        msg: unknown,
        req: IncomingMessage
    ): Promise<JsonRpcResponse | null> {
        if (
            !isObject(msg) ||
            msg.jsonrpc !== '2.0' ||
            typeof msg.method !== 'string'
        ) {
            const id = isObject(msg) ? toId(msg.id) : null
            return invalidRequest(id)
        }
        const request = msg as unknown as JsonRpcRequest
        const isNotification = !('id' in msg) || msg.id === undefined
        const id = toId(request.id)

        const handler = this.methods.get(request.method)
        if (!handler) {
            return isNotification
                ? null
                : {
                      jsonrpc: '2.0',
                      id,
                      error: {
                          code: RPC_METHOD_NOT_FOUND,
                          message: `method not found: ${request.method}`,
                      },
                  }
        }

        try {
            const result = await handler(request.params, {
                runtime: this.runtime,
                request: req,
            })
            // JSON-RPC success responses must carry a `result` member;
            // `void` handlers return undefined, so normalize it to null.
            return isNotification
                ? null
                : {jsonrpc: '2.0', id, result: result ?? null}
        } catch (e) {
            if (isNotification) return null
            const error =
                e instanceof RpcError
                    ? {code: e.code, message: e.message, data: e.data}
                    : {
                          code: RPC_INTERNAL_ERROR,
                          message: e instanceof Error ? e.message : String(e),
                      }
            return {jsonrpc: '2.0', id, error}
        }
    }
}

function invalidRequest(id: string | number | null): JsonRpcResponse {
    return {
        jsonrpc: '2.0',
        id,
        error: {code: RPC_INVALID_REQUEST, message: 'invalid request'},
    }
}

function isObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Read the reserved `save` boolean from a mutation's params, falling back to
// the method's default when absent or not a boolean.
function readSaveFlag(params: unknown, dflt: boolean): boolean {
    if (isObject(params) && typeof params[SAVE_PARAM] === 'boolean')
        return params[SAVE_PARAM]
    return dflt
}

function toId(id: unknown): string | number | null {
    return typeof id === 'string' || typeof id === 'number' ? id : null
}

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
        req.on('error', reject)
    })
}

function send(res: ServerResponse, status: number, payload: unknown): void {
    const body = JSON.stringify(payload)
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    }).end(body)
}
