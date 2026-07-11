//! Order-statistic functions over a single array: PERCENTILE / QUARTILE (the
//! inclusive variants), PERCENTRANK, and TRIMMEAN.

use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::funcs::utils::get_nums_from_value;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// Sorted-ascending numbers of an array argument (errors propagate).
fn sorted_nums(value: CalcValue) -> Result<Vec<f64>, ast::Error> {
    let mut nums = get_nums_from_value(value)?;
    nums.sort_by(|a, b| a.partial_cmp(b).unwrap());
    Ok(nums)
}

/// The k-th (0..=1) inclusive percentile of already-sorted data via linear
/// interpolation between ranks — the PERCENTILE.INC definition.
fn percentile_inc(sorted: &[f64], k: f64) -> f64 {
    let n = sorted.len();
    if n == 1 {
        return sorted[0];
    }
    let rank = k * (n as f64 - 1.);
    let lo = rank.floor() as usize;
    let frac = rank - lo as f64;
    if lo + 1 < n {
        sorted[lo] + frac * (sorted[lo + 1] - sorted[lo])
    } else {
        sorted[lo]
    }
}

/// PERCENTILE(array, k) — k in [0, 1].
pub fn calc_percentile<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let arr = fetcher.get_calc_value(iter.next().unwrap());
    let kv = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(k, kv);
    if !(0. ..=1.).contains(&k) {
        return CalcVertex::from_error(ast::Error::Num);
    }
    match sorted_nums(arr) {
        Ok(nums) if !nums.is_empty() => CalcVertex::from_number(percentile_inc(&nums, k)),
        Ok(_) => CalcVertex::from_error(ast::Error::Num),
        Err(e) => CalcVertex::from_error(e),
    }
}

/// QUARTILE(array, quart) — quart 0..=4, i.e. PERCENTILE at quart/4.
pub fn calc_quartile<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let arr = fetcher.get_calc_value(iter.next().unwrap());
    let qv = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(q, qv);
    let q = q.trunc();
    if !(0. ..=4.).contains(&q) {
        return CalcVertex::from_error(ast::Error::Num);
    }
    match sorted_nums(arr) {
        Ok(nums) if !nums.is_empty() => {
            CalcVertex::from_number(percentile_inc(&nums, q / 4.))
        }
        Ok(_) => CalcVertex::from_error(ast::Error::Num),
        Err(e) => CalcVertex::from_error(e),
    }
}

/// PERCENTRANK(array, x, [significance]) — the rank of `x` as a fraction in
/// [0, 1], interpolated between neighbours, truncated to `significance` digits
/// (default 3). `x` outside the data range is #N/A.
pub fn calc_percentrank<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2 || args.len() == 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let arr = fetcher.get_calc_value(iter.next().unwrap());
    let xv = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(x, xv);
    let sig = match iter.next() {
        Some(v) => {
            let sv = fetcher.get_calc_value(v);
            assert_f64_from_calc_value!(s, sv);
            let s = s.trunc();
            if s < 1. {
                return CalcVertex::from_error(ast::Error::Num);
            }
            s as u32
        }
        None => 3,
    };

    let nums = match sorted_nums(arr) {
        Ok(n) if !n.is_empty() => n,
        Ok(_) => return CalcVertex::from_error(ast::Error::Num),
        Err(e) => return CalcVertex::from_error(e),
    };
    let n = nums.len();
    if x < nums[0] || x > nums[n - 1] {
        return CalcVertex::from_error(ast::Error::Na);
    }
    if n == 1 {
        return CalcVertex::from_number(1.);
    }

    let denom = (n - 1) as f64;
    let mut rank = 0.;
    for i in 0..n {
        if (nums[i] - x).abs() < f64::EPSILON {
            rank = i as f64 / denom;
            break;
        }
        if i + 1 < n && nums[i] < x && x < nums[i + 1] {
            let frac = (x - nums[i]) / (nums[i + 1] - nums[i]);
            rank = (i as f64 + frac) / denom;
            break;
        }
    }
    // Truncate (not round) to `sig` significant digits, as Excel does.
    let factor = 10_f64.powi(sig as i32);
    CalcVertex::from_number((rank * factor).trunc() / factor)
}

/// TRIMMEAN(array, percent) — mean after discarding the top and bottom
/// `percent` of the data (rounded down to an even count of removed points).
pub fn calc_trimmean<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let arr = fetcher.get_calc_value(iter.next().unwrap());
    let pv = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(percent, pv);
    if !(0. ..1.).contains(&percent) {
        return CalcVertex::from_error(ast::Error::Num);
    }
    let nums = match sorted_nums(arr) {
        Ok(n) if !n.is_empty() => n,
        Ok(_) => return CalcVertex::from_error(ast::Error::Num),
        Err(e) => return CalcVertex::from_error(e),
    };
    let n = nums.len();
    // Number trimmed per side = floor(n*percent / 2).
    let per_side = (n as f64 * percent / 2.).floor() as usize;
    if 2 * per_side >= n {
        return CalcVertex::from_error(ast::Error::Num);
    }
    let kept = &nums[per_side..n - per_side];
    let mean = kept.iter().sum::<f64>() / kept.len() as f64;
    CalcVertex::from_number(mean)
}
