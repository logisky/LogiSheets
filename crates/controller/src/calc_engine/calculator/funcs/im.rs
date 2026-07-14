use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};

use crate::calc_engine::calculator::math::complex::build_complex;
use logisheets_parser::ast;
use num::Complex;

pub fn calc_imreal<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.re;
    calc_f64(args, fetcher, func)
}

pub fn calc_imaginary<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.im;
    calc_f64(args, fetcher, func)
}

pub fn calc_imabs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| (c.re * c.re + c.im * c.im).sqrt();
    calc_f64(args, fetcher, func)
}

pub fn calc_imconjugate<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.conj();
    calc_complex(args, fetcher, func)
}

pub fn calc_imsin<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.sin();
    calc_complex(args, fetcher, func)
}

pub fn calc_imsec<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| 1. / c.cos();
    calc_complex(args, fetcher, func)
}

pub fn calc_imcsc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| 1. / c.sin();
    calc_complex(args, fetcher, func)
}

pub fn calc_imcos<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.cos();
    calc_complex(args, fetcher, func)
}

pub fn calc_imcosh<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.cosh();
    calc_complex(args, fetcher, func)
}

pub fn calc_imcot<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| 1. / c.tan();
    calc_complex(args, fetcher, func)
}

pub fn calc_imsinh<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.sinh();
    calc_complex(args, fetcher, func)
}

pub fn calc_imtan<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.tan();
    calc_complex(args, fetcher, func)
}

pub fn calc_imtanh<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.tanh();
    calc_complex(args, fetcher, func)
}

pub fn calc_imexp<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.exp();
    calc_complex(args, fetcher, func)
}

pub fn calc_imln<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.ln();
    calc_complex(args, fetcher, func)
}

pub fn calc_imlog2<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.log(2.);
    calc_complex(args, fetcher, func)
}

pub fn calc_imlog10<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |c: Complex<f64>| c.log(10.);
    calc_complex(args, fetcher, func)
}

pub fn calc_imsum<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_fold(args, fetcher, Complex::new(0., 0.), |acc, c| acc + c)
}

pub fn calc_improduct<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_fold(args, fetcher, Complex::new(1., 0.), |acc, c| acc * c)
}

pub fn calc_imsub<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_pair(args, fetcher, |a, b| a - b)
}

pub fn calc_imdiv<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_pair(args, fetcher, |a, b| a / b)
}

/// Parse one complex-number argument ("a+bi") from a fetched value.
fn arg_to_complex(value: CalcValue) -> Result<Complex<f64>, ast::Error> {
    let s = match value {
        CalcValue::Scalar(Value::Text(t)) => t,
        CalcValue::Scalar(Value::Number(n)) => return Ok(Complex::new(n, 0.)),
        CalcValue::Scalar(Value::Blank) => return Ok(Complex::new(0., 0.)),
        CalcValue::Scalar(Value::Boolean(_)) => return Err(ast::Error::Value),
        CalcValue::Scalar(Value::Error(e)) => return Err(e),
        _ => return Err(ast::Error::Value),
    };
    build_complex(&s).ok_or(ast::Error::Num)
}

/// Combine one-or-more complex arguments left-to-right from `init` (IMSUM/IMPRODUCT).
fn calc_fold<C, F>(
    args: Vec<CalcVertex>,
    fetcher: &mut C,
    init: Complex<f64>,
    func: F,
) -> CalcVertex
where
    C: Connector,
    F: Fn(Complex<f64>, Complex<f64>) -> Complex<f64>,
{
    assert_or_return!(!args.is_empty(), ast::Error::Unspecified);
    let mut acc = init;
    for arg in args {
        let value = fetcher.get_calc_value(arg);
        match arg_to_complex(value) {
            Ok(c) => acc = func(acc, c),
            Err(e) => return CalcVertex::from_error(e),
        }
    }
    CalcVertex::from_text(format!("{}", acc))
}

/// Combine exactly two complex arguments (IMSUB/IMDIV).
fn calc_pair<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(Complex<f64>, Complex<f64>) -> Complex<f64>,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let a = match arg_to_complex(fetcher.get_calc_value(iter.next().unwrap())) {
        Ok(c) => c,
        Err(e) => return CalcVertex::from_error(e),
    };
    let b = match arg_to_complex(fetcher.get_calc_value(iter.next().unwrap())) {
        Ok(c) => c,
        Err(e) => return CalcVertex::from_error(e),
    };
    CalcVertex::from_text(format!("{}", func(a, b)))
}

fn calc_f64<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(Complex<f64>) -> f64,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let arg = fetcher.get_calc_value(args.into_iter().next().unwrap());
    assert_text_from_calc_value!(s, arg);
    let c = build_complex(&s);
    assert_or_return!(c.is_some(), ast::Error::Unspecified);
    let c = c.unwrap();
    CalcVertex::from_number(func(c))
}

fn calc_complex<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(Complex<f64>) -> Complex<f64>,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let arg = fetcher.get_calc_value(args.into_iter().next().unwrap());
    assert_text_from_calc_value!(s, arg);
    let c = build_complex(&s);
    assert_or_return!(c.is_some(), ast::Error::Unspecified);
    let c = c.unwrap();
    CalcVertex::from_text(format!("{}", func(c)))
}
