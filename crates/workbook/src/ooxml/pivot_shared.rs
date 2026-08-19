//! Shared pivot "cache item" value types used by both pivotCacheRecords
//! (§18.10.1.73) and the `sharedItems` / `groupItems` of pivotCacheDefinition
//! (§18.10.1.90, §18.10.1.38). ECMA-376 §18.10.

use xmlserde_derives::{XmlDeserialize, XmlSerialize};

use super::defaults::{default_false, default_zero_i64};

/// CT_X (§18.10.1.99) — a shared-item index (`x`). Also reused across the pivot
/// table part (row/col items, references, …).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtX {
    /// Widened past the schema's `xsd:int` on purpose: Excel writes the
    /// "no item" sentinel as `4294967295` (`u32::MAX`), which overflows an
    /// `i32`. xmlserde PANICS on an attribute it can't parse, so a narrow type
    /// here made any workbook with a pivot cache using that sentinel impossible
    /// to open. `i64` accepts the sentinel and a negative form both, and
    /// round-trips either spelling unchanged.
    #[xmlserde(name = b"v", ty = "attr", default = "default_zero_i64")]
    pub v: i64,
}

/// CT_Tuple (§18.10.1.94).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtTuple {
    #[xmlserde(name = b"fld", ty = "attr")]
    pub fld: Option<u32>,
    #[xmlserde(name = b"hier", ty = "attr")]
    pub hier: Option<u32>,
    #[xmlserde(name = b"item", ty = "attr")]
    pub item: u32,
}

/// CT_Tuples (§18.10.1.95).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtTuples {
    #[xmlserde(name = b"c", ty = "attr")]
    pub c: Option<u32>,
    #[xmlserde(name = b"tpl", ty = "child")]
    pub tpl: Vec<CtTuple>,
}

/// CT_Missing (§18.10.1.53) — a missing/blank shared item (`m`).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtMissing {
    #[xmlserde(name = b"u", ty = "attr", default = "default_false")]
    pub u: bool,
    #[xmlserde(name = b"f", ty = "attr", default = "default_false")]
    pub f: bool,
    #[xmlserde(name = b"c", ty = "attr")]
    pub c: Option<String>,
    #[xmlserde(name = b"cp", ty = "attr")]
    pub cp: Option<u32>,
    #[xmlserde(name = b"in", ty = "attr")]
    pub r#in: Option<u32>,
    #[xmlserde(name = b"bc", ty = "attr")]
    pub bc: Option<String>,
    #[xmlserde(name = b"fc", ty = "attr")]
    pub fc: Option<String>,
    #[xmlserde(name = b"i", ty = "attr", default = "default_false")]
    pub i: bool,
    #[xmlserde(name = b"un", ty = "attr", default = "default_false")]
    pub un: bool,
    #[xmlserde(name = b"st", ty = "attr", default = "default_false")]
    pub st: bool,
    #[xmlserde(name = b"b", ty = "attr", default = "default_false")]
    pub b: bool,
    #[xmlserde(name = b"tpls", ty = "child")]
    pub tpls: Vec<CtTuples>,
    #[xmlserde(name = b"x", ty = "child")]
    pub x: Vec<CtX>,
}

/// CT_Number (§18.10.1.64) — a numeric shared item (`n`).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtNumber {
    #[xmlserde(name = b"v", ty = "attr")]
    pub v: f64,
    #[xmlserde(name = b"u", ty = "attr", default = "default_false")]
    pub u: bool,
    #[xmlserde(name = b"f", ty = "attr", default = "default_false")]
    pub f: bool,
    #[xmlserde(name = b"c", ty = "attr")]
    pub c: Option<String>,
    #[xmlserde(name = b"cp", ty = "attr")]
    pub cp: Option<u32>,
    #[xmlserde(name = b"in", ty = "attr")]
    pub r#in: Option<u32>,
    #[xmlserde(name = b"bc", ty = "attr")]
    pub bc: Option<String>,
    #[xmlserde(name = b"fc", ty = "attr")]
    pub fc: Option<String>,
    #[xmlserde(name = b"i", ty = "attr", default = "default_false")]
    pub i: bool,
    #[xmlserde(name = b"un", ty = "attr", default = "default_false")]
    pub un: bool,
    #[xmlserde(name = b"st", ty = "attr", default = "default_false")]
    pub st: bool,
    #[xmlserde(name = b"b", ty = "attr", default = "default_false")]
    pub b: bool,
    #[xmlserde(name = b"tpls", ty = "child")]
    pub tpls: Vec<CtTuples>,
    #[xmlserde(name = b"x", ty = "child")]
    pub x: Vec<CtX>,
}

/// CT_Boolean (§18.10.1.4) — a boolean shared item (`b`).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtBoolean {
    #[xmlserde(name = b"v", ty = "attr")]
    pub v: bool,
    #[xmlserde(name = b"u", ty = "attr", default = "default_false")]
    pub u: bool,
    #[xmlserde(name = b"f", ty = "attr", default = "default_false")]
    pub f: bool,
    #[xmlserde(name = b"c", ty = "attr")]
    pub c: Option<String>,
    #[xmlserde(name = b"cp", ty = "attr")]
    pub cp: Option<u32>,
    #[xmlserde(name = b"x", ty = "child")]
    pub x: Vec<CtX>,
}

/// CT_Error (§18.10.1.25) — an error-value shared item (`e`).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtError {
    #[xmlserde(name = b"v", ty = "attr")]
    pub v: String,
    #[xmlserde(name = b"u", ty = "attr", default = "default_false")]
    pub u: bool,
    #[xmlserde(name = b"f", ty = "attr", default = "default_false")]
    pub f: bool,
    #[xmlserde(name = b"c", ty = "attr")]
    pub c: Option<String>,
    #[xmlserde(name = b"cp", ty = "attr")]
    pub cp: Option<u32>,
    #[xmlserde(name = b"in", ty = "attr")]
    pub r#in: Option<u32>,
    #[xmlserde(name = b"bc", ty = "attr")]
    pub bc: Option<String>,
    #[xmlserde(name = b"fc", ty = "attr")]
    pub fc: Option<String>,
    #[xmlserde(name = b"i", ty = "attr", default = "default_false")]
    pub i: bool,
    #[xmlserde(name = b"un", ty = "attr", default = "default_false")]
    pub un: bool,
    #[xmlserde(name = b"st", ty = "attr", default = "default_false")]
    pub st: bool,
    #[xmlserde(name = b"b", ty = "attr", default = "default_false")]
    pub b: bool,
    #[xmlserde(name = b"tpls", ty = "child")]
    pub tpls: Vec<CtTuples>,
    #[xmlserde(name = b"x", ty = "child")]
    pub x: Vec<CtX>,
}

/// CT_String (§18.10.1.91) — a text shared item (`s`).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtString {
    #[xmlserde(name = b"v", ty = "attr")]
    pub v: String,
    #[xmlserde(name = b"u", ty = "attr", default = "default_false")]
    pub u: bool,
    #[xmlserde(name = b"f", ty = "attr", default = "default_false")]
    pub f: bool,
    #[xmlserde(name = b"c", ty = "attr")]
    pub c: Option<String>,
    #[xmlserde(name = b"cp", ty = "attr")]
    pub cp: Option<u32>,
    #[xmlserde(name = b"in", ty = "attr")]
    pub r#in: Option<u32>,
    #[xmlserde(name = b"bc", ty = "attr")]
    pub bc: Option<String>,
    #[xmlserde(name = b"fc", ty = "attr")]
    pub fc: Option<String>,
    #[xmlserde(name = b"i", ty = "attr", default = "default_false")]
    pub i: bool,
    #[xmlserde(name = b"un", ty = "attr", default = "default_false")]
    pub un: bool,
    #[xmlserde(name = b"st", ty = "attr", default = "default_false")]
    pub st: bool,
    #[xmlserde(name = b"b", ty = "attr", default = "default_false")]
    pub b: bool,
    #[xmlserde(name = b"tpls", ty = "child")]
    pub tpls: Vec<CtTuples>,
    #[xmlserde(name = b"x", ty = "child")]
    pub x: Vec<CtX>,
}

/// CT_DateTime (§18.10.1.21) — a date/time shared item (`d`).
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub struct CtDateTime {
    #[xmlserde(name = b"v", ty = "attr")]
    pub v: String,
    #[xmlserde(name = b"u", ty = "attr", default = "default_false")]
    pub u: bool,
    #[xmlserde(name = b"f", ty = "attr", default = "default_false")]
    pub f: bool,
    #[xmlserde(name = b"c", ty = "attr")]
    pub c: Option<String>,
    #[xmlserde(name = b"cp", ty = "attr")]
    pub cp: Option<u32>,
    #[xmlserde(name = b"x", ty = "child")]
    pub x: Vec<CtX>,
}

/// Choice group for the items of a `sharedItems` / `groupItems` list
/// (no `x` index — these DEFINE the items). §18.10.1.90.
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub enum PivotSharedItem {
    #[xmlserde(name = b"m")]
    Missing(CtMissing),
    #[xmlserde(name = b"n")]
    Number(CtNumber),
    #[xmlserde(name = b"b")]
    Boolean(CtBoolean),
    #[xmlserde(name = b"e")]
    Error(CtError),
    #[xmlserde(name = b"s")]
    String(CtString),
    #[xmlserde(name = b"d")]
    DateTime(CtDateTime),
}

/// Choice group for a cache record's fields (`x` references a shared item;
/// the others are inline values). §18.10.1.79.
#[derive(Debug, Clone, XmlSerialize, XmlDeserialize)]
pub enum PivotRecordItem {
    #[xmlserde(name = b"m")]
    Missing(CtMissing),
    #[xmlserde(name = b"n")]
    Number(CtNumber),
    #[xmlserde(name = b"b")]
    Boolean(CtBoolean),
    #[xmlserde(name = b"e")]
    Error(CtError),
    #[xmlserde(name = b"s")]
    String(CtString),
    #[xmlserde(name = b"d")]
    DateTime(CtDateTime),
    #[xmlserde(name = b"x")]
    Index(CtX),
}

