use crate::calc_engine::calculator::math::{gcd::multi_gcd, lcm::multi_lcm};
use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use logisheets_parser::ast;

pub fn calc_gcd<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    // GCD never overflows the accumulator, so it always yields a result.
    calc(args, fetcher, |nums| Some(multi_gcd(nums)))
}

pub fn calc_lcm<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, multi_lcm)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(&[u64]) -> Option<u64>,
{
    let mut args_iter = args.into_iter();
    let nums = Vec::<u64>::new();
    let r = args_iter.try_fold(nums, |mut prev, arg| {
        let value = fetcher.get_calc_value(arg);
        let n = get_num_from_calc_value(value)?;
        prev.extend(n);
        Ok(prev)
    });
    match r {
        // `func` returns None when the result overflows u64 -> #NUM!.
        Ok(r) => match func(&r) {
            Some(n) => CalcVertex::from_number(n as f64),
            None => CalcVertex::from_error(ast::Error::Num),
        },
        Err(e) => CalcVertex::from_error(e),
    }
}

fn get_num_from_calc_value(value: CalcValue) -> Result<Vec<u64>, ast::Error> {
    match value {
        CalcValue::Scalar(n) => {
            let n = get_num_from_value(n);
            match n {
                Ok(n) => Ok(vec![n]),
                Err(e) => Err(e),
            }
        }
        CalcValue::Range(range) => {
            range
                .into_iter()
                .try_fold(Vec::<u64>::new(), |mut prev, arg| {
                    let n = get_num_from_value(arg);
                    match n {
                        Ok(n) => {
                            prev.push(n);
                            Ok(prev)
                        }
                        Err(e) => Err(e),
                    }
                })
        }
        CalcValue::Cube(cube) => cube
            .into_iter()
            .try_fold(Vec::<u64>::new(), |mut prev, arg| {
                let n = get_num_from_value(arg);
                match n {
                    Ok(n) => {
                        prev.push(n);
                        Ok(prev)
                    }
                    Err(e) => Err(e),
                }
            }),
        CalcValue::Union(values) => {
            values
                .into_iter()
                .try_fold(Vec::<u64>::new(), |mut prev, v| {
                    let nums = get_num_from_calc_value(*v)?;
                    prev.extend(nums);
                    Ok(prev)
                })
        }
    }
}

fn get_num_from_value(value: Value) -> Result<u64, ast::Error> {
    match value {
        Value::Blank => Ok(0),
        // Negative arguments are #NUM! in Excel; a bare `as u64` would silently
        // saturate a negative to 0 and give a wrong result.
        Value::Number(f) if f < 0. => Err(ast::Error::Num),
        Value::Number(f) => Ok(f.floor() as u64),
        Value::Text(_) => Err(ast::Error::Value),
        Value::Boolean(b) => {
            if b {
                Ok(1)
            } else {
                Ok(0)
            }
        }
        Value::Error(e) => Err(e),
    }
}
