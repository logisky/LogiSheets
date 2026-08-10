#!/usr/bin/env bash

ORIGINAL_DIR="$(pwd)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

# The craft set is derived from crafts.config.json + the CRAFT_DIST env var
# (default: "default") — the SAME source webpack uses for the panel's craft
# list, so the shipped dist/ and the UI always agree. Add crafts / whole
# distributions in crafts.config.json, not here.
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

# Copy logisheets-engine's worker + its WASM into the final dist.
# The dev server serves these from packages/engine/dist on the fly
# (see webpack.config.ts devServer.static), but the production build
# has no equivalent step — without this copy, the engine worker (and
# the canvas spreadsheet itself) 404s in production. Files land at
# /assets/* to match the in-bundle worker URL Vite chunked them as.
if [ -d "packages/engine/dist/assets" ]; then
    mkdir -p "dist/assets"
    cp -R packages/engine/dist/assets/* dist/assets/
fi

echo ">>> Back to original directory: $ORIGINAL_DIR"
cd "$ORIGINAL_DIR" || exit 1
