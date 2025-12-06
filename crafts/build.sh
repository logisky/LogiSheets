#!/bin/sh

ORIGINAL_DIR="$(pwd)"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

for dir in */; do
  if [ -d "$dir" ]; then
    echo ">>> Entering $dir"
    cd "$dir" || continue

    if [ -f "package.json" ]; then
      echo "Running yarn build in $dir"
      yarn build
    else
      echo "Skipping $dir (no package.json)"
    fi

    cd "$SCRIPT_DIR"
  fi
done

cd "$ORIGINAL_DIR"
echo ">>> Back to original directory: $ORIGINAL_DIR"
