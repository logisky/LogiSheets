use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 3 && args.len() != 4 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut args_iter = args.into_iter();
    let first = args_iter.next().unwrap();
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    let idx = args_iter.next().map_or(None, |vertex| {
        let value = fetcher.get_calc_value(vertex);
        match get_offset_from_calc_value(value) {
            Ok(n) => Some(n),
            Err(_) => None,
        }
    });
    let row_offset = get_offset_from_calc_value(second);
    let col_offset = get_offset_from_calc_value(third);
    match (row_offset, col_offset) {
        (Ok(r), Ok(c)) => get_index_result(first, r, c, idx),
        (Ok(_), Err(e)) => CalcVertex::from_error(e),
        (Err(e), Ok(_)) => CalcVertex::from_error(e),
        (Err(e), Err(_)) => CalcVertex::from_error(e),
    }
}

fn get_index_result(
    cv: CalcVertex,
    row_offset: usize,
    col_offset: usize,
    idx: Option<usize>,
) -> CalcVertex {
    match idx {
        Some(i) => {
            if i == 0 {
                return CalcVertex::from_error(ast::Error::Value);
            }
            match cv {
                CalcVertex::Union(u) => {
                    let target_v = u.into_iter().skip(i - 1).next();
                    match target_v {
                        Some(v) => _index(*v, row_offset, col_offset),
                        None => CalcVertex::from_error(ast::Error::Ref),
                    }
                }
                _ => {
                    if i == 1 {
                        _index(cv, row_offset, col_offset)
                    } else {
                        CalcVertex::from_error(ast::Error::Ref)
                    }
                }
            }
        }
        None => todo!(),
    }
}

fn _index(cv: CalcVertex, r: usize, c: usize) -> CalcVertex {
    match &cv {
        CalcVertex::Value(v) => match v {
            CalcValue::Scalar(_) => {
                if r <= 1 && c <= 1 {
                    cv
                } else {
                    CalcVertex::from_error(ast::Error::Ref)
                }
            }
            CalcValue::Range(mv) => {
                if r == 0 || c == 0 {
                    todo!()
                }
                let size = mv.get_size();
                if r >= size.0 || c >= size.1 {
                    CalcVertex::from_error(ast::Error::Ref)
                } else {
                    match mv.visit(r - 1, c - 1) {
                        Ok(v) => CalcVertex::Value(CalcValue::Scalar(v.clone())),
                        Err(v) => CalcVertex::Value(CalcValue::Scalar(v)),
                    }
                }
            }
            CalcValue::Cube(_) => CalcVertex::from_error(ast::Error::Value),
            CalcValue::Union(_) => unreachable!(),
        },
        CalcVertex::Reference(r) => todo!(),
        CalcVertex::Union(_) => unreachable!(),
    }
}

fn get_offset_from_calc_value(value: CalcValue) -> Result<usize, ast::Error> {
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Blank => Ok(0),
            Value::Number(f) => Ok(f.floor() as usize),
            Value::Text(_) => Err(ast::Error::Value),
            Value::Boolean(b) => {
                if b {
                    Ok(1)
                } else {
                    Ok(0)
                }
            }
            Value::Error(e) => Err(e),
            Value::Date(_) => todo!(),
        },
        // WPS does not support.
        _ => Err(ast::Error::Value),
    }
}
