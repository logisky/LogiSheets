// Fuzz the .xlsx loader with arbitrary bytes — the untrusted-upload path
// (douyoushu ingests user-provided workbooks). It must return Err, never panic
// or hang. Stable counterpart: `arbitrary_bytes_never_panic_xlsx` in
// tests/proptest_engine.rs; this explores the ZIP + XML parse paths far deeper.
#![no_main]

use libfuzzer_sys::fuzz_target;
use logisheets::Workbook;

fuzz_target!(|data: &[u8]| {
    let _ = Workbook::from_file(data, "fuzz".to_string());
});
