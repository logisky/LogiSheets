#!/usr/bin/env bash

ORIGINAL_DIR="$(pwd)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# The craft set is derived from crafts.config.json + the CRAFT_DIST env var
# (default: "default") — the SAME source Vite uses (via `define`) for the
# panel's craft list, so the shipped dist/ and the UI always agree. Add crafts
# / whole distributions in crafts.config.json, not here.
crafts=()
while IFS= read -r line; do
    [ -n "$line" ] && crafts+=("$line")
done < <(node "$SCRIPT_DIR/scripts/craft-dist.mjs" crafts)

echo ">>> Publishing crafts for distribution '${CRAFT_DIST:-default}': ${crafts[*]}"

# Prune every known craft dir from dist/ first, so switching distributions
# locally doesn't leave a previous build's crafts lingering in the output.
while IFS= read -r known; do
    [ -n "$known" ] && rm -rf "dist/$known"
done < <(node "$SCRIPT_DIR/scripts/craft-dist.mjs" registry)

for craft in "${crafts[@]}"; do
    if [ ! -d "public/$craft" ]; then
        echo "!!! public/$craft missing — did crafts/build.sh build it?" >&2
        exit 1
    fi
    mkdir -p "dist/$craft"
    cp -R public/$craft/* dist/$craft/
done

# NOTE: logisheets-engine inlines its Web Worker + WASM as data URIs (see
# packages/engine — `?worker&inline` + base64 WASM), so it emits no separate
# assets/ dir and needs no copy step here. Vite keeps that data URI inlined in
# the app bundle (build.assetsInlineLimit in vite.config.ts).

echo ">>> Back to original directory: $ORIGINAL_DIR"
cd "$ORIGINAL_DIR" || exit 1
