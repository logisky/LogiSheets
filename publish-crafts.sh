#!/usr/bin/env bash

ORIGINAL_DIR="$(pwd)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

crafts=("factory-simulator" "markdown-table-extractor" "what-if-calculator")

for craft in "${crafts[@]}"; do
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
