//! A chart's data ranges, held as cell ids rather than as the A1 text the file
//! stores.
//!
//! Everything else the engine anchors — a chart's own corners, a formula's
//! arguments, a block's extent — is held by id and turned back into positions
//! only on the way out. Chart data ranges were the exception: they were kept as
//! the `Sheet1!$B$2:$E$2` string OOXML puts them in, and nothing rewrote it. A
//! row inserted above the data moved the values down while the string stayed
//! put, so the chart resolved a range of now-empty cells and rendered blank.
//!
//! Holding the two corners as [`CellId`]s fixes that for free, and gets the
//! rest of Excel's behaviour with it: a row inserted *inside* the range widens
//! it, because the rectangle is whatever currently lies between the corners.
//!
//! The A1 text in [`ChartData`] stays as a cache. It is what a range falls back
//! to when a corner's cell no longer exists — a deleted endpoint leaves nothing
//! to resolve, and the file's own text is a better answer than nothing.
//!
//! [`ChartData`]: logisheets_workbook::prelude::ChartData

use logisheets_base::{CellId, NormalRange, Range, SheetId, index_to_column_label};

use crate::id_manager::SheetIdManager;
use crate::navigator::Navigator;

/// One data range of a chart: which sheet, and the cells themselves.
#[derive(Debug, Clone)]
pub struct ChartRange {
    /// The sheet the range lives on, which is not always the chart's own —
    /// a series may read from another sheet.
    pub sheet: SheetId,
    pub range: Range,
}

/// Every range a chart reads, parallel to its `ChartData`.
#[derive(Debug, Clone, Default)]
pub struct ChartRefs {
    pub cat: Option<ChartRange>,
    /// Index-aligned with `ChartData::series`.
    pub series: Vec<ChartSeriesRefs>,
}

#[derive(Debug, Clone, Default)]
pub struct ChartSeriesRefs {
    pub val: Option<ChartRange>,
    /// A bubble chart's third dimension; `None` on every other kind.
    pub size: Option<ChartRange>,
}

impl ChartRefs {
    /// The ranges of `data`, read from its A1 text. Called once, when a chart
    /// is loaded or re-pointed — from then on the ids are what move.
    pub fn from_data(
        nav: &Navigator,
        sheets: &SheetIdManager,
        default_sheet: SheetId,
        data: &logisheets_workbook::prelude::ChartData,
    ) -> Self {
        let parse = |r: &Option<String>| {
            r.as_deref()
                .and_then(|r| ChartRange::parse(nav, sheets, default_sheet, r))
        };
        ChartRefs {
            cat: parse(&data.cat_ref),
            series: data
                .series
                .iter()
                .map(|s| ChartSeriesRefs {
                    val: parse(&s.val_ref),
                    size: parse(&s.size_ref),
                })
                .collect(),
        }
    }

    pub fn series_at(&self, i: usize) -> Option<&ChartSeriesRefs> {
        self.series.get(i)
    }
}

impl ChartRange {
    /// Resolve an A1 reference against the sheet as it is now.
    ///
    /// `default_sheet` is used when the reference names none, which is how
    /// OOXML writes a range on the chart's own sheet.
    pub fn parse(
        nav: &Navigator,
        sheets: &SheetIdManager,
        default_sheet: SheetId,
        text: &str,
    ) -> Option<Self> {
        let (sheet_name, sr, sc, er, ec) = parse_a1_range(text)?;
        let sheet = match sheet_name {
            Some(name) => *sheets.get_id(&name)?,
            None => default_sheet,
        };
        let start = nav.fetch_cell_id(&sheet, sr, sc).ok()?;
        let end = nav.fetch_cell_id(&sheet, er, ec).ok()?;
        Some(ChartRange {
            sheet,
            range: addr_range(start, end)?,
        })
    }

    /// The A1 text this range covers right now, or `None` when a corner's cell
    /// is gone — deleted out from under the chart, typically.
    pub fn to_a1(&self, nav: &Navigator, sheets: &SheetIdManager) -> Option<String> {
        let (start, end) = match &self.range {
            Range::Normal(NormalRange::AddrRange(s, e)) => {
                (CellId::NormalCell(s.clone()), CellId::NormalCell(e.clone()))
            }
            Range::Normal(NormalRange::Single(s)) => {
                (CellId::NormalCell(s.clone()), CellId::NormalCell(s.clone()))
            }
            Range::Block(logisheets_base::BlockRange::AddrRange(s, e)) => {
                (CellId::BlockCell(*s), CellId::BlockCell(*e))
            }
            Range::Block(logisheets_base::BlockRange::Single(s)) => {
                (CellId::BlockCell(*s), CellId::BlockCell(*s))
            }
            // Row/column ranges and ephemeral cells are not something a chart
            // reference can name.
            _ => return None,
        };
        let (sr, sc) = nav.fetch_cell_idx(&self.sheet, &start).ok()?;
        let (er, ec) = nav.fetch_cell_idx(&self.sheet, &end).ok()?;
        let name = sheets.get_string(&self.sheet)?;
        Some(format_a1(
            &name,
            sr.min(er),
            sc.min(ec),
            sr.max(er),
            sc.max(ec),
        ))
    }
}

/// Two corners → the range between them, when both are the same kind of cell.
///
/// A reference straddling a block boundary has no single id-based shape, so it
/// keeps its text instead of being silently narrowed to one side.
fn addr_range(start: CellId, end: CellId) -> Option<Range> {
    match (start, end) {
        (CellId::NormalCell(s), CellId::NormalCell(e)) => {
            Some(Range::Normal(NormalRange::AddrRange(s, e)))
        }
        (CellId::BlockCell(s), CellId::BlockCell(e)) if s.block_id == e.block_id => {
            Some(Range::Block(logisheets_base::BlockRange::AddrRange(s, e)))
        }
        _ => None,
    }
}

/// `Sheet1!$B$2:$E$2`, quoting the sheet name only when it needs it — an
/// unnecessary quote parses fine but differs from what the user sees.
pub fn format_a1(sheet: &str, sr: usize, sc: usize, er: usize, ec: usize) -> String {
    let needs_quote = sheet.is_empty()
        || sheet
            .chars()
            .any(|c| !(c.is_alphanumeric() || c == '_' || c == '.'))
        || sheet.chars().next().is_some_and(|c| c.is_ascii_digit());
    let name = if needs_quote {
        format!("'{}'", sheet.replace('\'', "''"))
    } else {
        sheet.to_string()
    };
    format!(
        "{}!${}${}:${}${}",
        name,
        index_to_column_label(sc),
        sr + 1,
        index_to_column_label(ec),
        er + 1,
    )
}

/// `Sheet1!$B$2:$E$2` → `(sheet, start_row, start_col, end_row, end_col)`,
/// all 0-based. A single cell reads as a range of one.
pub fn parse_a1_range(s: &str) -> Option<(Option<String>, usize, usize, usize, usize)> {
    let (sheet, range) = match s.rfind('!') {
        Some(i) => {
            let mut name = s[..i].to_string();
            if name.len() >= 2 && name.starts_with('\'') && name.ends_with('\'') {
                name = name[1..name.len() - 1].replace("''", "'");
            }
            (Some(name), &s[i + 1..])
        }
        None => (None, s),
    };
    let (start, end) = match range.split_once(':') {
        Some((a, b)) => (a, b),
        None => (range, range),
    };
    let (c1, r1) = parse_a1_cell(start)?;
    let (c2, r2) = parse_a1_cell(end)?;
    Some((sheet, r1.min(r2), c1.min(c2), r1.max(r2), c1.max(c2)))
}

/// A single A1 cell like `$B$2` → `(col, row)`, 0-based.
fn parse_a1_cell(s: &str) -> Option<(usize, usize)> {
    let s = s.replace('$', "");
    let bytes = s.as_bytes();
    let mut i = 0;
    let mut col = 0usize;
    while i < bytes.len() && bytes[i].is_ascii_alphabetic() {
        col = col * 26 + ((bytes[i].to_ascii_uppercase() - b'A') as usize + 1);
        i += 1;
    }
    if i == 0 || i >= bytes.len() {
        return None;
    }
    let row: usize = s[i..].parse().ok()?;
    if col == 0 || row == 0 {
        return None;
    }
    Some((col - 1, row - 1))
}
