use super::utils::{collect_f64_series, convert_f64};
use super::{CalcValue, CalcVertex};
use crate::calc_engine::calculator::math::xnpv::calc_xnpv;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// `XNPV(rate, values, dates)` — net present value of a dated cash-flow
/// schedule. `values` and `dates` pair by position.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 3 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut it = args.into_iter();

    let rate = match fetcher.get_calc_value(it.next().unwrap()) {
        CalcValue::Scalar(v) => match convert_f64(v) {
            Ok(r) => r,
            Err(e) => return CalcVertex::from_error(e),
        },
        _ => return CalcVertex::from_error(ast::Error::Value),
    };
    let values = match collect_f64_series(fetcher.get_calc_value(it.next().unwrap())) {
        Ok(v) => v,
        Err(e) => return CalcVertex::from_error(e),
    };
    let dates = match collect_f64_series(fetcher.get_calc_value(it.next().unwrap())) {
        Ok(v) => v,
        Err(e) => return CalcVertex::from_error(e),
    };

    match calc_xnpv(rate, &values, &dates) {
        Some(n) => CalcVertex::from_number(n),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
