use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// XOR(logical1, ...) — TRUE when an odd number of arguments are TRUE. Coercion
/// mirrors AND/OR: booleans as-is, numbers truthy iff non-zero, text/blank
/// skipped, errors propagate. All arguments skipped -> #VALUE!.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let folded = args
        .into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .try_fold((0usize, false), |acc, e| match e {
            CalcValue::Scalar(s) => xor_value(acc, s),
            CalcValue::Range(r) => r.into_iter().try_fold(acc, xor_value),
            CalcValue::Cube(_) => Err(ast::Error::Ref),
            CalcValue::Union(_) => Err(ast::Error::Value),
        });
    match folded {
        Ok((_, false)) => CalcVertex::from_error(ast::Error::Value),
        Ok((count, true)) => CalcVertex::from_bool(count % 2 == 1),
        Err(e) => CalcVertex::from_error(e),
    }
}

// acc = (count_of_true, saw_any_logical)
fn xor_value(acc: (usize, bool), v: Value) -> Result<(usize, bool), ast::Error> {
    let (count, seen) = acc;
    match v {
        Value::Boolean(b) => Ok((count + b as usize, true)),
        Value::Number(n) => Ok((count + (n != 0.) as usize, true)),
        Value::Error(e) => Err(e),
        _ => Ok((count, seen)),
    }
}
