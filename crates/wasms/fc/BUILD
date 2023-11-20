load("@rules_rust//rust:defs.bzl", "rust_shared_library")
load("@rules_rust//wasm_bindgen:wasm_bindgen.bzl", "rust_wasm_bindgen")

package(default_visibility = ["//visibility:public"])

rust_shared_library(
    name = "fc_lib",
    srcs = glob(["src/**/*.rs"]),
    edition = "2018",
    deps = [
        "@rules_rust//wasm_bindgen/3rdparty:wasm_bindgen",
    ],
)

rust_wasm_bindgen(
    name = "fc_web_wasm",
    target = "web",
    wasm_file = ":fc_lib",
)