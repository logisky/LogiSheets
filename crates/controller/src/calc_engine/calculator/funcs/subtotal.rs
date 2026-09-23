//! SUBTOTAL(function_num, ref1, …) — apply an aggregate to the refs, chosen by
//! `function_num` (1–11 include hidden rows, 101–111 exclude them). Headless
//! there are no hidden rows, so both ranges behave identically and we simply
//! dispatch to the matching aggregate.

use super::{aggregate, average, count, distribution, sum};
use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Reference, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let first = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(fnum, first);
    // Nested SUBTOTALs are blanked out before the aggregate ever sees them.
    let rest: Vec<CalcVertex> = iter.map(|v| without_nested(v, fetcher)).collect();

    // 101–111 (exclude hidden) collapse onto 1–11 in a headless engine.
    let code = {
        let n = fnum.trunc() as i64;
        if n >= 101 { n - 100 } else { n }
    };
    match code {
        1 => average::calc_average(rest, fetcher),
        2 => count::calc(rest, fetcher),
        3 => count::calc_counta(rest, fetcher),
        4 => aggregate::calc_max(rest, fetcher),
        5 => aggregate::calc_min(rest, fetcher),
        6 => aggregate::calc_product(rest, fetcher),
        7 => distribution::statistics::calc_stdev(rest, fetcher),
        8 => distribution::statistics::calc_stdevp(rest, fetcher),
        9 => sum::calc(rest, fetcher),
        10 => distribution::statistics::calc_var(rest, fetcher),
        11 => distribution::statistics::calc_varp(rest, fetcher),
        _ => CalcVertex::from_error(ast::Error::Value),
    }
}

/// Blank out every cell of `v` that itself holds a SUBTOTAL formula.
///
/// **This is the whole reason SUBTOTAL exists rather than SUM.** The shape it
/// is built for is a column of groups, each with its own subtotal, and a grand
/// total at the bottom whose range spans the lot; if the grand total counted
/// the group subtotals it would report double. Excel documents it as "nested
/// subtotals are ignored to avoid double counting".
///
/// Masks rather than re-reads: the range is fetched once and the offending
/// positions are overwritten, so this costs one formula lookup per cell rather
/// than a second evaluation.
///
/// Whole-column and whole-row references are passed through untouched — the
/// mask is positional and there is no bounded matrix to walk. A nested
/// subtotal inside `SUBTOTAL(9,A:A)` is therefore still counted.
fn without_nested<C>(v: CalcVertex, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let (sheet, start) = match &v {
        CalcVertex::Reference(r) => match &r.reference {
            Reference::Addr(a) => (r.sheet, *a),
            Reference::Range(s, _) => (r.sheet, *s),
            _ => return v,
        },
        _ => return v,
    };
    match fetcher.get_calc_value(v) {
        CalcValue::Range(mut m) => {
            let (rows, cols) = m.get_size();
            for i in 0..rows {
                for j in 0..cols {
                    if is_subtotal(fetcher, sheet, start.row + i, start.col + j) {
                        m.insert(i, j, Value::Blank);
                    }
                }
            }
            CalcVertex::Value(CalcValue::Range(m))
        }
        CalcValue::Scalar(s) => {
            if is_subtotal(fetcher, sheet, start.row, start.col) {
                CalcVertex::Value(CalcValue::Scalar(Value::Blank))
            } else {
                CalcVertex::Value(CalcValue::Scalar(s))
            }
        }
        other => CalcVertex::Value(other),
    }
}

/// Whether the cell at `(row, col)` is a SUBTOTAL formula.
///
/// Matched on the formula text beginning with `SUBTOTAL(`, which is the shape
/// the rule exists for — a cell whose job is to be a group total. A formula
/// that merely contains one further in (`=2*SUBTOTAL(...)`) is not caught;
/// that is a deliberate limit, not an oversight, because deciding it properly
/// means inspecting the parsed AST rather than the text.
fn is_subtotal<C>(fetcher: &C, sheet: logisheets_base::SheetId, row: usize, col: usize) -> bool
where
    C: Connector,
{
    let Ok(cell_id) = fetcher.get_cell_id(sheet, row, col) else {
        return false;
    };
    let Some(f) = fetcher.get_formula_string(sheet, &cell_id) else {
        return false;
    };
    f.trim_start()
        .trim_start_matches('=')
        .trim_start()
        .to_uppercase()
        .starts_with("SUBTOTAL(")
}
