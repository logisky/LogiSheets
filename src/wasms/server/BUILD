load("@rules_rust//rust:defs.bzl", "rust_shared_library")
load("@rules_rust//wasm_bindgen:wasm_bindgen.bzl", "rust_wasm_bindgen")
load("@crate_index//:defs.bzl", "aliases", "all_crate_deps")

package(default_visibility = ["//visibility:public"])

rust_shared_library(
    name = "server_lib",
    aliases = aliases(),
    srcs = glob(["src/**/*.rs"]),
    edition = "2018",
    deps = all_crate_deps(normal = True) + [
        "//crates/controller:logisheets_controller",
    ],
)

rust_wasm_bindgen(
    name = "server_web_wasm",
    wasm_file = ":server_lib",
)
