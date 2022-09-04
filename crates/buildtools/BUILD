load("@rules_rust//rust:defs.bzl", "rust_binary")
load("@crate_index//:defs.bzl", "aliases", "all_crate_deps")

rust_binary(
    name = "generate",
    srcs = ["src/generate.rs"],
    edition = "2018",
    deps = all_crate_deps(normal = True) + [
        "//crates/gents",
        "//crates/controller:logisheets_controller",
    ],
)
