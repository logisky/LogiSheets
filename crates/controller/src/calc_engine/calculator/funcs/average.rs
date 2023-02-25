use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};
use logisheets_parser::ast;

pub fn calc_average<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_mean(
        args,
        fetcher,
        &|a, b| a + b,
        &|sum, cnt| sum / cnt as f64,
        0.,
    )
}

pub fn calc_geomean<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_mean(
        args,
        fetcher,
        &|a, b| a * b,
        &|sum, cnt| sum.powf(1. / cnt as f64),
        1.,
    )
}

pub fn calc_harmean<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_mean(
        args,
        fetcher,
        &|a, b| a + 1. / b,
        &|sum, cnt| sum / cnt as f64,
        0.,
    )
}

fn calc_mean<C, F, A>(
    args: Vec<CalcVertex>,
    fetcher: &mut C,
    sum: &F,
    average: &A,
    init_value: f64,
) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, f64) -> f64,
    A: Fn(f64, u32) -> f64,
{
    let result = args
        .into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .try_fold((init_value, 0_u32), |prev, this| {
            let (s, cnt) = count_and_sum_value(this, &|a, b| a + b)?;
            Ok((sum(prev.0, s), prev.1 + cnt))
        });
    match result {
        Ok((s, c)) => {
            if c != 0 {
                let avg = average(s, c);
                CalcVertex::from_number(avg)
            } else {
                CalcVertex::from_error(ast::Error::Div0)
            }
        }
        Err(e) => CalcVertex::from_error(e),
    }
}

fn count_and_sum_value<F>(value: CalcValue, method: &F) -> Result<(f64, u32), ast::Error>
where
    F: Fn(f64, f64) -> f64,
{
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Number(n) => Ok((n, 1_u32)),
            Value::Error(e) => Err(e),
            _ => Ok((0_f64, 0_u32)),
        },
        CalcValue::Range(r) => r
            .into_iter()
            .try_fold((0_f64, 0_u32), |prev, this| match this {
                Value::Number(n) => Ok((method(prev.0, n), prev.1 + 1)),
                Value::Error(e) => Err(e),
                _ => Ok(prev),
            }),
        CalcValue::Cube(cube) => {
            cube.into_iter()
                .try_fold((0_f64, 0_16), |prev, this| match this {
                    Value::Number(n) => Ok((method(prev.0, n), prev.1 + 1)),
                    Value::Error(e) => Err(e),
                    _ => Ok(prev),
                })
        }
        CalcValue::Union(values) => values
            .into_iter()
            .map(|v| count_and_sum_value(*v, method))
            .try_fold((0_f64, 0_u32), |prev, this| {
                let this = this?;
                Ok((method(prev.0, this.0), prev.1 + this.1))
            }),
    }
}
