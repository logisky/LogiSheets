use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::{fv::calc_fv, pv::calc_pv};
use crate::calc_engine::connector::Connector;
use parser::ast;

pub fn fv<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, calc_fv)
}

pub fn pv<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, calc_pv)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, f64, f64, f64, bool) -> f64,
{
    assert_or_return!(args.len() >= 3 && args.len() <= 5, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let rate_arg = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(rate, rate_arg);
    let nper_arg = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(nper, nper_arg);
    let pmt_arg = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(pmt, pmt_arg);
    let fv_arg = fetcher.get_calc_value(iter.next().unwrap_or(CalcVertex::from_number(0.)));
    assert_f64_from_calc_value!(fv, fv_arg);
    let ty_arg = fetcher.get_calc_value(iter.next().unwrap_or(CalcVertex::from_number(0.)));
    assert_f64_from_calc_value!(ty, ty_arg);
    let result = func(rate, nper, pmt, fv, ty.abs() < 1e-7);
    CalcVertex::from_number(result)
}
