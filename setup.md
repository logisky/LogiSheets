# Install Rust

## Remove the existing rustc

```shell
sudo apt remove logi-rust-sdk
```

## Open terminal with proxychains4

```shell
proxychains4 gnome-terminal
```

## Install

Reference to <https://www.rust-lang.org/tools/install>.

```shell
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

Run the commands below to check the result.

```shell
rustc --version
cargo --version
```

## Select version

```shell
rustup update 1.58.1
rustup default 1.58.1
```

## Config Cargo

Create the config file at ~/.cargo/config.
Copy the content below to the config file.

```config
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "git://mirrors.ustc.edu.cn/crates.io-index"
```

## Build

```shell
cargo build
```

If you encounter an error like this:

> failed to run custom build command for `openssl-sys v0.9.72`

you should install the dependency.

```shell
sudo apt install pkg-config
sudo apt install libssl-dev
```

遇到问题:

> Could not resolve host: crates

请参考该 issue:
https://github.com/rust-lang/cargo/issues/7515


## Install the vscode extension

Install the extension `rust-analyzer`.

Install the rust standard library.

```shell
rustup component add rust-src
```

If the extension has error, try the command below.

```shell
export RUST_SRC_PATH="$(rustc --print sysroot)/lib/rustlib/src/rust/src"
```
