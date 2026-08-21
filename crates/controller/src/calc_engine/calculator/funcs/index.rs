use logisheets_base::matrix_value::MatrixValue;

use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use logisheets_parser::ast;

/// `INDEX(array, row_num, [col_num], [area_num])`.
///
/// Every form but the four-argument one used to be unreachable: the three-arg
/// form hit a `todo!()` and panicked (taking the engine instance down with it),
/// and the two-arg form — the one people write most, `INDEX(A1:A10, 3)` — was
/// rejected outright as bad arity.
///
/// Excel's semantics, all supported here:
///   - two args: on a single row or column, pick that element; on a 2-D array,
///     return the whole `row_num`-th row.
///   - `row_num = 0` returns the whole column, `col_num = 0` the whole row, and
///     both zero the entire array.
///   - out of range is `#REF!`, a negative index or text is `#VALUE!`.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 2 || args.len() > 4 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut args_iter = args.into_iter();
    let first = args_iter.next().unwrap();

    let row_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    let row_offset = match get_offset_from_calc_value(row_arg) {
        Ok(r) => r,
        Err(e) => return CalcVertex::from_error(e),
    };

    // `col_num` is optional; absent means "the whole row" on a 2-D array, and
    // "that element" on a vector (resolved once the shape is known).
    let col_offset = match args_iter.next() {
        Some(v) => {
            let value = fetcher.get_calc_value(v);
            match get_offset_from_calc_value(value) {
                Ok(c) => Some(c),
                Err(e) => return CalcVertex::from_error(e),
            }
        }
        None => None,
    };

    // `area_num` selects among the areas of a reference union.
    let area = match args_iter.next() {
        Some(v) => {
            let value = fetcher.get_calc_value(v);
            match get_offset_from_calc_value(value) {
                Ok(n) => Some(n),
                Err(e) => return CalcVertex::from_error(e),
            }
        }
        None => None,
    };

    let target = match pick_area(first, area) {
        Ok(v) => v,
        Err(e) => return CalcVertex::from_error(e),
    };
    index_into(fetcher.get_calc_value(target), row_offset, col_offset)
}

/// Narrow a (possibly multi-area) first argument down to the requested area.
fn pick_area(cv: CalcVertex, area: Option<usize>) -> Result<CalcVertex, ast::Error> {
    let Some(i) = area else {
        return Ok(cv);
    };
    if i == 0 {
        return Err(ast::Error::Value);
    }
    match cv {
        CalcVertex::Union(u) => u
            .into_iter()
            .nth(i - 1)
            .map(|v| *v)
            .ok_or(ast::Error::Ref),
        // A single area: only `area_num = 1` names it.
        other if i == 1 => Ok(other),
        _ => Err(ast::Error::Ref),
    }
}

/// Pull a cell — or a whole row or column — out of an evaluated array.
fn index_into(value: CalcValue, row: usize, col: Option<usize>) -> CalcVertex {
    let matrix = match value {
        CalcValue::Scalar(v) => {
            // A single value behaves like a 1x1 array.
            return match (row, col) {
                (r, None) if r <= 1 => CalcVertex::Value(CalcValue::Scalar(v)),
                (r, Some(c)) if r <= 1 && c <= 1 => CalcVertex::Value(CalcValue::Scalar(v)),
                _ => CalcVertex::from_error(ast::Error::Ref),
            };
        }
        CalcValue::Range(mv) => mv,
        // A cube (3-D reference) has no meaningful single index here, and a
        // union should already have been narrowed by `area_num`.
        CalcValue::Cube(_) | CalcValue::Union(_) => {
            return CalcVertex::from_error(ast::Error::Value);
        }
    };

    let (rows, cols) = matrix.get_size();
    if rows == 0 || cols == 0 {
        return CalcVertex::from_error(ast::Error::Ref);
    }

    // Two-argument form. On a vector the single index walks it; on a 2-D array
    // it selects a row, as Excel does.
    let (row, col) = match col {
        Some(c) => (row, c),
        None => {
            if rows == 1 {
                (1, row)
            } else if cols == 1 {
                (row, 1)
            } else {
                (row, 0) // whole row
            }
        }
    };

    if row > rows || col > cols {
        return CalcVertex::from_error(ast::Error::Ref);
    }

    match (row, col) {
        // The entire array.
        (0, 0) => CalcVertex::Value(CalcValue::Range(matrix)),
        // A whole column.
        (0, c) => {
            let data = (0..rows)
                .map(|r| vec![cell_at(&matrix, r, c - 1)])
                .collect::<Vec<Vec<Value>>>();
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(data)))
        }
        // A whole row.
        (r, 0) => {
            let data = vec![
                (0..cols)
                    .map(|c| cell_at(&matrix, r - 1, c))
                    .collect::<Vec<Value>>(),
            ];
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(data)))
        }
        (r, c) => CalcVertex::Value(CalcValue::Scalar(cell_at(&matrix, r - 1, c - 1))),
    }
}

/// One cell of a matrix, with an absent entry read as its default (blank).
fn cell_at(matrix: &MatrixValue<Value>, r: usize, c: usize) -> Value {
    match matrix.visit(r, c) {
        Ok(v) => v.clone(),
        Err(v) => v,
    }
}

fn get_offset_from_calc_value(value: CalcValue) -> Result<usize, ast::Error> {
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Blank => Ok(0),
            // A negative index is not a position. Guard explicitly: the f64 to
            // usize cast saturates to 0, which would silently mean "whole
            // row/column" instead of an error.
            Value::Number(f) => {
                if f < 0.0 {
                    Err(ast::Error::Value)
                } else {
                    Ok(f.floor() as usize)
                }
            }
            Value::Text(_) => Err(ast::Error::Value),
            Value::Boolean(b) => {
                if b {
                    Ok(1)
                } else {
                    Ok(0)
                }
            }
            Value::Error(e) => Err(e),
        },
        // WPS does not support.
        _ => Err(ast::Error::Value),
    }
}
