// logisheets — the LogiSheets engine for Node.
//
// Same API as logisheets-web (`Workbook`, `Worksheet`, the generated bindings,
// `isErrorMessage`, ...), from the same source: `./src` is NOT tracked here.
// `yarn link` (run by `prepare` / `prepublishOnly`) copies packages/web/src
// over it, so edit and document the code in packages/web, never here.
//
// Differences from logisheets-web:
//   - built against the nodejs-target WASM, which loads the .wasm from disk
//     and initializes itself on require. There is no `initWasm` to await; a
//     `new Workbook()` works straight after import.
//   - the web package's root-only extras (`initWasm`, `formatNumber`,
//     `formatText`) are not exported.
//   - CommonJS output.
//
// For a managed multi-workbook host with RPC, crafts and file watching on top
// of this engine, use logisheets-runtime.

export * from './src'
