import fs from 'fs'
import path from 'path'
import {fileURLToPath} from 'url'
import initWasm from '../wasm/logisheets_wasm_server'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const wasmPath = path.resolve(__dirname, '../wasm/logisheets_wasm_server_bg.wasm')
const wasmBytes = fs.readFileSync(wasmPath)

await initWasm({module_or_path: wasmBytes})
