#!/bin/bash

set -e

SCRIPT_DIR=$(dirname "$0")

cd $SCRIPT_DIR
cd ..

MANIFEST_PATHS=(
  "crates/xmldiff/Cargo.toml"
  "crates/workbook/derives/Cargo.toml"
  "crates/workbook/Cargo.toml"
  "crates/controller/base/Cargo.toml"
  "crates/controller/lexer/Cargo.toml"
  "crates/controller/parser/Cargo.toml"
  "crates/controller/ast_checker/Cargo.toml"
  "crates/controller/Cargo.toml"
  "Cargo.toml"
)

for MANIFEST_PATH in "${MANIFEST_PATHS[@]}"; do
  echo "Publishing package at: $MANIFEST_PATH"

  cargo publish --manifest-path "$MANIFEST_PATH"

  sleep 10

  if [ $? -eq 0 ]; then
    echo "Successfully published: $MANIFEST_PATH"
  else
    echo "Failed to publish: $MANIFEST_PATH"
  fi
done
