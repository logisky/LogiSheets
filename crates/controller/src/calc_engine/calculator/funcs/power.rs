use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// POWER(base, exponent). A non-finite result (e.g. a negative base with a
/// fractional exponent, or 0 to a negative power) is #NUM!.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(base, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(exp, second);
    let res = base.powf(exp);
    if res.is_finite() {
        CalcVertex::from_number(res)
    } else {
        CalcVertex::from_error(ast::Error::Num)
    }
}
