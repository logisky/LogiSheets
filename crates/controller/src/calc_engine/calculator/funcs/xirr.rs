use super::utils::{collect_f64_series, convert_f64};
use super::{CalcValue, CalcVertex};
use crate::calc_engine::calculator::math::xirr::calc_xirr;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// `XIRR(values, dates, [guess])` — internal rate of return for a dated
/// cash-flow schedule. `values` and `dates` pair by position; `guess` defaults
/// to 0.1.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 2 || args.len() > 3 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut it = args.into_iter();

    let values = match collect_f64_series(fetcher.get_calc_value(it.next().unwrap())) {
        Ok(v) => v,
        Err(e) => return CalcVertex::from_error(e),
    };
    let dates = match collect_f64_series(fetcher.get_calc_value(it.next().unwrap())) {
        Ok(v) => v,
        Err(e) => return CalcVertex::from_error(e),
    };
    let guess = match it.next() {
        Some(vertex) => match fetcher.get_calc_value(vertex) {
            CalcValue::Scalar(v) => match convert_f64(v) {
                Ok(g) => Some(g),
                Err(e) => return CalcVertex::from_error(e),
            },
            _ => return CalcVertex::from_error(ast::Error::Value),
        },
        None => None,
    };

    match calc_xirr(&values, &dates, guess) {
        Some(n) => CalcVertex::from_number(n),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
