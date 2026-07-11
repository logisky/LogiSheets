//! A few numeric functions that don't fit the single-argument scalar mould.

use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::funcs::utils::get_nums_from_value;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// ATAN2(x_num, y_num) — the arctangent of y_num/x_num, in (−π, π]. Note the
/// Excel argument order is (x, y), the reverse of the usual `atan2`.
pub fn calc_atan2<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let first = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(x, first);
    let second = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(y, second);
    if x == 0. && y == 0. {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    CalcVertex::from_number(y.atan2(x))
}

/// STANDARDIZE(x, mean, standard_dev) — the z-score (x − mean)/standard_dev.
/// `standard_dev` must be strictly positive, else `#NUM!`.
pub fn calc_standardize<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(x, a);
    let b = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(mean, b);
    let c = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(sd, c);
    if sd <= 0. {
        return CalcVertex::from_error(ast::Error::Num);
    }
    CalcVertex::from_number((x - mean) / sd)
}

/// MULTINOMIAL(number1, …) — (Σ nᵢ)! / Π(nᵢ!), over the truncated integer parts
/// of every numeric argument. Any negative argument is `#NUM!`.
pub fn calc_multinomial<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(!args.is_empty(), ast::Error::Unspecified);
    let mut nums: Vec<f64> = Vec::new();
    for arg in args {
        match get_nums_from_value(fetcher.get_calc_value(arg)) {
            Ok(v) => nums.extend(v),
            Err(e) => return CalcVertex::from_error(e),
        }
    }
    assert_or_return!(!nums.is_empty(), ast::Error::Unspecified);
    let ints: Vec<f64> = nums.iter().map(|n| n.trunc()).collect();
    if ints.iter().any(|n| *n < 0.) {
        return CalcVertex::from_error(ast::Error::Num);
    }
    let factorial = |n: f64| -> f64 {
        let mut r = 1_f64;
        let mut i = 2_f64;
        while i <= n {
            r *= i;
            i += 1.;
        }
        r
    };
    let total: f64 = ints.iter().sum();
    let denom: f64 = ints.iter().map(|n| factorial(*n)).product();
    CalcVertex::from_number(factorial(total) / denom)
}
