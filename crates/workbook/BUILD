load("@rules_rust//rust:defs.bzl", "rust_library", "rust_test")
load("@crate_index//:defs.bzl", "aliases", "all_crate_deps")

rust_library(
    name = "logisheets_workbook",
    aliases = aliases(),
    srcs = glob(["src/**/*.rs"]),
    visibility = ["//visibility:public"],
    deps = all_crate_deps(normal = True) + [
        "//crates/gents",
        "//crates/xmlserde",
    ],
    proc_macro_deps = all_crate_deps(
        proc_macro = True,
    ) + [
        "//crates/workbook/derives:logisheets_workbook_derives",
        "//crates/xmlserde/derives:logisheets_derives",
    ],
    edition = "2018",
)
