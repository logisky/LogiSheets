use super::super::CalcVertex;
use crate::calc_engine::{calculator::funcs::utils::get_nums_from_value, connector::Connector};
use logisheets_parser::ast;
use statrs::statistics::Statistics;

pub fn calc_var<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |nums: Vec<f64>| -> Option<f64> {
        match nums.variance() {
            f if f.is_nan() => None,
            f => Some(f),
        }
    };
    calc(args, fetcher, func)
}

pub fn calc_stdev<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |nums: Vec<f64>| -> Option<f64> {
        match nums.std_dev() {
            f if f.is_nan() => None,
            f => Some(f),
        }
    };
    calc(args, fetcher, func)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(Vec<f64>) -> Option<f64>,
{
    assert_or_return!(args.len() > 0, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let mut result: Vec<f64> = vec![];
    while let Some(vertex) = iter.next() {
        let value = fetcher.get_calc_value(vertex);
        match get_nums_from_value(value) {
            Ok(nums) => result.extend(nums),
            Err(e) => return CalcVertex::from_error(e),
        }
    }
    match func(result) {
        Some(r) => CalcVertex::from_number(r),
        None => CalcVertex::from_error(ast::Error::Na),
    }
}
