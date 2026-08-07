// Proves the injectable wasm seam ({@link setWasmHandle}) lets the runtime run
// WITHOUT the node-target glue — the path a Cloudflare Worker (no fs/require)
// takes: initialize the WEB-target glue from a PRE-COMPILED WebAssembly.Module
// (exactly what a Worker gets from `import wasm from "./x.wasm"`), inject its
// `handle`, then compute normally.

import {describe, it, expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {setWasmHandle, SpreadsheetRuntime, type WasmHandle} from './index.js'

// The web-target glue + its wasm, built to the sibling web package by `yarn wasm`.
const WEB_WASM = new URL('../../web/wasm/', import.meta.url)

describe('setWasmHandle — non-Node / Worker wasm path', () => {
    it('computes via an injected web-glue handle (initSync from a Module)', async () => {
        const glue = await import(
            new URL('logisheets_wasm_server.js', WEB_WASM).href
        )
        // The Cloudflare Worker path: instantiate from a pre-compiled Module
        // (never fetch/fs), then hand the runtime this glue's `handle`.
        const module = await WebAssembly.compile(
            readFileSync(new URL('logisheets_wasm_server_bg.wasm', WEB_WASM))
        )
        glue.initSync({module})
        setWasmHandle(glue.handle as WasmHandle)

        const rt = new SpreadsheetRuntime()
        const wb = rt.createWorkbook()
        await wb.ops.inputCell(0, 0, 0, '=1+2')
        expect(wb.getValue(0, 0, 0)).toEqual({type: 'number', value: 3})
        rt.closeAll()
    })
})
