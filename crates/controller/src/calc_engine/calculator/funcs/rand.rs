use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use logisheets_parser::ast;
use rand::RngExt;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 0, ast::Error::Unspecified);

    let _ = fetcher.set_curr_as_dirty();

    CalcVertex::from_number(rand::rng().random())
}

pub fn calc_randbetween<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(start, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(end, second);

    assert_or_return!(end > start, ast::Error::Num);

    let _ = fetcher.set_curr_as_dirty();

    let bottom = start.trunc() as i32;
    let top = end.trunc() as i32;

    CalcVertex::from_number(rand::rng().random_range(bottom..=top) as f64)
}
