use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// MOD(number, divisor) — the result takes the sign of the divisor (Excel), and
/// a zero divisor is #DIV/0!.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(number, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(divisor, second);
    assert_or_return!(divisor != 0., ast::Error::Div0);
    // n - d * floor(n/d) — matches Excel's sign-of-divisor semantics.
    let res = number - divisor * (number / divisor).floor();
    CalcVertex::from_number(res)
}
