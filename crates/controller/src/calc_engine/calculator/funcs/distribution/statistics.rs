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

pub fn calc_stdevp<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // Population standard deviation: √(Σ(xᵢ − x̄)² / n).
    let func = |nums: Vec<f64>| -> Option<f64> {
        if nums.is_empty() {
            return None;
        }
        let n = nums.len() as f64;
        let mean = nums.iter().sum::<f64>() / n;
        let ss = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>();
        Some((ss / n).sqrt())
    };
    calc(args, fetcher, func)
}

pub fn calc_varp<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // Population variance: Σ(xᵢ − x̄)² / n.
    let func = |nums: Vec<f64>| -> Option<f64> {
        if nums.is_empty() {
            return None;
        }
        let n = nums.len() as f64;
        let mean = nums.iter().sum::<f64>() / n;
        Some(nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / n)
    };
    calc(args, fetcher, func)
}

pub fn calc_skew<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // Sample skewness: n/((n−1)(n−2)) · Σ((xᵢ − x̄)/s)³, needs n ≥ 3 and s > 0.
    let func = |nums: Vec<f64>| -> Option<f64> {
        let n = nums.len();
        if n < 3 {
            return None;
        }
        let nf = n as f64;
        let mean = nums.iter().sum::<f64>() / nf;
        let var = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (nf - 1.);
        let s = var.sqrt();
        if s == 0. {
            return None;
        }
        let sum_cubed = nums.iter().map(|x| ((x - mean) / s).powi(3)).sum::<f64>();
        Some(nf / ((nf - 1.) * (nf - 2.)) * sum_cubed)
    };
    calc(args, fetcher, func)
}

pub fn calc_kurt<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // Sample excess kurtosis, needs n ≥ 4 and s > 0.
    let func = |nums: Vec<f64>| -> Option<f64> {
        let n = nums.len();
        if n < 4 {
            return None;
        }
        let nf = n as f64;
        let mean = nums.iter().sum::<f64>() / nf;
        let var = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (nf - 1.);
        let s = var.sqrt();
        if s == 0. {
            return None;
        }
        let sum_q = nums.iter().map(|x| ((x - mean) / s).powi(4)).sum::<f64>();
        let a = nf * (nf + 1.) / ((nf - 1.) * (nf - 2.) * (nf - 3.));
        let b = 3. * (nf - 1.).powi(2) / ((nf - 2.) * (nf - 3.));
        Some(a * sum_q - b)
    };
    calc(args, fetcher, func)
}

pub fn calc_devsq<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // Sum of squared deviations from the mean: Σ(xᵢ − x̄)².
    let func = |nums: Vec<f64>| -> Option<f64> {
        if nums.is_empty() {
            return None;
        }
        let mean = nums.iter().sum::<f64>() / nums.len() as f64;
        Some(nums.iter().map(|x| (x - mean).powi(2)).sum())
    };
    calc(args, fetcher, func)
}

pub fn calc_avedev<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // Mean of the absolute deviations from the mean: Σ|xᵢ − x̄| / n.
    let func = |nums: Vec<f64>| -> Option<f64> {
        if nums.is_empty() {
            return None;
        }
        let n = nums.len() as f64;
        let mean = nums.iter().sum::<f64>() / n;
        Some(nums.iter().map(|x| (x - mean).abs()).sum::<f64>() / n)
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
