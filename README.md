# LogiSheets

![Logo](./docs/public/logo/logisheets.jpg)

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![npm: logisheets-web](https://img.shields.io/npm/v/logisheets-web?label=logisheets-web&logo=npm)](https://www.npmjs.com/package/logisheets-web)
[![npm: logisheets (node)](https://img.shields.io/npm/v/logisheets?label=logisheets%20%28node%29&logo=npm)](https://www.npmjs.com/package/logisheets)
[![crates.io: logisheets-rs](https://img.shields.io/crates/v/logisheets-rs?label=logisheets-rs&logo=rust)](https://crates.io/crates/logisheets-rs)
[![Docs](https://img.shields.io/badge/docs-logisheets.com-brightgreen)](https://docs.logisheets.com/)

**From sheets to systems.** LogiSheets is a web-based spreadsheet built on a Rust engine compiled to WebAssembly — it reads, manipulates, and writes real `.xlsx` files, and runs the same engine in the browser and on Node. But it's more than a grid: with **structured data (Blocks)** that carry schema, types, and validation, and a **plugin system (Crafts)** that turns workbooks into real applications, a LogiSheets spreadsheet stops being a static document and becomes a building block of an actual system.

> An **open-source spreadsheet library** and **Excel (`.xlsx`) engine** for **JavaScript / TypeScript** and **Rust** — read, write, and evaluate spreadsheets with **formula** support in the **browser** (via **WebAssembly**), on **Node.js**, or natively in Rust. A programmable alternative to SheetJS / ExcelJS with a full recalculation engine and an embeddable UI.

### ▶ See it in action — [Factory Simulator live demo](https://www.logisheets.com/?craft=factory-simulator)

An interactive simulation game built entirely on LogiSheets — Blocks, live formulas, and clickable cell interactions in the browser. The best one-minute tour of what the engine can do.

📖 **Documentation:** [docs.logisheets.com](https://docs.logisheets.com/)

## Why LogiSheets

- **One engine, everywhere.** The core spreadsheet engine is written in Rust and compiled to WASM. The exact same logic powers the browser app and a headless Node runtime — no reimplementation, no drift.
- **Real Excel files.** Read and write `.xlsx` with formulas, styles, and structure preserved.
- **Structured data (Blocks).** A `Block` keeps a region of cells together as a coherent, schema-aware table — cells are addressed by stable IDs, so inserts and deletes never break references. Fields carry types, validation rules, uniqueness, and required constraints.
- **Built to extend.** A rich API surface plus a plugin system (Crafts) let you add features without forking the core. The logic layer is engine-neutral and reusable from any host.
- **AI-native.** `logician` is an agent toolkit that operates workbooks through structured tools; it powers **Watson**, the in-app AI assistant, and runs equally well on Node.
- **Fast & correct.** Dependency-tracked recalculation and persistent (immutable) data structures give efficient undo/redo without cloning the whole workbook.

## Crafts — the plugin system

Crafts are self-contained mini-apps that extend LogiSheets through the same public API the core uses. They're written in **plain JavaScript/TypeScript**, so the entire rich frontend ecosystem — UI libraries, charts, editors, AI SDKs — can be brought right into the spreadsheet. Shipped examples live under `crafts/`:

- **factory-simulator** — interactive simulation game (zh / en) showcasing Blocks, formulas, and craft interactions. **[▶ Try it live](https://www.logisheets.com/?craft=factory-simulator)**
- **Watson** — the in-app AI assistant (built on `logician`)
- **what-if-calculator** — scenario analysis over workbook values
- **markdown-table-extractor** — turn Markdown tables into Blocks

## Documentation

Guides, API reference, and tutorials live at **[docs.logisheets.com](https://docs.logisheets.com/)** (source in [`docs/`](./docs)).

---

## Architecture

LogiSheets is layered so that logic lives in exactly one place and every host reuses it:

```mermaid
flowchart TD
    engine["crates/ — Rust engine<br/>formula eval · deps · undo/redo · .xlsx I/O"]
    web["logisheets-web<br/><i>(--target web)</i>"]
    node["logisheets (node)<br/><i>(--target nodejs)</i>"]
    core["logisheets-core<br/>all extension logic · UI-free"]
    app["Browser App<br/>core + rendering"]
    runtime["logisheets-runtime<br/>headless Node engine"]
    logician["logician<br/>AI toolkit"]
    crafts["Crafts<br/>plugins"]

    engine -->|wasm-pack| web
    engine -->|wasm-pack| node
    web --> core
    node --> core
    core --> app
    core --> runtime
    core --> logician
    core --> crafts

    subgraph wrappers ["thin WASM wrappers"]
        web
        node
    end
```

The WASM wrappers expose the engine over a simple RPC surface and carry no extension logic. `logisheets-core` holds the portable logic and depends on the engine only for *types* — the concrete `Client` is injected by each host, so the same code runs in the browser and on Node. Rendering stays in the browser layer.

## Packages

| Package | Path | Description |
|---------|------|-------------|
| **logisheets-rs** | `crates/api` | Rust API for the spreadsheet engine |
| **logisheets-web** | `packages/web` | Browser WASM SDK (`/pure` subpath for WASM-free use) |
| **logisheets** (node) | `packages/node` | Node.js WASM bindings |
| **logisheets-core** | `packages/core` | Engine-neutral extension logic, shared by every host |
| **logisheets-runtime** | `packages/runtime` | Headless spreadsheet runtime for Node |
| **logisheets-engine** | `packages/engine` | Canvas-based spreadsheet UI component (MIT, fully open source) |
| **logisheets-formula-editor** | `packages/formula-editor` | CodeMirror 6 formula editor |
| **logician** | `packages/logician` | AI agent toolkit for operating workbooks (browser + Node) |
| **logisheets-desktop** | `packages/desktop` | Desktop app — a [Tauri](https://tauri.app/) shell that runs the web app (WASM engine) in a native window (experimental; see its [README](./packages/desktop/README.md)) |

## Contributing

Issues and pull requests are welcome.

## License

MIT — see [LICENSE](./LICENSE).
