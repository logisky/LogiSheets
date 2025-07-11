{
  description = "LogiSheets development environment with Rust, Node.js, Yarn, Python, and WASM tools";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [
          (import rust-overlay)
        ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };
        # Rust toolchains
        stableToolchain = pkgs.rust-bin.stable."1.85.0".minimal.override {
          extensions = [ "rustfmt" "clippy" "llvm-tools-preview" "rust-src" ];
          targets = [ "wasm32-unknown-unknown" ];
        };
      in
      {
        devShells =
          {
            # mkShell brings in a `cc` that points to gcc, stdenv.mkDerivation from llvm avoids this.
            default = let llvmPkgs = pkgs.llvmPackages_16; in llvmPkgs.stdenv.mkDerivation {
              name = "logisheets-dev-shell";
              buildInputs = with pkgs; [
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
