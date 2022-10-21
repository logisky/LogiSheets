use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use statrs::distribution::{Continuous, ContinuousCDF, Normal};

use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut arg = args.into_iter();
    let first = fetcher.get_calc_value(arg.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let second = fetcher.get_calc_value(arg.next().unwrap());
    assert_bool_from_calc_value!(b, second);
    let n = Normal::new(0.0, 1.0).unwrap();
    let res = if b { n.cdf(num) } else { n.pdf(num) };
    CalcVertex::from_number(res)
}
