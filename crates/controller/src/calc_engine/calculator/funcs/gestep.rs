use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1 || args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let threshold = match args_iter.next() {
        Some(v) => {
            let v = fetcher.get_calc_value(v);
            assert_f64_from_calc_value!(threshold, v);
            threshold
        }
        None => 0.,
    };
    if num >= threshold {
        CalcVertex::from_number(1.)
    } else {
        CalcVertex::from_number(0.)
    }
}
