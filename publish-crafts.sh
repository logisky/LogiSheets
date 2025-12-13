#!/usr/bin/env bash

ORIGINAL_DIR="$(pwd)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

crafts=("markdown-table-extractor" "what-if-calculator")

for craft in "${crafts[@]}"; do
    mkdir -p "dist/$craft"
    cp -R public/$craft/* dist/$craft/
done

echo ">>> Back to original directory: $ORIGINAL_DIR"
cd "$ORIGINAL_DIR" || exit 1
