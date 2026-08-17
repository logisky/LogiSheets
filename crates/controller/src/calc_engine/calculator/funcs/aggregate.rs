use super::utils::convert_f64;
use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// Collect every numeric value from the arguments (scalars + ranges / cubes /
/// unions), ignoring text / blank / bool and propagating the first error —
/// matching the conventions used by SUM / COUNT in this engine.
fn collect_numbers<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> Result<Vec<f64>, ast::Error>
where
    C: Connector,
{
    let mut out: Vec<f64> = Vec::new();
    for arg in args {
        push_numbers(fetcher.get_calc_value(arg), &mut out)?;
    }
    Ok(out)
}

fn push_numbers(value: CalcValue, out: &mut Vec<f64>) -> Result<(), ast::Error> {
    match value {
        CalcValue::Scalar(s) => push_value(s, out),
        CalcValue::Range(r) => {
            for e in r.into_iter() {
                push_value(e, out)?;
            }
            Ok(())
        }
        CalcValue::Cube(c) => {
            for e in c.into_iter() {
                push_value(e, out)?;
            }
            Ok(())
        }
        CalcValue::Union(u) => {
            for b in u.into_iter() {
                push_numbers(*b, out)?;
            }
            Ok(())
        }
    }
}

fn push_value(value: Value, out: &mut Vec<f64>) -> Result<(), ast::Error> {
    match value {
        Value::Number(n) => {
            out.push(n);
            Ok(())
        }
        Value::Error(e) => Err(e),
        _ => Ok(()),
    }
}

pub fn calc_max<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        // MAX/MIN over no numeric values is 0 in Excel.
        Ok(ns) if ns.is_empty() => CalcVertex::from_number(0.),
        Ok(ns) => CalcVertex::from_number(ns.iter().cloned().fold(f64::NEG_INFINITY, f64::max)),
        Err(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_min<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        Ok(ns) if ns.is_empty() => CalcVertex::from_number(0.),
        Ok(ns) => CalcVertex::from_number(ns.iter().cloned().fold(f64::INFINITY, f64::min)),
        Err(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_product<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        // PRODUCT with no numeric values is 0 in Excel.
        Ok(ns) if ns.is_empty() => CalcVertex::from_number(0.),
        Ok(ns) => CalcVertex::from_number(ns.iter().product()),
        Err(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_median<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match collect_numbers(args, fetcher) {
        Ok(mut ns) => {
            if ns.is_empty() {
                return CalcVertex::from_error(ast::Error::Num);
            }
            ns.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let mid = ns.len() / 2;
            let m = if ns.len() % 2 == 1 {
                ns[mid]
            } else {
                (ns[mid - 1] + ns[mid]) / 2.
            };
            CalcVertex::from_number(m)
        }
        Err(e) => CalcVertex::from_error(e),
    }
}

// ===========================================================================
// AGGREGATE(function_num, options, ...)
// ===========================================================================
// `function_num` 1–13 use the reference form `AGGREGATE(n, opts, ref1, [ref2],
// …)`; 14–19 use the array form `AGGREGATE(n, opts, array, k)`.
//
// `options` we honor: error-ignoring (2, 3, 6, 7 drop error cells; otherwise an
// error in the data propagates). NOT yet honored: "ignore hidden rows" (1, 3,
// 5, 7 — needs row-visibility at calc time, not exposed here) and "ignore
// nested SUBTOTAL/AGGREGATE" (we don't tag those results). The error half of
// options 3 / 7 still applies; only the hidden-row half is a no-op.

/// Read a required scalar argument as an f64.
fn scalar<C>(fetcher: &mut C, v: CalcVertex) -> Result<f64, ast::Error>
where
    C: Connector,
{
    match fetcher.get_calc_value(v) {
        CalcValue::Scalar(s) => convert_f64(s),
        _ => Err(ast::Error::Value),
    }
}

/// Flatten every argument into a flat list of values (blanks/text/bools/errors
/// kept — the caller decides what to drop).
fn flatten<C>(fetcher: &mut C, args: Vec<CalcVertex>) -> Vec<Value>
where
    C: Connector,
{
    let mut out = Vec::new();
    for a in args {
        push_all(fetcher.get_calc_value(a), &mut out);
    }
    out
}

fn push_all(value: CalcValue, out: &mut Vec<Value>) {
    match value {
        CalcValue::Scalar(s) => out.push(s),
        CalcValue::Range(r) => out.extend(r.into_iter()),
        CalcValue::Cube(c) => out.extend(c.into_iter()),
        CalcValue::Union(u) => u.into_iter().for_each(|b| push_all(*b, out)),
    }
}

/// Apply the error policy: drop error cells when `ignore_errors`, else surface
/// the first error.
fn apply_error_policy(vals: Vec<Value>, ignore_errors: bool) -> Result<Vec<Value>, ast::Error> {
    if ignore_errors {
        Ok(vals
            .into_iter()
            .filter(|v| !matches!(v, Value::Error(_)))
            .collect())
    } else {
        for v in &vals {
            if let Value::Error(e) = v {
                return Err(e.clone());
            }
        }
        Ok(vals)
    }
}

fn numbers(vals: &[Value]) -> Vec<f64> {
    vals.iter()
        .filter_map(|v| match v {
            Value::Number(n) => Some(*n),
            _ => None,
        })
        .collect()
}

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 3 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut it = args.into_iter();
    let fn_num = match scalar(fetcher, it.next().unwrap()) {
        Ok(n) => n.trunc() as i64,
        Err(e) => return CalcVertex::from_error(e),
    };
    let options = match scalar(fetcher, it.next().unwrap()) {
        Ok(n) => n.trunc() as i64,
        Err(e) => return CalcVertex::from_error(e),
    };
    if !(1..=19).contains(&fn_num) || !(0..=7).contains(&options) {
        return CalcVertex::from_error(ast::Error::Value);
    }
    let ignore_errors = matches!(options, 2 | 3 | 6 | 7);
    let rest: Vec<CalcVertex> = it.collect();

    // Array form (14–19): AGGREGATE(n, opts, array, k).
    if (14..=19).contains(&fn_num) {
        if rest.len() != 2 {
            return CalcVertex::from_error(ast::Error::Unspecified);
        }
        let mut ri = rest.into_iter();
        let array = ri.next().unwrap();
        let vals = match apply_error_policy(flatten(fetcher, vec![array]), ignore_errors) {
            Ok(v) => v,
            Err(e) => return CalcVertex::from_error(e),
        };
        let k = match scalar(fetcher, ri.next().unwrap()) {
            Ok(k) => k,
            Err(e) => return CalcVertex::from_error(e),
        };
        return match array_agg(fn_num, &numbers(&vals), k) {
            Ok(n) => CalcVertex::from_number(n),
            Err(e) => CalcVertex::from_error(e),
        };
    }

    // Reference form (1–13): AGGREGATE(n, opts, ref1, [ref2], …).
    if rest.is_empty() {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let vals = match apply_error_policy(flatten(fetcher, rest), ignore_errors) {
        Ok(v) => v,
        Err(e) => return CalcVertex::from_error(e),
    };
    match ref_agg(fn_num, &vals) {
        Ok(n) => CalcVertex::from_number(n),
        Err(e) => CalcVertex::from_error(e),
    }
}

fn ref_agg(fn_num: i64, vals: &[Value]) -> Result<f64, ast::Error> {
    let nums = numbers(vals);
    match fn_num {
        1 => average(&nums),
        2 => Ok(nums.len() as f64),
        3 => Ok(vals.iter().filter(|v| !matches!(v, Value::Blank)).count() as f64),
        4 => Ok(fold_or_zero(&nums, f64::NEG_INFINITY, f64::max)),
        5 => Ok(fold_or_zero(&nums, f64::INFINITY, f64::min)),
        6 => Ok(if nums.is_empty() {
            0.
        } else {
            nums.iter().product()
        }),
        7 => stdev(&nums, true),
        8 => stdev(&nums, false),
        9 => Ok(nums.iter().sum()),
        10 => variance(&nums, true),
        11 => variance(&nums, false),
        12 => median(&nums),
        13 => mode_sngl(&nums),
        _ => Err(ast::Error::Value),
    }
}

fn array_agg(fn_num: i64, nums: &[f64], k: f64) -> Result<f64, ast::Error> {
    match fn_num {
        14 => large(nums, k, true),
        15 => large(nums, k, false),
        16 => percentile_inc(nums, k),
        17 => quartile(nums, k, true),
        18 => percentile_exc(nums, k),
        19 => quartile(nums, k, false),
        _ => Err(ast::Error::Value),
    }
}

fn fold_or_zero(nums: &[f64], init: f64, f: fn(f64, f64) -> f64) -> f64 {
    if nums.is_empty() {
        0.
    } else {
        nums.iter().cloned().fold(init, f)
    }
}

fn average(nums: &[f64]) -> Result<f64, ast::Error> {
    if nums.is_empty() {
        Err(ast::Error::Div0)
    } else {
        Ok(nums.iter().sum::<f64>() / nums.len() as f64)
    }
}

fn variance(nums: &[f64], sample: bool) -> Result<f64, ast::Error> {
    let n = nums.len();
    let denom = if sample {
        if n < 2 {
            return Err(ast::Error::Div0);
        }
        (n - 1) as f64
    } else {
        if n < 1 {
            return Err(ast::Error::Div0);
        }
        n as f64
    };
    let mean = nums.iter().sum::<f64>() / n as f64;
    let ss: f64 = nums.iter().map(|x| (x - mean).powi(2)).sum();
    Ok(ss / denom)
}

fn stdev(nums: &[f64], sample: bool) -> Result<f64, ast::Error> {
    variance(nums, sample).map(f64::sqrt)
}

fn median(nums: &[f64]) -> Result<f64, ast::Error> {
    if nums.is_empty() {
        return Err(ast::Error::Num);
    }
    let mut s = nums.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mid = s.len() / 2;
    Ok(if s.len() % 2 == 1 {
        s[mid]
    } else {
        (s[mid - 1] + s[mid]) / 2.
    })
}

/// MODE.SNGL: the most frequent value (first-appearing among ties); `#N/A` when
/// every value is unique.
fn mode_sngl(nums: &[f64]) -> Result<f64, ast::Error> {
    let mut best: Option<(f64, usize)> = None;
    for (i, &v) in nums.iter().enumerate() {
        // Only consider the first occurrence of each value.
        if nums[..i].iter().any(|&x| x == v) {
            continue;
        }
        let count = nums.iter().filter(|&&x| x == v).count();
        if count > best.map_or(0, |(_, c)| c) {
            best = Some((v, count));
        }
    }
    match best {
        Some((v, c)) if c > 1 => Ok(v),
        _ => Err(ast::Error::Na),
    }
}

/// LARGE (`desc=true`) / SMALL (`desc=false`): the k-th value by rank. `k` is
/// truncated to a 1-based integer; out of range is `#NUM!`.
fn large(nums: &[f64], k: f64, desc: bool) -> Result<f64, ast::Error> {
    let k = k.trunc() as i64;
    let n = nums.len() as i64;
    if k < 1 || k > n {
        return Err(ast::Error::Num);
    }
    let mut s = nums.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let idx = if desc {
        (n - k) as usize
    } else {
        (k - 1) as usize
    };
    Ok(s[idx])
}

fn percentile_inc(nums: &[f64], p: f64) -> Result<f64, ast::Error> {
    if nums.is_empty() || !(0.0..=1.0).contains(&p) {
        return Err(ast::Error::Num);
    }
    let mut s = nums.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = s.len();
    let rank = p * (n - 1) as f64;
    let lo = rank.floor() as usize;
    let frac = rank - lo as f64;
    Ok(if lo + 1 < n {
        s[lo] + frac * (s[lo + 1] - s[lo])
    } else {
        s[lo]
    })
}

fn percentile_exc(nums: &[f64], p: f64) -> Result<f64, ast::Error> {
    if nums.is_empty() || p <= 0.0 || p >= 1.0 {
        return Err(ast::Error::Num);
    }
    let mut s = nums.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = s.len();
    let rank = p * (n + 1) as f64; // 1-based
    if rank < 1.0 || rank > n as f64 {
        return Err(ast::Error::Num);
    }
    let lo = rank.floor() as usize; // 1-based index of the lower neighbor
    let frac = rank - lo as f64;
    let a = s[lo - 1];
    let b = if lo < n { s[lo] } else { a };
    Ok(a + frac * (b - a))
}

/// QUARTILE.INC (`inc=true`, q∈0..=4) / QUARTILE.EXC (`inc=false`, q∈1..=3).
fn quartile(nums: &[f64], q: f64, inc: bool) -> Result<f64, ast::Error> {
    let q = q.trunc() as i64;
    if inc {
        if !(0..=4).contains(&q) {
            return Err(ast::Error::Num);
        }
        percentile_inc(nums, q as f64 / 4.0)
    } else {
        if !(1..=3).contains(&q) {
            return Err(ast::Error::Num);
        }
        percentile_exc(nums, q as f64 / 4.0)
    }
}

#[cfg(test)]
mod agg_tests {
    use super::*;

    const APPROX: f64 = 1e-9;

    #[test]
    fn stdev_and_var_sample_vs_population() {
        let d = [2., 4., 4., 4., 5., 5., 7., 9.];
        assert!((variance(&d, false).unwrap() - 4.0).abs() < APPROX); // VAR.P
        assert!((stdev(&d, false).unwrap() - 2.0).abs() < APPROX); // STDEV.P
        assert!((variance(&d, true).unwrap() - 32.0 / 7.0).abs() < APPROX); // VAR.S
        assert!(variance(&[1.], true).is_err()); // sample var needs n >= 2
    }

    #[test]
    fn percentile_inc_and_exc() {
        let d = [1., 2., 3., 4.];
        assert!((percentile_inc(&d, 0.5).unwrap() - 2.5).abs() < APPROX);
        assert!((percentile_inc(&d, 0.0).unwrap() - 1.0).abs() < APPROX);
        assert!((percentile_inc(&d, 1.0).unwrap() - 4.0).abs() < APPROX);
        // EXC: rank = 0.5 * (4 + 1) = 2.5 -> midpoint of 2 and 3.
        assert!((percentile_exc(&d, 0.5).unwrap() - 2.5).abs() < APPROX);
        // EXC out of achievable range -> #NUM!.
        assert!(percentile_exc(&d, 0.1).is_err());
    }

    #[test]
    fn quartile_inc_and_exc_ranges() {
        let d = [1., 2., 3., 4., 5., 6., 7., 8.];
        // Q1 inclusive: p = 0.25, rank = 0.25*7 = 1.75 -> 2 + 0.75 = 2.75.
        assert!((quartile(&d, 1., true).unwrap() - 2.75).abs() < APPROX);
        assert!(
            (quartile(&d, 2., true).unwrap() - percentile_inc(&d, 0.5).unwrap()).abs() < APPROX
        );
        assert!(quartile(&d, 5., true).is_err()); // inc accepts 0..=4
        assert!(quartile(&d, 0., false).is_err()); // exc accepts 1..=3
    }

    #[test]
    fn large_small_and_mode() {
        let d = [10., 20., 30., 40., 50.];
        assert_eq!(large(&d, 2., true).unwrap(), 40.); // 2nd largest
        assert_eq!(large(&d, 1., false).unwrap(), 10.); // smallest
        assert!(large(&d, 6., true).is_err()); // out of range
        assert_eq!(mode_sngl(&[1., 2., 2., 3.]).unwrap(), 2.);
        assert!(mode_sngl(&[1., 2., 3.]).is_err()); // no repeat -> #N/A
    }
}
