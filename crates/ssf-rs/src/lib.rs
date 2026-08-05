//! # ssf-rs
//!
//! A faithful Rust port of [SheetJS's `ssf`](https://github.com/SheetJS/ssf)
//! (SpreadSheet Format) — renders a value with an Excel number-format code to a
//! display string. This is the piece needed to implement Excel's
//! `TEXT(value, format_text)` natively in Rust.
//!
//! **Attribution:** derived from `ssf` v0.11.2, `(C) 2013-present SheetJS LLC`,
//! licensed under Apache-2.0. See `NOTICE` and `README.md`. Changes from
//! upstream are documented in `NOTICE`.
//!
//! ```
//! use ssf_rs::format_str;
//! assert_eq!(format_str("0.00%", 0.1234).unwrap(), "12.34%");
//! assert_eq!(format_str("#,##0.00", 1234.5).unwrap(), "1,234.50");
//! ```

pub mod datecode;
pub mod evalfmt;
pub mod format;
pub mod general;
pub mod helpers;
pub mod jsnum;
pub mod tables;
pub mod writenum;

pub use evalfmt::{fmt_is_date as is_date, Value};
pub use format::{format, format_id};

/// Convenience: format a number `val` with a string format code.
pub fn format_str(fmt: &str, val: f64) -> Result<String, String> {
    format::format(fmt, &Value::Num(val), false)
}

/// Convenience: format text `val` with a string format code.
pub fn format_text(fmt: &str, val: &str) -> Result<String, String> {
    format::format(fmt, &Value::Text(val.to_string()), false)
}
