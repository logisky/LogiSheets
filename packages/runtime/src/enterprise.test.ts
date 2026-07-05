// Enterprise integration tests: control-plane client + the pin/unpin/task/status
// RPC server, driven against a real (empty) workbook the engine produces.

import {describe, it, expect, beforeAll, afterAll} from 'vitest'
import {createServer, type Server} from 'node:http'
import {readFileSync, mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {SpreadsheetRuntime} from './index.js'
import {
    ControlPlaneClient,
    EnterpriseRuntimeServer,
    startEnterpriseRuntime,
    type TaskContext,
} from './enterprise.js'

const FIXTURE = fileURLToPath(new URL('../../../tests/6.xlsx', import.meta.url))

// A mock control panel: register → creds, heartbeat/ingest → ok.
function mockControlPlane(): Promise<{server: Server; url: string; hits: string[]}> {
    const hits: string[] = []
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            hits.push(`${req.method} ${req.url}`)
            let body = ''
            req.on('data', (c) => (body += c))
            req.on('end', () => {
                res.writeHead(req.url === '/api/runtimes/register' ? 201 : 200, {
                    'content-type': 'application/json',
                })
                if (req.url === '/api/runtimes/register') {
                    res.end(
                        JSON.stringify({
                            runtimeId: 'rt-1',
                            registryUrl: null,
                            registryToken: null,
                        }),
                    )
                } else res.end(JSON.stringify({ok: true}))
            })
        })
        server.listen(0, '127.0.0.1', () => {
            const port = (server.address() as {port: number}).port
            resolve({server, url: `http://127.0.0.1:${port}`, hits})
        })
    })
}

// Serve raw bytes at /wb.xlsx so the runtime can fetch a workbook by URL.
function fileServer(bytes: Uint8Array): Promise<{server: Server; url: string}> {
    return new Promise((resolve) => {
        const server = createServer((_req, res) => {
            res.writeHead(200, {'content-type': 'application/octet-stream'})
            res.end(Buffer.from(bytes))
        })
        server.listen(0, '127.0.0.1', () => {
            const port = (server.address() as {port: number}).port
            resolve({server, url: `http://127.0.0.1:${port}/wb.xlsx`})
        })
    })
}

const SECRET = 'test-secret'
const auth = {authorization: `Bearer ${SECRET}`, 'content-type': 'application/json'}

let cp: Awaited<ReturnType<typeof mockControlPlane>>
let files: Awaited<ReturnType<typeof fileServer>>
let runtime: SpreadsheetRuntime
let server: EnterpriseRuntimeServer
let base: string

beforeAll(async () => {
    cp = await mockControlPlane()
    // Serve a real .xlsx fixture from the repo's tests/ directory.
    files = await fileServer(new Uint8Array(readFileSync(FIXTURE)))

    runtime = new SpreadsheetRuntime()
    server = new EnterpriseRuntimeServer({
        runtime,
        secret: SECRET,
        taskHandlers: {
            echo: (ctx: TaskContext) => ({
                wbId: ctx.workbook.id,
                params: ctx.params,
            }),
        },
    })
    const addr = await server.listen(0, '127.0.0.1')
    base = `http://127.0.0.1:${addr.port}`
})

afterAll(async () => {
    await server.close()
    runtime.closeAll()
    cp.server.close()
    files.server.close()
})

describe('ControlPlaneClient', () => {
    it('registers and gets creds', async () => {
        const client = new ControlPlaneClient({
            controlPlaneUrl: cp.url,
            secret: SECRET,
        })
        const reg = await client.register({address: 'http://me:1', name: 'x'})
        expect(reg.runtimeId).toBe('rt-1')
        await client.heartbeat('rt-1')
        await client.ingest('rt-1', [{caller: 'svc', method: 'read'}])
        expect(cp.hits).toContain('POST /api/runtimes/register')
        expect(cp.hits).toContain('POST /api/runtimes/rt-1/heartbeat')
        expect(cp.hits).toContain('POST /api/ingest')
    })
})

describe('EnterpriseRuntimeServer', () => {
    it('rejects without the shared secret', async () => {
        const res = await fetch(`${base}/status`)
        expect(res.status).toBe(403)
    })

    it('reports status', async () => {
        const res = await fetch(`${base}/status`, {
            headers: {authorization: `Bearer ${SECRET}`},
        })
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.pins).toEqual([])
    })

    it('unknown rpcCall errors before loading', async () => {
        const res = await fetch(`${base}/task`, {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({workbookUrl: files.url, rpcCall: 'nope'}),
        })
        expect(res.status).toBe(500)
        expect((await res.json()).error).toMatch(/unknown rpcCall/)
    })

    it('runs a task against a fetched workbook', async () => {
        const res = await fetch(`${base}/task`, {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({
                workbookUrl: files.url,
                rpcCall: 'echo',
                params: {x: 1},
            }),
        })
        expect(res.status).toBe(200)
        // /task returns the handler result directly (what the control-plane
        // dispatcher consumes, e.g. {values} for extractIndicators).
        const body = await res.json()
        expect(body.params).toEqual({x: 1})
        // Ephemeral: the workbook is released after the task.
        expect(runtime.workbooks.length).toBe(0)
    })

    it('local-dir watcher is off by default, opt-in via `watch`', async () => {
        const dir = mkdtempSync(join(tmpdir(), 'lse-watch-'))
        writeFileSync(
            join(dir, 'wb_t.json'),
            JSON.stringify({id: 't', version: 1, path: FIXTURE}),
        )
        const handle = await startEnterpriseRuntime({
            controlPlaneUrl: cp.url,
            address: 'http://127.0.0.1:9',
            watch: {dir, intervalMs: 30},
        })
        try {
            expect(handle.watcher).toBeDefined()
            // Wait for the watcher to pick up the dropped descriptor.
            let loaded = false
            for (let i = 0; i < 40; i++) {
                if (handle.watcher?.get('t')) {
                    loaded = true
                    break
                }
                await new Promise((r) => setTimeout(r, 25))
            }
            expect(loaded).toBe(true)
        } finally {
            await handle.stop()
        }
    })

    it('no watcher when `watch` is omitted', async () => {
        const handle = await startEnterpriseRuntime({
            controlPlaneUrl: cp.url,
            address: 'http://127.0.0.1:9',
        })
        expect(handle.watcher).toBeUndefined()
        await handle.stop()
    })

    it('pins and unpins a workbook', async () => {
        const pinRes = await fetch(`${base}/pin`, {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({wbUrl: files.url}),
        })
        expect(pinRes.status).toBe(200)
        const {wbId} = await pinRes.json()
        expect(wbId).toBeTruthy()

        const status = await (
            await fetch(`${base}/status`, {headers: {authorization: `Bearer ${SECRET}`}})
        ).json()
        expect(status.pins).toContain(wbId)

        const unpin = await fetch(`${base}/unpin`, {
            method: 'POST',
            headers: auth,
            body: JSON.stringify({wbId}),
        })
        expect(unpin.status).toBe(200)
        expect(runtime.workbooks.length).toBe(0)
    })
})
