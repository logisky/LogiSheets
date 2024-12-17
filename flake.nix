{
  description = "A Nix-flake-based Nitro development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs";
  inputs.flake-utils.url = "github:numtide/flake-utils";
  inputs.flake-compat.url = "github:edolstra/flake-compat";
  inputs.flake-compat.flake = false;
  inputs.rust-overlay.url = "github:oxalica/rust-overlay";

  outputs = { flake-utils, nixpkgs, rust-overlay, ... }:
    let
      overlays = [
        (import rust-overlay)
        (final: prev: rec {
          # Overlaying nodejs here to ensure nodePackages use the desired
          # version of nodejs. Offchainlabs suggests nodejs v18 in the docs.
          nodejs = prev.nodejs_18;
          yarn = (prev.yarn.override { inherit nodejs; });
          pnpm = (prev.pnpm.override { inherit nodejs; });
        })
      ];
    in
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit overlays system;
        };
        stableToolchain = pkgs.rust-bin.stable."1.81.0".minimal.override {
          extensions = [ "rustfmt" "clippy" "llvm-tools-preview" "rust-src" ];
          targets = [ "wasm32-unknown-unknown" "wasm32-wasi" ];
        };
        nightlyToolchain = pkgs.rust-bin.nightly."2024-08-06".minimal.override {
          extensions = [ "rust-src" ];
          targets = [ "wasm32-unknown-unknown" "wasm32-wasi" ];
        };
        # A script that calls nightly cargo if invoked with `+nightly`
        # as the first argument, otherwise it calls stable cargo.
        cargo-with-nightly = pkgs.writeShellScriptBin "cargo" ''
          if [[ "$1" == "+nightly" ]]; then
            shift
            # Prepend nightly toolchain directory containing cargo, rustc, etc.
            exec env PATH="${nightlyToolchain}/bin:$PATH" cargo "$@"
          fi
          exec ${stableToolchain}/bin/cargo "$@"
        '';
      in
      {
        devShells =
          {
            # mkShell brings in a `cc` that points to gcc, stdenv.mkDerivation from llvm avoids this.
            default = let llvmPkgs = pkgs.llvmPackages_16; in llvmPkgs.stdenv.mkDerivation {
              name = "logisheets-dev-shell";
              buildInputs = with pkgs; [
                cargo-with-nightly
                stableToolchain

                # Node
                nodejs
                yarn

                python3

                # wasm
                rust-cbindgen
                wabt

              ];
            };
          };
      });
}
