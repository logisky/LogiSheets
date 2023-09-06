use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use logisheets_parser::ast;
use rand::{thread_rng, Rng};

pub fn calc(args: Vec<CalcVertex>) -> CalcVertex {
    if args.len() > 0 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut rng = thread_rng();
    CalcVertex::from_number(rng.gen())
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
    let bottom = start.trunc() as i32;
    let top = end.trunc() as i32;

    let mut rng = thread_rng();
    CalcVertex::from_number(rng.gen_range(bottom..=top) as f64)
}
