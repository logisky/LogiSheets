//! Autofill prediction (the "fill handle").
//!
//! This is a **pure, read-only query**: given a source range and the
//! target range a user dragged the fill handle over, it computes the
//! content each target cell should receive and returns a batch of
//! [`CellInput`]. It never mutates the workbook — the caller wraps the
//! returned inputs in a single `EditAction`/transaction, so the fill is
//! one undo step and flows through the normal edit pipeline.
//!
//! ## Where the logic lives
//!
//! All semantics are in Rust. The relative-reference translation reuses
//! the formula engine via [`unparse_with_shift`](logisheets_parser::unparse::unparse_with_shift):
//! a formula's AST is unparsed as if it lived at the target cell, so
//! absolute (`$`) components, cross-sheet prefixes and defined names are
//! handled exactly as the engine already handles them. The front-end only
//! supplies geometry (which cells, which direction) and dispatches the
//! transaction.
//!
//! ## Abstraction note (future copy/paste)
//!
//! Copy/paste is "fill without sequence inference": the same
//! [`Worksheet::get_formula_with_shift_by_id`] primitive translates a
//! formula from one cell to another. When copy/paste lands it should
//! share that primitive rather than reimplementing reference shifting.
//!
//! ## MVP scope
//!
//! Three rules, covering the common cases:
//!   1. **Single-value / periodic copy** — repeat the source block.
//!   2. **Formula relative shift** — translate references per target.
//!   3. **Arithmetic series** — linear extrapolation for numeric sources.
//!
//! Date stepping, text+number suffix increment and richer pattern
//! detection are deliberately left for later iterations.

use logisheets_base::CellId;
use logisheets_parser::unparse::CellShift;

use crate::controller::display::Value;
use crate::edit_action::CellInput;
use crate::errors::{Error, Result};
use crate::api::worksheet::Worksheet;
use crate::Workbook;

/// A rectangular block of cells, in row/col indices (0-based, inclusive).
#[derive(Debug, Clone, Copy)]
pub struct FillRange {
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
}

/// The axis the fill extends along. Inferred from the geometry of the
/// source and target ranges.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Axis {
    Vertical,
    Horizontal,
}

/// What a single source cell holds, used to decide the per-line fill rule.
enum SrcCell {
    Formula(CellId),
    Number(f64),
    /// Raw input string for non-numeric, non-formula cells (text, bool,
    /// error, empty). Copied verbatim.
    Raw(String),
}

impl Workbook {
    /// Predict the contents of a fill-handle drag.
    ///
    /// `src` is the selected source block; `dst` is the (disjoint) block
    /// the user dragged over. Returns one [`CellInput`] per target cell.
    /// The caller is expected to wrap them in a single transaction.
    pub fn predict_fill(
        &self,
        sheet_idx: usize,
        src: FillRange,
        dst: FillRange,
    ) -> Result<Vec<CellInput>> {
        let ws = self.get_sheet_by_idx(sheet_idx)?;
        let cells = ws.predict_fill(src, dst)?;
        Ok(cells
            .into_iter()
            .map(|(row, col, content)| CellInput {
                sheet_idx,
                row,
                col,
                content,
            })
            .collect())
    }
}

impl<'a> Worksheet<'a> {
    /// Core fill prediction for a single sheet. Returns
    /// `(row, col, content)` for every target cell.
    pub(crate) fn predict_fill(
        &self,
        src: FillRange,
        dst: FillRange,
    ) -> Result<Vec<(usize, usize, String)>> {
        let axis = infer_axis(src, dst)?;
        let mut out = Vec::new();
        match axis {
            // Each column is an independent series along the rows.
            Axis::Vertical => {
                let src_positions: Vec<usize> = (src.start_row..=src.end_row).collect();
                let targets: Vec<usize> = (dst.start_row..=dst.end_row).collect();
                for col in src.start_col..=src.end_col {
                    let src_cells = self.collect_line(&src_positions, |&row| (row, col))?;
                    self.fill_line(
                        &src_positions,
                        &src_cells,
                        &targets,
                        axis,
                        |pos, content| out.push((pos, col, content)),
                    )?;
                }
            }
            // Each row is an independent series along the columns.
            Axis::Horizontal => {
                let src_positions: Vec<usize> = (src.start_col..=src.end_col).collect();
                let targets: Vec<usize> = (dst.start_col..=dst.end_col).collect();
                for row in src.start_row..=src.end_row {
                    let src_cells = self.collect_line(&src_positions, |&col| (row, col))?;
                    self.fill_line(
                        &src_positions,
                        &src_cells,
                        &targets,
                        axis,
                        |pos, content| out.push((row, pos, content)),
                    )?;
                }
            }
        }
        Ok(out)
    }

    /// Classify each source cell on one line (row or column).
    fn collect_line(
        &self,
        positions: &[usize],
        to_rc: impl Fn(&usize) -> (usize, usize),
    ) -> Result<Vec<SrcCell>> {
        positions
            .iter()
            .map(|p| {
                let (row, col) = to_rc(p);
                let cell_id = self
                    .controller
                    .status
                    .navigator
                    .fetch_cell_id(&self.sheet_id, row, col)?;
                if self.has_formula(&cell_id) {
                    Ok(SrcCell::Formula(cell_id))
                } else {
                    Ok(match self.get_value_by_id(&cell_id)? {
                        Value::Number(n) => SrcCell::Number(n),
                        v => SrcCell::Raw(value_to_input(&v)),
                    })
                }
            })
            .collect()
    }

    /// Emit content for every target on a single line, picking the fill
    /// rule from the source cells.
    fn fill_line(
        &self,
        src_positions: &[usize],
        src_cells: &[SrcCell],
        targets: &[usize],
        axis: Axis,
        mut emit: impl FnMut(usize, String),
    ) -> Result<()> {
        let n = src_cells.len();
        if n == 0 {
            return Ok(());
        }
        let first = src_positions[0] as i64;

        let all_formula = src_cells.iter().all(|c| matches!(c, SrcCell::Formula(_)));
        let arithmetic = (n >= 2)
            .then(|| numeric_series(src_cells))
            .flatten();

        for &t in targets {
            let content = if let Some((v0, step)) = arithmetic {
                // Arithmetic series: linear extrapolation from the anchor.
                let value = v0 + step * ((t as i64 - first) as f64);
                format_number(value)
            } else if all_formula {
                let idx = (t as i64 - first).rem_euclid(n as i64) as usize;
                self.shifted_formula(src_positions[idx], src_cells[idx].cell_id(), t, axis)?
            } else {
                // Periodic copy of the source block.
                let idx = (t as i64 - first).rem_euclid(n as i64) as usize;
                match &src_cells[idx] {
                    SrcCell::Formula(id) => self.shifted_formula(src_positions[idx], *id, t, axis)?,
                    SrcCell::Number(num) => format_number(*num),
                    SrcCell::Raw(s) => s.clone(),
                }
            };
            emit(t, content);
        }
        Ok(())
    }

    /// Translate the formula at `src_pos` to target position `t`,
    /// shifting relative references along `axis`. Returns a `=`-prefixed
    /// formula string ready for [`CellInput`].
    fn shifted_formula(
        &self,
        src_pos: usize,
        cell_id: CellId,
        t: usize,
        axis: Axis,
    ) -> Result<String> {
        let delta = t as i32 - src_pos as i32;
        let shift = match axis {
            Axis::Vertical => CellShift::new(delta, 0),
            Axis::Horizontal => CellShift::new(0, delta),
        };
        let f = self.get_formula_with_shift_by_id(&cell_id, shift)?;
        Ok(format!("={}", f))
    }
}

impl SrcCell {
    fn cell_id(&self) -> CellId {
        match self {
            SrcCell::Formula(id) => *id,
            // Only ever called when the line is all-formula.
            _ => unreachable!("cell_id called on non-formula source cell"),
        }
    }
}

/// Decide the fill axis from the source/target geometry. The two ranges
/// must align on one axis (a pure vertical or horizontal drag).
fn infer_axis(src: FillRange, dst: FillRange) -> Result<Axis> {
    let same_cols = src.start_col == dst.start_col && src.end_col == dst.end_col;
    let same_rows = src.start_row == dst.start_row && src.end_row == dst.end_row;
    if same_cols && !same_rows {
        Ok(Axis::Vertical)
    } else if same_rows && !same_cols {
        Ok(Axis::Horizontal)
    } else {
        Err(Error::PayloadError(
            "fill source and target must align on a single axis".to_string(),
        ))
    }
}

/// If every source cell is a number and they form an arithmetic series,
/// return `(anchor_value, step)` where `step` is the per-position delta
/// measured against the first source cell. `None` otherwise.
fn numeric_series(src_cells: &[SrcCell]) -> Option<(f64, f64)> {
    let nums: Option<Vec<f64>> = src_cells
        .iter()
        .map(|c| match c {
            SrcCell::Number(n) => Some(*n),
            _ => None,
        })
        .collect();
    let nums = nums?;
    let n = nums.len();
    if n < 2 {
        return None;
    }
    // Step from the endpoints; treat any non-decreasing index spacing as 1
    // (source cells are contiguous along the axis).
    let step = (nums[n - 1] - nums[0]) / (n as f64 - 1.0);
    Some((nums[0], step))
}

/// Render the raw input string the fill should write for a copied value.
fn value_to_input(v: &Value) -> String {
    match v {
        Value::Str(s) => s.clone(),
        Value::Bool(b) => if *b { "TRUE" } else { "FALSE" }.to_string(),
        Value::Number(n) => format_number(*n),
        Value::Error(s) => s.clone(),
        Value::Empty => String::new(),
    }
}

fn format_number(n: f64) -> String {
    format!("{}", n)
}

#[cfg(test)]
mod tests {
    use super::FillRange;
    use crate::edit_action::{CellInput, EditAction, EditPayload, PayloadsAction};
    use crate::Workbook;

    fn input(wb: &mut Workbook, row: usize, col: usize, content: &str) {
        wb.handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx: 0,
                row,
                col,
                content: content.to_string(),
            })],
            undoable: true,
            init: false,
        }));
    }

    fn rng(start_row: usize, start_col: usize, end_row: usize, end_col: usize) -> FillRange {
        FillRange {
            start_row,
            start_col,
            end_row,
            end_col,
        }
    }

    #[test]
    fn fill_arithmetic_down() {
        let mut wb = Workbook::default();
        input(&mut wb, 0, 0, "1");
        input(&mut wb, 1, 0, "2");
        let res = wb
            .predict_fill(0, rng(0, 0, 1, 0), rng(2, 0, 4, 0))
            .unwrap();
        let contents: Vec<_> = res.iter().map(|c| (c.row, c.content.clone())).collect();
        assert_eq!(
            contents,
            vec![
                (2, "3".to_string()),
                (3, "4".to_string()),
                (4, "5".to_string())
            ]
        );
    }

    #[test]
    fn fill_formula_relative_shift() {
        let mut wb = Workbook::default();
        // B1 = A1 * 2
        input(&mut wb, 0, 1, "=A1*2");
        let res = wb
            .predict_fill(0, rng(0, 1, 0, 1), rng(1, 1, 2, 1))
            .unwrap();
        let contents: Vec<_> = res.iter().map(|c| c.content.clone()).collect();
        assert_eq!(contents, vec!["=A2 * 2".to_string(), "=A3 * 2".to_string()]);
    }

    #[test]
    fn fill_formula_absolute_ref_unchanged() {
        let mut wb = Workbook::default();
        input(&mut wb, 0, 1, "=$A$1+A1");
        let res = wb
            .predict_fill(0, rng(0, 1, 0, 1), rng(1, 1, 1, 1))
            .unwrap();
        assert_eq!(res[0].content, "=$A$1 + A2".to_string());
    }

    #[test]
    fn fill_single_value_copy() {
        let mut wb = Workbook::default();
        input(&mut wb, 0, 2, "hello");
        let res = wb
            .predict_fill(0, rng(0, 2, 0, 2), rng(1, 2, 2, 2))
            .unwrap();
        let contents: Vec<_> = res.iter().map(|c| c.content.clone()).collect();
        assert_eq!(contents, vec!["hello".to_string(), "hello".to_string()]);
    }

    #[test]
    fn fill_single_number_copies_not_increments() {
        let mut wb = Workbook::default();
        input(&mut wb, 0, 3, "5");
        let res = wb
            .predict_fill(0, rng(0, 3, 0, 3), rng(1, 3, 2, 3))
            .unwrap();
        let contents: Vec<_> = res.iter().map(|c| c.content.clone()).collect();
        assert_eq!(contents, vec!["5".to_string(), "5".to_string()]);
    }

    #[test]
    fn fill_horizontal_arithmetic() {
        let mut wb = Workbook::default();
        input(&mut wb, 0, 0, "10");
        input(&mut wb, 0, 1, "20");
        let res = wb
            .predict_fill(0, rng(0, 0, 0, 1), rng(0, 2, 0, 3))
            .unwrap();
        let contents: Vec<_> = res.iter().map(|c| (c.col, c.content.clone())).collect();
        assert_eq!(
            contents,
            vec![(2, "30".to_string()), (3, "40".to_string())]
        );
    }
}
