use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::calculator::math::irr::calc_irr;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 1 || args.len() > 2 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let first = iter.next().unwrap();
    let guess = match iter.next() {
        Some(vertex) => {
            let value = fetcher.get_calc_value(vertex);
            match value {
                CalcValue::Scalar(v) => match convert(v) {
                    ConvertResult::None => Ok(0.),
                    ConvertResult::Number(f) => Ok(f),
                    ConvertResult::Err(e) => Err(e),
                },
                _ => Err(ast::Error::Value),
            }
        }
        None => Ok(0_f64),
    };
    if let Err(e) = guess {
        return CalcVertex::from_error(e);
    }
    let nums_value = fetcher.get_calc_value(first);
    match get_num_vec(nums_value) {
        Ok(nums) => {
            let g = guess.unwrap();
            let result = calc_irr(&nums, Some(g));
            match result {
                Some(n) => CalcVertex::from_number(n),
                None => CalcVertex::from_error(ast::Error::Value),
            }
        }
        Err(e) => CalcVertex::from_error(e),
    }
}

fn get_num_vec(value: CalcValue) -> Result<Vec<f64>, ast::Error> {
    match value {
        CalcValue::Scalar(sv) => match convert(sv) {
            ConvertResult::None => Ok(vec![]),
            ConvertResult::Number(n) => Ok(vec![n]),
            ConvertResult::Err(e) => Err(e),
        },
        CalcValue::Range(r) => {
            r.into_iter()
                .try_fold(Vec::<f64>::new(), |mut prev, v| match convert(v) {
                    ConvertResult::None => Ok(prev),
                    ConvertResult::Number(n) => {
                        prev.push(n);
                        Ok(prev)
                    }
                    ConvertResult::Err(e) => Err(e),
                })
        }
        CalcValue::Cube(c) => {
            c.into_iter()
                .try_fold(Vec::<f64>::new(), |mut prev, v| match convert(v) {
                    ConvertResult::None => Ok(prev),
                    ConvertResult::Number(n) => {
                        prev.push(n);
                        Ok(prev)
                    }
                    ConvertResult::Err(e) => Err(e),
                })
        }
        CalcValue::Union(union) => union
            .into_iter()
            .try_fold(Vec::<f64>::new(), |mut prev, v| match get_num_vec(*v) {
                Ok(nums) => {
                    prev.extend(nums);
                    Ok(prev)
                }
                Err(e) => Err(e),
            }),
    }
}

fn convert(value: Value) -> ConvertResult {
    match value {
        Value::Blank => ConvertResult::None,
        Value::Number(f) => ConvertResult::Number(f),
        Value::Text(_) => ConvertResult::None,
        Value::Boolean(_) => ConvertResult::None,
        Value::Error(e) => ConvertResult::Err(e),
    }
}

enum ConvertResult {
    None,
    Number(f64),
    Err(ast::Error),
}
