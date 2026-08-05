# ssf-rs

A faithful Rust port of **[ssf](https://github.com/SheetJS/ssf)** ("SpreadSheet
Format"), the number-format renderer from [SheetJS](https://sheetjs.com).

Given a value and an Excel number-format code, it produces the display string
that a spreadsheet would show:

```rust
use ssf_rs::format_str;

assert_eq!(format_str("0.00%", 0.1234).unwrap(), "12.34%");
assert_eq!(format_str("#,##0.00", 1234.5).unwrap(), "1,234.50");
assert_eq!(format_str("yyyy-mm-dd", 45000.0).unwrap(), "2023-03-15");
```

This is the piece needed to implement Excel's `TEXT(value, format_text)`
worksheet function natively in Rust, without offloading formatting to a
JavaScript host.

## Attribution

**This crate is a derivative work of SheetJS's `ssf`.** The original is:

> ssf.js (C) 2013-present SheetJS LLC — <https://sheetjs.com>
> Licensed under the Apache License, Version 2.0.

Ported from `ssf` **v0.11.2**. The algorithms, the format-code grammar, the
edge-case handling, and the numeric-formatting behavior all originate from the
upstream JavaScript source; this crate re-expresses them in Rust as directly as
practical so behavior stays byte-for-byte compatible.

`ssf-rs` is licensed under **Apache-2.0** (see [`LICENSE`](./LICENSE)) to match
upstream. Changes made in this port are recorded in [`NOTICE`](./NOTICE).

> Note on the name: this crate is named `ssf-rs` for clarity. It is **not**
> affiliated with or endorsed by SheetJS LLC. "SheetJS" and "ssf" are used only
> to attribute the origin of the ported code.

## Divergences from upstream

Kept as few as possible. Each is documented at its call site and in `NOTICE`:

- **Dates are computed with pure civil-date arithmetic** instead of the host
  `Date` object, so results are deterministic and timezone-independent (the JS
  original reads a local-time `Date`, which can drift around DST). For the
  serial → calendar direction this matches Excel exactly.
- Public API returns `Result<String, _>` where the JS original throws.

## Testing

Unit tests cover the documented cases. A **differential test suite** generates
many `(format, value)` pairs and compares this crate's output against the
reference `ssf` running under Node.js — the authoritative oracle. See
[`tests/`](./tests). The differential tests are ignored by default (they need
`node` + a local `ssf` install); run them with:

```bash
cargo test -p ssf-rs -- --ignored
```
