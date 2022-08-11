load("@rules_rust//rust:defs.bzl", "rust_proc_macro")
load("@crate_index//:defs.bzl", "aliases", "all_crate_deps")

rust_proc_macro(
    name = "logisheets_derives",
    aliases = aliases(),
    srcs = glob(["src/**/*.rs"]),
    visibility = ["//visibility:public"],
    deps = all_crate_deps(
        normal = True,
    ),
    proc_macro_deps = all_crate_deps(
        proc_macro = True,
    ),
    edition = "2018",
)
