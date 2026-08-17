use crate::calc_engine::calculator::calc_vertex::Reference;
use crate::calc_engine::connector::Connector;

use super::CalcVertex;

use logisheets_parser::ast;

/// `FORMULATEXT(reference)` — the formula in the top-left cell of `reference`,
/// returned as text with a leading `=` (e.g. `=SUM(A1:A2)`).
///
/// Returns `#N/A` when that cell carries no formula, or when the argument is
/// not a reference — matching Excel.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let reference = match args.into_iter().next().unwrap() {
        CalcVertex::Reference(r) => r,
        _ => return CalcVertex::from_error(ast::Error::Na),
    };
    // FORMULATEXT operates on the top-left cell of the referenced area.
    let (row, col) = match reference.reference {
        Reference::Addr(a) => (a.row, a.col),
        Reference::Range(s, _) => (s.row, s.col),
        Reference::ColumnRange(cr) => (0, cr.start),
        Reference::RowRange(rr) => (rr.start, 0),
    };
    let sheet = reference.sheet;
    let cell_id = match fetcher.get_cell_id(sheet, row, col) {
        Ok(id) => id,
        Err(_) => return CalcVertex::from_error(ast::Error::Na),
    };
    match fetcher.get_formula_string(sheet, &cell_id) {
        Some(f) if !f.is_empty() => CalcVertex::from_text(format!("={}", f)),
        _ => CalcVertex::from_error(ast::Error::Na),
    }
}
