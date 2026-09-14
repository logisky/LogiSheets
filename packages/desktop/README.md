# logisheets-desktop

A desktop build of LogiSheets, packaged with [Tauri](https://tauri.app/).

> **Status: Windows ships, macOS does not.** `yarn workspace logisheets-desktop
> build` produces a Windows installer, and the desktop-build workflow can attach
> one to a draft GitHub Release. macOS builds but cannot be distributed without
> Apple signing and notarization — see [Not done yet](#not-done-yet).

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
    icons/                # the real logo, generated with `cargo tauri icon`
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

## Build a bundle

One command, from this directory. It builds the web frontend and then bundles
it, so the installer never contains a stale `dist/`:

```bash
yarn workspace logisheets-desktop build            # the "default" distribution
CRAFT_DIST=zh yarn workspace logisheets-desktop build   # a named one
```

`CRAFT_DIST` picks the distribution from the repo-root `crafts.config.json` —
which crafts ship, the default UI language, and the product name / bundle id /
window title. `en` and `zh` are the release builds; `default` is the full app.
`build:bundle-only` skips the frontend build and bundles whatever `dist/`
already holds (fast, and wrong if you forgot to build).

Bundles land in `src-tauri/target/release/bundle/` — on Windows, `nsis/*-setup.exe`
(the friendly installer) and `msi/*.msi` (for enterprise deployment).

> `cargo tauri build` on its own also works, but it bundles whatever `dist/`
> happens to exist: `beforeBuildCommand` is deliberately empty because CI builds
> the frontend once on Linux and hands the same `dist/` to each OS bundler.
> `scripts/tauri-build.mjs` is what closes that gap locally.

## Releasing (Windows)

**Create the release; CI builds the installers and attaches them.**

```bash
just release 1.14.2                  # bumps every version, this app included
git commit -am "Release 1.14.2"
git push                             # onto main
gh release create v1.14.2 --title "…" --notes "…"   # or the web UI
```

Publishing the release (directly, or by publishing a draft) triggers
`.github/workflows/release.yaml`: it builds **both** distributions (`en` and
`zh`) for Windows and uploads all four installers as release assets. You write
the notes; CI supplies the binaries. Pushing a tag on its own builds nothing.

Before building, it checks two things and refuses if either fails:

- **the tagged commit is on main** — asked of git (`merge-base --is-ancestor`),
  not of the release's `target_commitish`, which is only what the UI had
  selected;
- **the tag matches the app version** the installer will report, so a release
  cannot be labelled `v1.14.2` and contain `1.14.1`.

Re-running after a failed build (`workflow_dispatch` with the tag) replaces the
assets rather than erroring on the ones that already uploaded.

CI appends a downloads table and the signing status to the release notes, in a
marked block it rewrites on a re-run — your own text is left alone.

Both distributions build a product called "LogiSheets" and would otherwise
produce the same `LogiSheets_<version>_x64-setup.exe`; the release step renames
them to `LogiSheets-<version>-{en,zh}-x64.{exe,msi}` on the way in.

The **desktop build** workflow (`.github/workflows/desktop.yaml`) is still
there for one-off manual builds, and is what `release.yaml` calls per
distribution.

**Code signing is opt-in and needs a certificate you supply.** Set two
repository secrets:

| Secret | What it is |
| --- | --- |
| `WINDOWS_CERTIFICATE` | Base64 of your `.pfx` — `base64 -w0 cert.pfx` (macOS: `base64 -i cert.pfx`) |
| `WINDOWS_CERTIFICATE_PASSWORD` | The password that `.pfx` was exported with |

With both present, CI imports the certificate into the runner's store and
passes its thumbprint to Tauri, which signs via `signtool`. With either
missing the build still succeeds and produces an **unsigned** installer —
Windows SmartScreen then warns users on first run, and a brand-new certificate
takes a while to build enough reputation for that warning to stop. The
workflow summary and the draft release notes both say which one you got.

An OV certificate lives in a file (what the secrets above expect); an EV
certificate usually lives on a hardware token or in a cloud service like Azure
Trusted Signing, which needs a different mechanism (`signCommand`) — worth
knowing before buying one.

WebView2 (the engine the app runs in) is fetched by the installer on machines
that lack it: `bundle.windows.webviewInstallMode = downloadBootstrapper`. Most
Windows 10 and every Windows 11 machine already has it and skips the download.

## Versions

The app version lives in **one** place: `src-tauri/Cargo.toml`. `tauri.conf.json`
has no `version` key, so Tauri falls back to the crate's — and `just release`
sets it alongside every other version in the repo. `just versions` prints it.

(It used to sit in three files and drifted to `0.1.0` while the rest of the
repo moved to 1.14.x, which is exactly the failure one source of truth avoids.)

## Not done yet

- **macOS** — the bundle builds, but distributing it needs an Apple Developer
  ID, signing, and notarization; without those, Gatekeeper refuses to open it.
  `platforms: windows+macos` builds one for testing.
- **Auto-update** — no updater endpoint is configured, so users update by
  downloading a new installer.
- A Linux-friendly `beforeDevCommand` (the current empty value assumes you start
  the web server yourself; a bare `yarn` there would resolve to global Yarn 1,
  not this repo's Yarn 4).
