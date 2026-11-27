use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // DELTA(number1, [number2]): number2 defaults to 0.
    assert_or_return!(args.len() == 1 || args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num1, first);
    let num2 = match args_iter.next() {
        Some(arg) => {
            let second = fetcher.get_calc_value(arg);
            assert_f64_from_calc_value!(num2, second);
            num2
        }
        None => 0.,
    };
    if (num1 - num2).abs() < 1e-8 {
        CalcVertex::from_number(1.)
    } else {
        CalcVertex::from_number(0.)
    }
}
