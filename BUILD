load("@rules_rust//rust:defs.bzl", "rust_library", "rust_test")
load("@crate_index//:defs.bzl", "aliases", "all_crate_deps")
load("@rules_rust//wasm_bindgen:wasm_bindgen.bzl", "rust_wasm_bindgen_toolchain")

rust_library(
    name = "logisheets",
    srcs = [
        "src/lib.rs",
    ],
    aliases = aliases(),
    deps = all_crate_deps(
        normal = True,
    ) + [
        "//crates/controller:logisheets_controller",
        "//crates/workbook:logisheets_workbook",
    ],
    proc_macro_deps = all_crate_deps(proc_macro = True),
    edition = "2018",
)
