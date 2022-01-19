use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};

use logisheets_math::complex::build_complex;
use num::Complex;
use parser::ast;

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
