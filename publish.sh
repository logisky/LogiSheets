#!/usr/bin/env bash
#
# Publish every release artifact in this repo in one shot:
#   1. Rust crates to crates.io (ordered so each one's deps are
#      already up there by the time it publishes).
#   2. npm packages (logisheets-web → logisheets → logisheets-engine).
#      The web/node packages have prepublishOnly hooks that rebuild
#      WASM + TS, so no separate build step is needed. The engine
#      package ships the pre-built dist as-is — make sure you've
#      run the engine's own `npm run build:obfuscate` upstream
#      before invoking this script if engine artifacts changed.
#
# Versions must already be bumped in Cargo.toml / package.json before
# running this. The script does NOT touch versions; it only publishes
# whatever's currently checked in.
#
# Flags:
#   --skip-rust   skip cargo publish phase (npm-only release)
#   --skip-npm    skip npm publish phase (cargo-only release)
#   --dry-run     pass --dry-run / --dry-run to each publish command
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SKIP_RUST=0
SKIP_NPM=0
DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --skip-rust) SKIP_RUST=1 ;;
        --skip-npm)  SKIP_NPM=1 ;;
        --dry-run)   DRY_RUN=1 ;;
        -h|--help)
            sed -n '2,20p' "$0"
            exit 0
            ;;
        *)
            echo "unknown arg: $arg" >&2
            exit 1
            ;;
    esac
done

CARGO_DRY=""
NPM_DRY=""
if [ "$DRY_RUN" = "1" ]; then
    CARGO_DRY="--dry-run"
    NPM_DRY="--dry-run"
fi

# ---------------------------------------------------------------------------
# Rust crates — strict topological order. Each `cargo publish` waits a few
# seconds afterwards so crates.io has time to index the new version before
# the next crate that depends on it tries to fetch it.
# ---------------------------------------------------------------------------
CARGO_MANIFESTS=(
    "crates/xmldiff/Cargo.toml"
    "crates/workbook/derives/Cargo.toml"
    "crates/workbook/Cargo.toml"
    "crates/controller/base/Cargo.toml"
    "crates/controller/lexer/Cargo.toml"
    "crates/controller/lexer4fmt/Cargo.toml"
    "crates/controller/parser/Cargo.toml"
    "crates/controller/ast_checker/Cargo.toml"
    "crates/controller/Cargo.toml"
    "Cargo.toml"
)

# ---------------------------------------------------------------------------
# npm packages — order matters because logisheets (node) `link`s from web/src,
# and logisheets-engine has logisheets-web as a peerDependency. Publishing
# web first means consumers installing engine + web together get a coherent
# pair.
# ---------------------------------------------------------------------------
NPM_PACKAGES=(
    "packages/web"
    "packages/node"
    "packages/engine"
)

publish_cargo() {
    for manifest in "${CARGO_MANIFESTS[@]}"; do
        echo ""
        echo "==> cargo publish: $manifest"
        cargo publish $CARGO_DRY --manifest-path "$manifest"
        # crates.io indexes asynchronously — give it room before the
        # next crate (which may depend on this one) tries to resolve.
        # Skip the sleep on dry-run since nothing was actually pushed.
        if [ "$DRY_RUN" = "0" ]; then
            sleep 15
        fi
    done
}

publish_npm() {
    for pkg in "${NPM_PACKAGES[@]}"; do
        echo ""
        echo "==> npm publish: $pkg"
        # Subshell so the cd is scoped — we want to return to repo root
        # for the next package's relative path to resolve.
        (
            cd "$pkg"
            # --access public so scoped or first-time packages don't
            # silently fail on the npm registry's default-private rule.
            npm publish $NPM_DRY --access public
        )
    done
}

if [ "$SKIP_RUST" = "0" ]; then
    publish_cargo
else
    echo "(skipping cargo publish phase)"
fi

if [ "$SKIP_NPM" = "0" ]; then
    publish_npm
else
    echo "(skipping npm publish phase)"
fi

echo ""
echo "All publishes completed."
