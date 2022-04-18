use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::pmt::{calc_ipmt, calc_pmt, calc_ppmt};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn pmt<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 3 && args.len() <= 5, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let rate_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, rate_arg);
    let nper_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(nper, nper_arg);
    let pv_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(pv, pv_arg);
    let fv_arg = fetcher.get_calc_value(args_iter.next().unwrap_or(CalcVertex::from_number(0.)));
    assert_f64_from_calc_value!(fv, fv_arg);
    let ty_arg = fetcher.get_calc_value(args_iter.next().unwrap_or(CalcVertex::from_number(0.)));
    assert_f64_from_calc_value!(ty, ty_arg);
    let pmt = calc_pmt(rate, nper.floor() as usize, pv, fv, ty.abs() < 1e-7);
    CalcVertex::from_number(pmt)
}

pub fn ipmt<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_ipmt_or_pmt(args, fetcher, calc_ipmt)
}

pub fn ppmt<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_ipmt_or_pmt(args, fetcher, calc_ppmt)
}

fn calc_ipmt_or_pmt<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, usize, usize, f64, f64, bool) -> f64,
{
    assert_or_return!(args.len() >= 4 && args.len() <= 6, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let rate_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, rate_arg);
    let per_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(per, per_arg);
    let nper_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(nper, nper_arg);
    let pv_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(pv, pv_arg);
    let fv_arg = fetcher.get_calc_value(args_iter.next().unwrap_or(CalcVertex::from_number(0.)));
    assert_f64_from_calc_value!(fv, fv_arg);
    let ty_arg = fetcher.get_calc_value(args_iter.next().unwrap_or(CalcVertex::from_number(0.)));
    assert_f64_from_calc_value!(ty, ty_arg);
    let result = func(
        rate,
        per.floor() as usize,
        nper.floor() as usize,
        pv,
        fv,
        ty.abs() < 1e-7,
    );
    CalcVertex::from_number(result)
}
