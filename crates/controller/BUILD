load("@rules_rust//rust:defs.bzl", "rust_library", "rust_test")
load("@crate_index//:defs.bzl", "aliases", "all_crate_deps")

rust_library(
    name = "logisheets_controller",
    aliases = aliases(),
    srcs = glob(["src/**/*.rs"]),
    visibility = ["//visibility:public"],
    deps = all_crate_deps(normal = True) + [
        "//crates/controller/ast_checker:logisheets_astchecker",
        "//crates/controller/base:logisheets_base",
        "//crates/controller/lexer:logisheets_lexer",
        "//crates/controller/parser:logisheets_parser",
        "//crates/gents",
        "//crates/workbook:logisheets_workbook",
    ],
    proc_macro_deps = all_crate_deps(
        proc_macro = True,
    ),
    edition = "2018",
)
