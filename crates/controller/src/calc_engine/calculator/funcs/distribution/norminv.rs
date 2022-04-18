use logisheets_parser::ast;

use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use statrs::distribution::{ContinuousCDF, Normal};

pub fn calc_norminv<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(prob, first);
    assert_or_return!(prob > 0. && prob < 1., ast::Error::Num);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(mean, second);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(std_dev, third);
    assert_or_return!(std_dev > 0., ast::Error::Num);
    let n = Normal::new(mean, std_dev).unwrap();
    let r = n.inverse_cdf(prob);
    CalcVertex::from_number(r)
}

pub fn calc_normsinv<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(prob, first);
    assert_or_return!(prob > 0. && prob < 1., ast::Error::Num);
    let n = Normal::new(0., 1.).unwrap();
    let r = n.inverse_cdf(prob);
    CalcVertex::from_number(r)
}
