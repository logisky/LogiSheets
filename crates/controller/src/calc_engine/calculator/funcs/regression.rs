//! Two-variable statistics over a pair of equally-sized arrays: correlation,
//! covariance, linear-fit slope/intercept, and the SUMX2*/SUMXMY2 family.
//!
//! Excel pairs the two arrays element-by-element; a pair is dropped when either
//! side is non-numeric (text/blank/logical), and mismatched array sizes are
//! `#N/A`. All formulas below use the *population* moments (Σ over the kept
//! pairs), which is what CORREL/COVAR/SLOPE/INTERCEPT are defined on.

use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// One numeric cell, or `None` for a cell Excel ignores in a pair.
fn opt_of(v: Value) -> Result<Option<f64>, ast::Error> {
    match v {
        Value::Number(n) => Ok(Some(n)),
        Value::Blank | Value::Text(_) | Value::Boolean(_) => Ok(None),
        Value::Error(e) => Err(e),
    }
}

/// Flatten an argument to a per-cell `Option<f64>` list (row-major), preserving
/// length so two arrays can be checked for equal size and paired positionally.
fn to_opt_vec(value: CalcValue) -> Result<Vec<Option<f64>>, ast::Error> {
    match value {
        CalcValue::Scalar(s) => Ok(vec![opt_of(s)?]),
        CalcValue::Range(m) => {
            let mut out = Vec::new();
            for v in m.into_iter() {
                out.push(opt_of(v)?);
            }
            Ok(out)
        }
        _ => Err(ast::Error::Value),
    }
}

/// Fetch the two array arguments and pair them, dropping pairs where either
/// side is non-numeric. `#N/A` if the arrays differ in size.
fn fetch_pairs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> Result<(Vec<f64>, Vec<f64>), ast::Error>
where
    C: Connector,
{
    if args.len() != 2 {
        return Err(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let a = to_opt_vec(fetcher.get_calc_value(iter.next().unwrap()))?;
    let b = to_opt_vec(fetcher.get_calc_value(iter.next().unwrap()))?;
    if a.len() != b.len() {
        return Err(ast::Error::Na);
    }
    let mut xs = Vec::new();
    let mut ys = Vec::new();
    for (x, y) in a.into_iter().zip(b.into_iter()) {
        if let (Some(x), Some(y)) = (x, y) {
            xs.push(x);
            ys.push(y);
        }
    }
    Ok((xs, ys))
}

/// (n, mean_x, mean_y, Sxx, Syy, Sxy) with S* the summed products of deviations.
fn moments(xs: &[f64], ys: &[f64]) -> (f64, f64, f64, f64, f64, f64) {
    let n = xs.len() as f64;
    let mx = xs.iter().sum::<f64>() / n;
    let my = ys.iter().sum::<f64>() / n;
    let mut sxx = 0.;
    let mut syy = 0.;
    let mut sxy = 0.;
    for (x, y) in xs.iter().zip(ys.iter()) {
        sxx += (x - mx).powi(2);
        syy += (y - my).powi(2);
        sxy += (x - mx) * (y - my);
    }
    (n, mx, my, sxx, syy, sxy)
}

macro_rules! pairs_or_return {
    ($xs:ident, $ys:ident, $args:expr, $fetcher:expr) => {
        let (($xs, $ys)) = match fetch_pairs($args, $fetcher) {
            Ok(p) => p,
            Err(e) => return CalcVertex::from_error(e),
        };
    };
}

/// CORREL / PEARSON — Pearson correlation coefficient Sxy / √(Sxx·Syy).
pub fn calc_correl<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    pairs_or_return!(xs, ys, args, fetcher);
    if xs.is_empty() {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let (_, _, _, sxx, syy, sxy) = moments(&xs, &ys);
    if sxx == 0. || syy == 0. {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    CalcVertex::from_number(sxy / (sxx * syy).sqrt())
}

/// RSQ — square of the Pearson correlation coefficient.
pub fn calc_rsq<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    pairs_or_return!(xs, ys, args, fetcher);
    if xs.is_empty() {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let (_, _, _, sxx, syy, sxy) = moments(&xs, &ys);
    if sxx == 0. || syy == 0. {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let r = sxy / (sxx * syy).sqrt();
    CalcVertex::from_number(r * r)
}

/// COVAR / COVARIANCE.P — population covariance Sxy / n.
pub fn calc_covar<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    pairs_or_return!(xs, ys, args, fetcher);
    if xs.is_empty() {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let (n, _, _, _, _, sxy) = moments(&xs, &ys);
    CalcVertex::from_number(sxy / n)
}

/// COVARIANCE.S — sample covariance Sxy / (n − 1).
pub fn calc_covar_s<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    pairs_or_return!(xs, ys, args, fetcher);
    if xs.len() < 2 {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let (n, _, _, _, _, sxy) = moments(&xs, &ys);
    CalcVertex::from_number(sxy / (n - 1.))
}

/// SLOPE(known_ys, known_xs) — slope of the least-squares line = Sxy / Sxx.
pub fn calc_slope<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    pairs_or_return!(ys, xs, args, fetcher); // note: (known_ys, known_xs)
    if xs.is_empty() {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let (_, _, _, sxx, _, sxy) = moments(&xs, &ys);
    if sxx == 0. {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    CalcVertex::from_number(sxy / sxx)
}

/// INTERCEPT(known_ys, known_xs) — y-intercept ȳ − slope·x̄.
pub fn calc_intercept<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    pairs_or_return!(ys, xs, args, fetcher);
    if xs.is_empty() {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let (_, mx, my, sxx, _, sxy) = moments(&xs, &ys);
    if sxx == 0. {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let slope = sxy / sxx;
    CalcVertex::from_number(my - slope * mx)
}

/// FORECAST(x, known_ys, known_xs) — the value on the least-squares line at `x`:
/// intercept + slope·x.
pub fn calc_forecast<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let xv = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(x, xv);
    let ys_arg = iter.next().unwrap();
    let xs_arg = iter.next().unwrap();
    let (ys, xs) = match fetch_pairs(vec![ys_arg, xs_arg], fetcher) {
        Ok(p) => p,
        Err(e) => return CalcVertex::from_error(e),
    };
    if xs.is_empty() {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let (_, mx, my, sxx, _, sxy) = moments(&xs, &ys);
    if sxx == 0. {
        return CalcVertex::from_error(ast::Error::Div0);
    }
    let slope = sxy / sxx;
    CalcVertex::from_number(my - slope * mx + slope * x)
}

fn sum_pairs<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, f64) -> f64,
{
    pairs_or_return!(xs, ys, args, fetcher);
    let sum: f64 = xs.iter().zip(ys.iter()).map(|(x, y)| f(*x, *y)).sum();
    CalcVertex::from_number(sum)
}

/// SUMX2MY2 — Σ(xᵢ² − yᵢ²).
pub fn calc_sumx2my2<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    sum_pairs(args, fetcher, |x, y| x * x - y * y)
}

/// SUMX2PY2 — Σ(xᵢ² + yᵢ²).
pub fn calc_sumx2py2<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    sum_pairs(args, fetcher, |x, y| x * x + y * y)
}

/// SUMXMY2 — Σ(xᵢ − yᵢ)².
pub fn calc_sumxmy2<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    sum_pairs(args, fetcher, |x, y| (x - y).powi(2))
}
