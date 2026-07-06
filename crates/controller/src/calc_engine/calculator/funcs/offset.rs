use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::calc_vertex::{CalcReference, Reference};
use crate::calc_engine::connector::Connector;
use logisheets_base::Addr;
use logisheets_parser::ast;

/// OFFSET(reference, rows, cols, [height], [width]) — a new reference shifted by
/// `rows`/`cols` from the top-left of `reference`, sized `height`x`width`
/// (defaulting to the base reference's size). Returns a reference (so it works
/// inside SUM(OFFSET(...)) etc.). Off-sheet negative positions or non-positive
/// height/width are #REF!.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 3 && args.len() <= 5, ast::Error::Unspecified);
    // OFFSET is volatile (like RAND/NOW): the cell it moves to can change under
    // it, so mark this cell dirty to force recalculation on every run.
    let _ = fetcher.set_curr_as_dirty();
    let mut it = args.into_iter();

    // The first argument must be a reference; read its top-left and size
    // WITHOUT evaluating it to a value.
    let (from_sheet, sheet, base_row, base_col, base_h, base_w) = match it.next().unwrap() {
        CalcVertex::Reference(r) => match r.reference {
            Reference::Addr(a) => (r.from_sheet, r.sheet, a.row, a.col, 1usize, 1usize),
            Reference::Range(s, e) => (
                r.from_sheet,
                r.sheet,
                s.row,
                s.col,
                e.row.saturating_sub(s.row) + 1,
                e.col.saturating_sub(s.col) + 1,
            ),
            _ => return CalcVertex::from_error(ast::Error::Ref),
        },
        _ => return CalcVertex::from_error(ast::Error::Value),
    };

    let rows_v = fetcher.get_calc_value(it.next().unwrap());
    assert_f64_from_calc_value!(rows, rows_v);
    let cols_v = fetcher.get_calc_value(it.next().unwrap());
    assert_f64_from_calc_value!(cols, cols_v);
    let height = if let Some(a) = it.next() {
        let v = fetcher.get_calc_value(a);
        assert_f64_from_calc_value!(h, v);
        h.trunc() as i64
    } else {
        base_h as i64
    };
    let width = if let Some(a) = it.next() {
        let v = fetcher.get_calc_value(a);
        assert_f64_from_calc_value!(w, v);
        w.trunc() as i64
    } else {
        base_w as i64
    };

    let new_row = base_row as i64 + rows.trunc() as i64;
    let new_col = base_col as i64 + cols.trunc() as i64;
    if new_row < 0 || new_col < 0 || height < 1 || width < 1 {
        return CalcVertex::from_error(ast::Error::Ref);
    }

    let top = Addr {
        row: new_row as usize,
        col: new_col as usize,
    };
    let reference = if height == 1 && width == 1 {
        Reference::Addr(top)
    } else {
        let bottom = Addr {
            row: (new_row + height - 1) as usize,
            col: (new_col + width - 1) as usize,
        };
        Reference::Range(top, bottom)
    };
    CalcVertex::Reference(CalcReference {
        from_sheet,
        sheet,
        reference,
    })
}
