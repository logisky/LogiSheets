# Version management for the LogiSheets monorepo.
#
# These recipes only BUMP versions. Publishing is a separate step (see
# ./publish.sh, which reads whatever versions are currently checked in).
#
# Requires the dev shell (cargo-edit + just + node), which direnv loads
# automatically via .envrc. If you don't use direnv, prefix commands with
# `nix develop --command`.
#
# Version model: all packages share one minor line (X.Y) but each may carry
# its own patch. Use `release` for a coordinated X.Y.Z across the whole repo;
# use `bump` for a single-package bug-fix on the existing line. Either way,
# internal dependency ranges are rewritten to track the depended-on version.

# npm packages that get published, in publish.sh order.
npm_dirs := "packages/web packages/node packages/core packages/engine packages/runtime packages/formula-editor"

# Published npm packages as dir:name pairs (name = registry name).
npm_pkgs := "packages/web:logisheets-web packages/node:logisheets packages/core:logisheets-core packages/engine:logisheets-engine packages/runtime:logisheets-runtime packages/formula-editor:logisheets-formula-editor"

# Published crates as their crates.io names (all inherit the workspace version locally).
crates := "xmldiff logisheets_workbook_derives logisheets_workbook logisheets_base logisheets_lexer logisheets_lexer4fmt logisheets_parser logisheets_astchecker logisheets_controller logisheets-rs"

# Rust crates that are NOT published and keep their own version line.
rust_exclude := "--exclude logiscript --exclude logisheets_sequencer"

# Default: show what `just` can do.
default:
    @just --list

# Show current versions across Rust and npm.
versions:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Rust workspace: $(sed -n '/^\[workspace.package\]/,/^\[/ s/^version = "\(.*\)"/\1/p' Cargo.toml)"
    echo "npm packages:"
    for d in {{npm_dirs}}; do
        printf "  %-30s %s\n" "$(node -p "require('./$d/package.json').name")" "$(node -p "require('./$d/package.json').version")"
    done

# Show the LIVE published versions (npm registry + crates.io) next to local,
# flagging drift with `*`. Needs network.
published:
    #!/usr/bin/env bash
    set -euo pipefail
    ws_local="$(sed -n '/^\[workspace.package\]/,/^\[/ s/^version = "\(.*\)"/\1/p' Cargo.toml)"
    printf "%-30s %-10s %-10s\n" "package" "local" "published"
    echo "npm (registry):"
    for pair in {{npm_pkgs}}; do
        dir="${pair%%:*}"; name="${pair##*:}"
        local_v="$(node -p "require('./$dir/package.json').version")"
        pub_v="$(npm view "$name" version 2>/dev/null || echo '(unpublished)')"
        mark=""; [ "$local_v" != "$pub_v" ] && mark=" *"
        printf "  %-28s %-10s %-10s%s\n" "$name" "$local_v" "$pub_v" "$mark"
    done
    echo "crates.io:"
    for c in {{crates}}; do
        pub_v="$(curl -s "https://crates.io/api/v1/crates/$c" -H 'User-Agent: logisheets-release' | node -e 'let d="";process.stdin.on("data",x=>d+=x).on("end",()=>{try{console.log(JSON.parse(d).crate.max_stable_version)}catch{console.log("(unpublished)")}})')"
        mark=""; [ "$ws_local" != "$pub_v" ] && mark=" *"
        printf "  %-28s %-10s %-10s%s\n" "$c" "$ws_local" "$pub_v" "$mark"
    done

# Coordinated release: set the ENTIRE repo (Rust + every npm package) to
# VERSION and rewrite internal dependency ranges to ^VERSION.
#   just release 1.4.0
release VERSION:
    #!/usr/bin/env bash
    set -euo pipefail
    v="{{VERSION}}"
    [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "error: VERSION must be X.Y.Z, got '$v'" >&2; exit 1; }

    echo "==> Rust workspace -> $v"
    cargo set-version --workspace {{rust_exclude}} "$v"

    echo "==> npm package versions -> $v"
    for d in {{npm_dirs}}; do ( cd "$d" && npm pkg set version="$v" >/dev/null ); done

    echo "==> npm internal dependency ranges -> ^$v"
    ( cd packages/core    && npm pkg set "peerDependencies.logisheets-web=^$v" >/dev/null )
    ( cd packages/engine  && npm pkg set "dependencies.logisheets-web=^$v" >/dev/null )
    ( cd packages/runtime && npm pkg set "dependencies.logisheets=^$v" "dependencies.logisheets-core=^$v" >/dev/null )

    echo "Done. Review with: git diff"

# Bug-fix bump of a SINGLE npm package on the existing line. Sets PKG to
# VERSION and rewrites any internal range that points at it to ^VERSION.
# Rust is untouched (its crates are lockstep; patch them with `release`).
#   just bump logisheets 1.3.2
bump PKG VERSION:
    #!/usr/bin/env bash
    set -euo pipefail
    v="{{VERSION}}"; pkg="{{PKG}}"
    [[ "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "error: VERSION must be X.Y.Z, got '$v'" >&2; exit 1; }

    case "$pkg" in
        logisheets-web)            dir=packages/web ;;
        logisheets)                dir=packages/node ;;
        logisheets-core)           dir=packages/core ;;
        logisheets-engine)         dir=packages/engine ;;
        logisheets-runtime)        dir=packages/runtime ;;
        logisheets-formula-editor) dir=packages/formula-editor ;;
        *) echo "error: unknown package '$pkg'" >&2; echo "one of: logisheets-web logisheets logisheets-core logisheets-engine logisheets-runtime logisheets-formula-editor" >&2; exit 1 ;;
    esac

    echo "==> $pkg -> $v"
    ( cd "$dir" && npm pkg set version="$v" >/dev/null )

    echo "==> internal ranges depending on $pkg -> ^$v"
    case "$pkg" in
        logisheets-web)
            ( cd packages/core   && npm pkg set "peerDependencies.logisheets-web=^$v" >/dev/null )
            ( cd packages/engine && npm pkg set "dependencies.logisheets-web=^$v" >/dev/null ) ;;
        logisheets)
            ( cd packages/runtime && npm pkg set "dependencies.logisheets=^$v" >/dev/null ) ;;
        logisheets-core)
            ( cd packages/runtime && npm pkg set "dependencies.logisheets-core=^$v" >/dev/null ) ;;
        *) echo "  (nothing depends on $pkg internally)" ;;
    esac

    echo "Done. Review with: git diff"
