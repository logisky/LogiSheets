use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use parser::ast;

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: 'static + Fn(f64) -> f64,
{
    if args.len() != 1 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let arg = args.into_iter().next().unwrap();
    let value = fetcher.get_calc_value(arg);
    let v = match value {
        CalcValue::Scalar(s) => CalcValue::Scalar(call(&s, &func)),
        CalcValue::Range(r) => {
            let vec2d = r.map(move |v| call(v, &func));
            CalcValue::Range(vec2d)
        }
        CalcValue::Cube(_) => CalcValue::Scalar(Value::Error(ast::Error::Ref)),
        CalcValue::Union(u) => {
            if u.len() == 1 {
                let arg = *u.into_iter().next().unwrap();
                let v = vec![CalcVertex::Value(arg)];
                if let CalcVertex::Value(value) = calc(v, fetcher, func) {
                    value
                } else {
                    CalcValue::Scalar(Value::Error(ast::Error::Value))
                }
            } else {
                CalcValue::Scalar(Value::Error(ast::Error::Value))
            }
        }
    };
    CalcVertex::Value(v)
}

fn call<F>(value: &Value, func: &F) -> Value
where
    F: Fn(f64) -> f64,
{
    match value {
        Value::Blank => Value::Number(func(0_f64)),
        Value::Number(n) => Value::Number(func(n.clone())),
        Value::Text(_) => Value::Error(ast::Error::Value),
        Value::Boolean(b) => {
            if *b {
                Value::Number(func(1_f64))
            } else {
                Value::Number(func(0_f64))
            }
        }
        Value::Error(e) => Value::Error(e.clone()),
        Value::Date(_) => todo!(),
    }
}

pub fn calc_abs<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.abs())
}

pub fn calc_sin<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.sin())
}

pub fn calc_csc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| 1. / a.sin())
}

pub fn calc_asin<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.asin())
}

pub fn calc_asinh<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.asinh())
}

pub fn calc_cos<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.cos())
}

pub fn calc_tan<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.tan())
}

pub fn calc_cot<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| 1. / a.tan())
}

pub fn calc_tanh<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.tanh())
}

pub fn calc_coth<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| 1. / a.tanh())
}

pub fn calc_sqrt<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.sqrt())
}

pub fn calc_sqrtpi<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| (std::f64::consts::PI * a).sqrt())
}

pub fn calc_acos<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.acos())
}

pub fn calc_atan<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.atan())
}

pub fn calc_atanh<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.atanh())
}

pub fn calc_acosh<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.acosh())
}

pub fn calc_ln<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.ln())
}

pub fn calc_log10<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.log10())
}

pub fn calc_exp<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |a| a.exp())
}

pub fn calc_fact<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    use crate::calc_engine::calculator::math::fact::fact;
    calc(args, fetcher, |a| fact(a.floor() as u32) as f64)
}

pub fn calc_factdouble<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    use crate::calc_engine::calculator::math::fact::factdouble;
    calc(args, fetcher, |a| factdouble(a.floor() as u32) as f64)
}

pub fn calc_odd<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |n: f64| -> f64 {
        let pos = n >= 0.;
        let c = n.abs().ceil() as u32;
        let u_c = if c % 2 == 0 { c + 1 } else { c };
        if pos {
            u_c as f64
        } else {
            -(u_c as f64)
        }
    };
    calc(args, fetcher, func)
}

pub fn calc_even<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |n: f64| -> f64 {
        let pos = n >= 0.;
        let c = n.abs().ceil() as u32;
        let u_c = if c % 2 == 0 { c } else { c + 1 };
        if pos {
            u_c as f64
        } else {
            -(u_c as f64)
        }
    };
    calc(args, fetcher, func)
}

pub fn calc_sign<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |n: f64| -> f64 {
        if n == 0. {
            0.
        } else if n > 0. {
            1.
        } else {
            -1.
        }
    };
    calc(args, fetcher, func)
}

pub fn calc_radians<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |n: f64| -> f64 { n * std::f64::consts::PI / 180. };
    calc(args, fetcher, func)
}

pub fn calc_degrees<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |n: f64| -> f64 { n * 180. / std::f64::consts::PI };
    calc(args, fetcher, func)
}

pub fn calc_gamma<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |n: f64| -> f64 { statrs::function::gamma::gamma(n) };
    calc(args, fetcher, func)
}

pub fn calc_normsdist<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    use statrs::distribution::{ContinuousCDF, Normal};
    let func = |x: f64| -> f64 {
        let n = Normal::new(0.0, 1.0).unwrap();
        n.cdf(x)
    };
    calc(args, fetcher, func)
}

pub fn calc_gammaln<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |n: f64| -> f64 {
        let g = statrs::function::gamma::gamma(n);
        g.ln()
    };
    calc(args, fetcher, func)
}
