use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// Collect every numeric value from the arguments (scalars + ranges / cubes /
/// unions), ignoring text / blank / bool and propagating the first error —
/// matching the conventions used by SUM / COUNT in this engine.
fn collect_numbers<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> Result<Vec<f64>, ast::Error>
where
    C: Connector,
{
    let mut out: Vec<f64> = Vec::new();
    for arg in args {
        push_numbers(fetcher.get_calc_value(arg), &mut out)?;
    }
    Ok(out)
}

fn push_numbers(value: CalcValue, out: &mut Vec<f64>) -> Result<(), ast::Error> {
    match value {
        CalcValue::Scalar(s) => push_value(s, out),
        CalcValue::Range(r) => {
            for e in r.into_iter() {
                push_value(e, out)?;
            }
            Ok(())
        }
        CalcValue::Cube(c) => {
            for e in c.into_iter() {
                push_value(e, out)?;
            }
            Ok(())
        }
        CalcValue::Union(u) => {
            for b in u.into_iter() {
                push_numbers(*b, out)?;
            }
            Ok(())
        }
    }
}

fn push_value(value: Value, out: &mut Vec<f64>) -> Result<(), ast::Error> {
    match value {
        Value::Number(n) => {
            out.push(n);
            Ok(())
        }
        Value::Error(e) => Err(e),
        _ => Ok(()),
    }
}

pub fn calc_max<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        // MAX/MIN over no numeric values is 0 in Excel.
        Ok(ns) if ns.is_empty() => CalcVertex::from_number(0.),
        Ok(ns) => CalcVertex::from_number(ns.iter().cloned().fold(f64::NEG_INFINITY, f64::max)),
        Err(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_min<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        Ok(ns) if ns.is_empty() => CalcVertex::from_number(0.),
        Ok(ns) => CalcVertex::from_number(ns.iter().cloned().fold(f64::INFINITY, f64::min)),
        Err(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_product<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        // PRODUCT with no numeric values is 0 in Excel.
        Ok(ns) if ns.is_empty() => CalcVertex::from_number(0.),
        Ok(ns) => CalcVertex::from_number(ns.iter().product()),
        Err(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_median<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        Ok(mut ns) => {
            if ns.is_empty() {
                return CalcVertex::from_error(ast::Error::Num);
            }
            ns.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let mid = ns.len() / 2;
            let m = if ns.len() % 2 == 1 {
                ns[mid]
            } else {
                (ns[mid - 1] + ns[mid]) / 2.
            };
            CalcVertex::from_number(m)
        }
        Err(e) => CalcVertex::from_error(e),
    }
}
