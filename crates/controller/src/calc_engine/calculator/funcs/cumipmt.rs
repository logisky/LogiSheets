use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::cumipmt::calc_cumipmt;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn cumipmt<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 6, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let rate_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, rate_arg);
    let nper_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(nper, nper_arg);
    let pv_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(pv, pv_arg);
    let start_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(start, start_arg);
    let end_arg = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(end, end_arg);
    let res = calc_cumipmt(
        rate,
        nper.floor() as usize,
        pv,
        start.floor() as i64,
        end.floor() as i64,
        (end.abs() - 1.) < 10e-7,
    );
    match res {
        Some(r) => CalcVertex::from_number(r),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
