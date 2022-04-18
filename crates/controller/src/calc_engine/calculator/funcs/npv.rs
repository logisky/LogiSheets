use super::utils::convert_f64;
use super::{CalcValue, CalcVertex};
use crate::calc_engine::calculator::math::npv::calc_npv;
use crate::calc_engine::connector::Connector;
use parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() <= 1 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let rate_vertex = iter.next().unwrap();
    let rate_value = fetcher.get_calc_value(rate_vertex);
    if let CalcValue::Scalar(v) = rate_value {
        let rate = convert_f64(v);
        match rate {
            Ok(rate) => {
                let num_vec = iter.try_fold(Vec::<f64>::new(), |mut prev, v| {
                    let value = fetcher.get_calc_value(v);
                    let nums = get_num_vec(value);
                    match nums {
                        Ok(n) => {
                            prev.extend(n);
                            Ok(prev)
                        }
                        Err(e) => Err(e),
                    }
                });
                match num_vec {
                    Ok(nums) => {
                        let result = calc_npv(rate, &nums);
                        CalcVertex::from_number(result)
                    }
                    Err(e) => CalcVertex::from_error(e),
                }
            }
            Err(e) => CalcVertex::from_error(e),
        }
    } else {
        CalcVertex::from_error(ast::Error::Unspecified)
    }
}

fn get_num_vec(value: CalcValue) -> Result<Vec<f64>, ast::Error> {
    match value {
        CalcValue::Scalar(s) => match convert_f64(s) {
            Ok(n) => Ok(vec![n]),
            Err(e) => Err(e),
        },
        CalcValue::Range(range) => {
            let r = range
                .into_iter()
                .try_fold(Vec::<f64>::new(), |mut prev, value| {
                    match convert_f64(value) {
                        Ok(num) => {
                            prev.push(num);
                            Ok(prev)
                        }
                        Err(e) => Err(e),
                    }
                })?;
            Ok(r)
        }
        CalcValue::Cube(cube) => cube
            .into_iter()
            .try_fold(Vec::<f64>::new(), |mut prev, value| {
                match convert_f64(value) {
                    Ok(num) => {
                        prev.push(num);
                        Ok(prev)
                    }
                    Err(e) => Err(e),
                }
            }),
        CalcValue::Union(union) => {
            union
                .into_iter()
                .try_fold(Vec::<f64>::new(), |mut prev, calc| {
                    match get_num_vec(*calc) {
                        Ok(v) => {
                            prev.extend(v);
                            Ok(prev)
                        }
                        Err(e) => Err(e),
                    }
                })
        }
    }
}
