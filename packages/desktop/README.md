# logisheets-desktop

A desktop build of LogiSheets, packaged with [Tauri](https://tauri.app/).

> **Status: experimental / run-from-source.** This is a working dev skeleton, not
> a packaged release yet. See [Not done yet](#not-done-yet).

## What it is

The desktop app is a **thin native shell** around the existing web app. The
LogiSheets engine still runs as **WASM inside the webview's Web Worker** —
exactly as in the browser (`logisheets-engine`: worker + WASM + `OffscreenCanvas`
rendering). Tauri only provides the native window (and, later, packaging,
auto-update, native menus, and filesystem access).

Nothing about the frontend changes: the Tauri window loads the same build the
browser serves, so there is **no separate engine, no `invoke` transport, and no
rendering rewrite**. This is deliberate — the webview supports canvas + Web
Workers + WASM, so reusing the whole stack is both the cheapest and the
fastest-to-ship option. (A fully-native, in-process engine is possible later; see
[Native engine (optional)](#native-engine-optional).)

## Layout

```
packages/desktop/
  package.json          # convenience scripts (delegate to `cargo tauri`); NO js deps
  src-tauri/            # the Tauri host — a standalone Rust crate
    Cargo.toml          # NOT a workspace member (see "Why standalone")
    tauri.conf.json
    src/
      main.rs           # calls run()
      lib.rs            # builds the window; loads the web app
      commands.rs       # native engine + `handle` command (compiled only with `native-engine`)
    capabilities/
      default.json      # grants the window core IPC
    icons/icon.png      # placeholder — replace before packaging
```

## Prerequisites

- The Rust toolchain (as for the rest of the repo).
- The Tauri CLI, installed via cargo (we drive Tauri with `cargo tauri`, **not**
  an npm dependency, to keep the GUI toolchain out of the shared `yarn install`):

  ```bash
  cargo install tauri-cli --version "^2"
  ```

- Platform webview libraries: macOS/Windows ship them; on **Linux** install the
  GTK/WebKit dev packages (e.g. `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`) — see the
  [Tauri Linux prerequisites](https://tauri.app/start/prerequisites/).

## Run (dev)

`beforeDevCommand` is intentionally empty, so start the web dev server first and
let Tauri attach to it:

```bash
# terminal 1 — from the repo root: serve the web app on http://localhost:4200
yarn start

# terminal 2 — open the native window pointed at that server
cd packages/desktop && cargo tauri dev
# (equivalently: yarn workspace logisheets-desktop dev)
```

## How it's wired

- `tauri.conf.json`
  - `frontendDist: "../../../dist"` — the repo-root webpack production output.
  - `devUrl: "http://localhost:4200"` — the webpack dev-server port.
  - `beforeDevCommand: ""` — attach to an already-running server (see above).
- `capabilities/default.json` grants the `main` window `core:default`, enabling
  the webview's IPC. (Your own `#[tauri::command]`s aren't permission-gated in
  Tauri v2, so nothing more is needed for the default shell.)

## Why standalone (not in the cargo workspace / not in `yarn install`)

The Tauri deps (`wry`) require GUI system libraries (`glib`/GTK/WebKit) that a
headless Linux CI runner doesn't have. To keep the portable core green:

- **Cargo:** `src-tauri` is **excluded** from the root workspace (root
  `Cargo.toml` `exclude`) and is its own standalone crate with its own
  `Cargo.lock`. `cargo build --workspace` never touches it — build it here with
  `cargo tauri dev/build`.
- **JS:** this package declares **no** dependencies, so `yarn install` pulls
  nothing Tauri-related into the web builds.

## Native engine (optional)

`src-tauri` also contains a full in-process **native** engine path — a
`#[tauri::command] handle` that mirrors the browser's WASM `handle`, dispatching
to `logisheets_rs::rpc` and serialized with `serde_json`. Because `Workbook` is
`!Send`/`!Sync` (its persistent `imbl` structures wrap a `RefCell` cache), the
engine is owned by a single **actor thread** and driven over a channel rather
than a `Mutex`.

It is **off by default** (feature `native-engine`) so the default binary is a
lean shell and doesn't bundle a second engine. It's the foundation for a future
hybrid — e.g. native open/save of very large `.xlsx`, or batch export — where
those coarse operations go native while interactive reads stay in-process WASM:

```bash
cargo tauri dev --features native-engine   # or: cargo run --features native-engine
```

## Not done yet

Before this can produce a shippable bundle (`cargo tauri build`):

- **`beforeBuildCommand`** is empty — wire an *app-only* production build. The
  root `yarn build` runs `publish-crafts.sh`, which you don't want in a bundle.
- **Icons** — `icons/icon.png` is a placeholder stub. Generate the real set with
  `cargo tauri icon path/to/logo.png`.
- **Code signing / notarization** for macOS and Windows distribution.
- A Linux-friendly `beforeDevCommand` (the current empty value assumes you start
  the web server yourself; a bare `yarn` there would resolve to global Yarn 1,
  not this repo's Yarn 4).
