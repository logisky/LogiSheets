use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc_rank<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let handler = |n: f64, array: &mut [f64], descending: bool| {
        if descending {
            array.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        } else {
            array.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        }
        let pos = array.iter().position(|x| (*x - n).abs() < 10e-7);
        match pos {
            Some(f) => Some(f as f64),
            None => None,
        }
    };
    calc(args, fetcher, handler)
}

pub fn calc_rank_avg<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let handler = |n: f64, array: &mut [f64], descending: bool| {
        if descending {
            array.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        } else {
            array.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        }
        let mut sum = 0_f64;
        let mut cnt = 0_f64;
        array.into_iter().enumerate().for_each(|(idx, curr)| {
            if (*curr - n).abs() < 10e-7 {
                cnt += 1.;
                sum += idx as f64;
            }
        });
        if cnt == 0. {
            None
        } else {
            Some(sum / cnt)
        }
    };
    calc(args, fetcher, handler)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, &mut [f64], bool) -> Option<f64>,
{
    assert_or_return!(args.len() >= 2 && args.len() <= 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = args_iter.next().unwrap();
    assert_f64_from_calc_value!(num, fetcher.get_calc_value(first));
    let second = args_iter.next().unwrap();
    let second_value = fetcher.get_calc_value(second);
    let mut collection = match second_value {
        CalcValue::Scalar(v) => match get_f64(v) {
            Ok(num) => {
                if let Some(f) = num {
                    vec![f]
                } else {
                    vec![]
                }
            }
            Err(e) => return CalcVertex::from_error(e),
        },
        CalcValue::Range(r) => {
            let result = r.into_iter().fold(Ok(vec![]), |prev, curr| {
                if prev.is_err() {
                    return prev;
                }
                let num = get_f64(curr);
                match num {
                    Ok(f) => {
                        if let Some(n) = f {
                            let mut v = prev.unwrap();
                            v.push(n);
                            Ok(v)
                        } else {
                            prev
                        }
                    }
                    Err(e) => Err(e),
                }
            });
            match result {
                Ok(v) => v,
                Err(e) => return CalcVertex::from_error(e),
            }
        }
        CalcValue::Cube(c) => {
            let result = c.into_iter().fold(Ok(vec![]), |prev, curr| {
                if prev.is_err() {
                    return prev;
                }
                let num = get_f64(curr);
                match num {
                    Ok(f) => {
                        if let Some(n) = f {
                            let mut v = prev.unwrap();
                            v.push(n);
                            Ok(v)
                        } else {
                            prev
                        }
                    }
                    Err(e) => Err(e),
                }
            });
            match result {
                Ok(v) => v,
                Err(e) => return CalcVertex::from_error(e),
            }
        }
        CalcValue::Union(_) => return CalcVertex::from_error(ast::Error::Unspecified),
    };
    let third = args_iter.next();
    let descending = match third {
        Some(s) => {
            let third_value = fetcher.get_calc_value(s);
            match third_value {
                CalcValue::Scalar(v) => match v {
                    Value::Number(n) if n == 0. => true,
                    Value::Boolean(b) if !b => true,
                    _ => false,
                },
                _ => false,
            }
        }
        None => true,
    };
    if let Some(r) = func(num, &mut collection, descending) {
        CalcVertex::from_number(r)
    } else {
        CalcVertex::from_error(ast::Error::Value)
    }
}

fn get_f64(v: Value) -> Result<Option<f64>, ast::Error> {
    match v {
        Value::Number(f) => Ok(Some(f)),
        Value::Boolean(b) => {
            if b {
                Ok(Some(1.))
            } else {
                Ok(Some(0.))
            }
        }
        Value::Error(e) => Err(e),
        _ => Ok(None),
    }
}
