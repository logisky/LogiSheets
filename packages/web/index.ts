// logisheets-web — the browser SDK over the LogiSheets WASM engine.
//
// Main exports:
//   - `initWasm`: loads the web-target WASM. It MUST resolve before anything
//     below touches the engine (constructing a `Workbook`, `formatNumber`, ...);
//     calls made earlier fail inside wasm-bindgen.
//   - `Workbook` / `Worksheet` (./src/api): a SYNCHRONOUS, in-thread handle on
//     one engine workbook. logisheets-engine runs one inside its web worker.
//   - `Client` (./src/client): the ASYNC contract every host exposes to shared
//     logic — logisheets-engine's worker-backed client in the browser, the
//     `handle()` proxy in logisheets-runtime on Node. Code meant to run in
//     both (logisheets-core, crafts) targets `Client`, never `Workbook`.
//   - the generated bindings (./src/bindings): every payload, RPC param and
//     result type, produced from the Rust types by `yarn gen-bindings`.
//   - small pure helpers: `isErrorMessage`, `Result`, `toA1notation`,
//     selection helpers, `acquireCraftCalc`.
//
// Failure convention: engine calls do not throw. A read that fails returns an
// `ErrorMessage` (check with `isErrorMessage`); a rejected transaction returns
// an `ActionEffect` whose `status.type === 'err'` (reason in `errorMessage`).
//
// Siblings: `logisheets` (Node) ships a copy of ./src compiled against the
// nodejs-target WASM, which initializes itself on require, so it has no
// `initWasm`. `logisheets-web/pure` is the WASM-free subset (types, payload
// builders, helpers) for code that must load without the engine.

import initWasm, {format_number, format_text} from './wasm'

export {initWasm}

/**
 * Format a number with an Excel number-format code (e.g. "0.00%", "yyyy-mm-dd"),
 * natively via the Rust `ssf-rs` renderer compiled into the engine WASM. This
 * replaces the former dependency on the `ssf` npm package. The WASM module must
 * be initialized (via {@link initWasm}) before calling.
 */
export function formatNumber(fmt: string, value: number): string {
    return format_number(fmt, value)
}

/**
 * Format a text value with an Excel number-format code (the `@` text section).
 */
export function formatText(fmt: string, text: string): string {
    return format_text(fmt, text)
}

export * from './src'
