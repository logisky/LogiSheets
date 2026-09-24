// logisheets-core — UI-free LogiSheets logic.
//
// Runs unchanged in the browser app and in a Node runtime. It depends on
// logisheets-web for TYPES only (see ./port); the concrete engine Client is
// injected by the host: logisheets-engine's worker client in the browser,
// logisheets-runtime's `handle()` proxy on Node. ESM only.
//
// Main exports:
//   - WorkbookOps (./ops): the high-level operation layer. Every engine-facing
//     operation a host offers (cell input, sheets, blocks, form schemas,
//     analysis blocks, pivots, formatting, validation) lives here once.
//   - format generators (./format): pure selection -> style payload builders.
//   - craft contracts (./craft): CraftRuntime (the headless craft hooks),
//     craft state (per-document, rides AppData), craft storage (per-device),
//     canvas-input routing, the JSON-RPC wire types.
//   - craft interactions (./craft-interactions): host-drawn widgets (radio,
//     multi-select, allocators, sliders) crafts bind to block cells.
//   - validation, field authoring model, Value helpers, permissions registry,
//     string / A1 / type-guard utilities.
//
// Module-level stores (craft state, storage backend, interactions, active
// craft, callerRegistry) are process singletons: one workbook per host
// process is assumed. A Node host serving several workbooks shares them.

export * from './port.js'
export * from './ops/index.js'
export * from './format/index.js'
export * from './craft-interactions/index.js'
export * from './craft/index.js'
export * from './validation/index.js'
export * from './field/index.js'
export * from './value/index.js'
export * from './strings/index.js'
export * from './type-guard/index.js'
export * from './utils/index.js'
export * from './transaction/index.js'
export * from './permissions/index.js'
