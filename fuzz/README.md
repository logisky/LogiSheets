# Fuzzing

Coverage-guided fuzz targets (libFuzzer via `cargo-fuzz`) for the two
untrusted-input parsers. This complements the stable-toolchain panic-safety
tests in `tests/proptest_engine.rs` — those run in normal CI on every change;
these run deeper, ad-hoc or on a fuzzing box.

## Targets

- **`formula_parser`** — arbitrary text as a cell formula → the lexer / parser /
  evaluator must not panic.
- **`xlsx_loader`** — arbitrary bytes → `Workbook::from_file` must return `Err`,
  never panic or hang (the user-upload path).

## Prerequisites

Needs a nightly toolchain (libfuzzer-sys) and cargo-fuzz:

```bash
cargo install cargo-fuzz          # once
```

## Run

```bash
# from the repo root
cargo +nightly fuzz run xlsx_loader
cargo +nightly fuzz run formula_parser

# time-boxed (e.g. in CI):
cargo +nightly fuzz run xlsx_loader -- -max_total_time=120
```

A crash writes a reproducer under `fuzz/artifacts/<target>/`; re-run it with
`cargo +nightly fuzz run <target> fuzz/artifacts/<target>/<crash-file>` and add a
permanent regression to `tests/proptest_engine.rs` (or a `tests/**.script`) once
fixed.

This crate is excluded from the main workspace (root `Cargo.toml`
`exclude = ["fuzz"]`) so `cargo build/test --workspace` on stable ignores it.
