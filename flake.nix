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
        nightlyToolchain = pkgs.rust-bin.nightly."2024-08-06".minimal.override {
          extensions = [ "rust-src" ];
          targets = [ "wasm32-unknown-unknown" ];
        };
        # Node.js & Yarn
        nodejs = pkgs.nodejs_20;
        yarn = pkgs.yarn.override { inherit nodejs; };
        # WASM tools
        wasmTools = with pkgs; [ rust-cbindgen wabt ];
      in
      {
        devShells.default = pkgs.mkShell {
          name = "logisheets-dev-shell";
          buildInputs = [
            stableToolchain
            nightlyToolchain
            nodejs
            yarn
            pkgs.python3
          ] ++ wasmTools;
          shellHook = ''
            echo "Welcome to the LogiSheets development shell!"
            echo "Rust (stable & nightly), Node.js, Yarn, Python 3, and WASM tools are available."
          '';
        };
      }
    );
}