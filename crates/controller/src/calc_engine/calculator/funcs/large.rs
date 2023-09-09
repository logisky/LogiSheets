use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use logisheets_parser::ast;

pub fn calc_large<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |nums: &mut [f64], k: usize| -> f64 {
        nums.sort_by(|a, b| b.partial_cmp(a).unwrap());
        *nums.get(k - 1).unwrap()
    };
    calc(args, fetcher, &f)
}

pub fn calc_small<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |nums: &mut [f64], k: usize| -> f64 {
        nums.sort_by(|a, b| a.partial_cmp(b).unwrap());
        *nums.get(k - 1).unwrap()
    };
    calc(args, fetcher, &f)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F) -> CalcVertex
where
    C: Connector,
    F: Fn(&mut [f64], usize) -> f64,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(k, second);
    assert_or_return!(k >= 1., ast::Error::Num);
    match get_nums(first) {
        Ok(mut s) => {
            let result = f(&mut s, k.trunc() as usize);
            CalcVertex::from_number(result)
        }
        Err(e) => CalcVertex::from_error(e),
    }
}

#[inline]
fn get_nums(calc_value: CalcValue) -> Result<Vec<f64>, ast::Error> {
    let f = |v: Value| -> Result<f64, ast::Error> {
        match v {
            Value::Blank => Ok(0.),
            Value::Number(num) => Ok(num),
            Value::Text(t) => match t.parse::<f64>() {
                Ok(n) => Ok(n),
                Err(_) => Err(ast::Error::Value),
            },
            Value::Boolean(b) => {
                if b {
                    Ok(1.)
                } else {
                    Ok(0.)
                }
            }
            Value::Error(e) => Err(e),
        }
    };
    let mut result: Vec<f64> = vec![];
    match calc_value {
        CalcValue::Scalar(s) => result.push(f(s)?),
        CalcValue::Range(r) => {
            for v in r.into_iter() {
                match f(v) {
                    Ok(n) => result.push(n),
                    Err(_) => {}
                }
            }
        }
        CalcValue::Cube(c) => {
            for v in c.into_iter() {
                match f(v) {
                    Ok(n) => result.push(n),
                    Err(_) => {}
                }
            }
        }
        CalcValue::Union(_) => unreachable!(),
    };

    Ok(result)
}
