// WASM-free entry point.
//
// The root barrel (`logisheets-web`) re-exports `./api`, which pulls in
// api/workbook + api/worksheet — and those statically import the web-target
// WASM module. That makes the root barrel unloadable outside a browser/bundler.
//
// `logisheets-web/pure` exposes everything that does NOT touch the WASM:
// generated bindings (payload builders + types), pure helpers, the craft-calc
// handle factory, and the Client *type*. Consumers that only need to construct
// payloads / inspect types / share logic (e.g. logician running on Node) import
// from here and stay engine-free.

export * from './bindings'
export * from './payloads'
export * from './types'
export * from './utils'
export * from './layout'

// Pure API helpers (no WASM): isErrorMessage, getPatternFill, Result, and the
// craft-calc handle (acquireCraftCalc / CraftCalc) which only builds payloads.
export {isErrorMessage, getPatternFill} from './api/utils'
export type {Result} from './api/utils'
export {CraftCalc, acquireCraftCalc} from './api/craft-calc'

// The engine contract — type only, erased at compile time.
export type {Client} from './client'
