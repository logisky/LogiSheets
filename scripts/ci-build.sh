#!/usr/bin/env bash
#
# CI install + build for the JS / WASM side of LogiSheets.
#
# Installs the JS deps and the wasm-pack toolchain, then builds every artifact
# the test steps depend on: the web SDK, core, the WASM engine, the engine UI,
# the webpack bundle, and the Node bindings + runtime. Kept as a script so CI
# and local reproduction run the exact same sequence in the exact same order
# (deps are built before their dependents). Tests are run by the workflow as
# separate steps so a failure points at the culprit.
#
# Run from the repo root: ./scripts/ci-build.sh
set -euo pipefail

run() {
    echo "::group::$*"
    "$@"
    echo "::endgroup::"
}

# --- Toolchains ---
run yarn install
run cargo install --locked wasm-pack

# --- JS / WASM builds (dependency order) ---
run yarn workspace logisheets-web build
run yarn workspace logisheets-core build
run yarn workspace logician build
run yarn run run-scripts
run yarn run wasm
run yarn workspace logisheets-engine build
run yarn build

# logisheets-node links its source from the web package before building.
run yarn workspace logisheets run link
run yarn workspace logisheets build

run yarn workspace logisheets-runtime build
