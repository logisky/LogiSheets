use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};
use num::Complex;
use parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 2 && args.len() <= 3, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let first = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(real, first);
    let second = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(imaginary, second);
    // A Complex outputs the string with suffix "i".
    let complex = format!("{}", Complex::new(real, imaginary));
    let third = iter.next();
    match third {
        Some(suf_vertex) => {
            let suf_value = fetcher.get_calc_value(suf_vertex);
            match suf_value {
                CalcValue::Scalar(sv) => match sv {
                    Value::Blank => CalcVertex::from_text(complex),
                    Value::Number(_) => CalcVertex::from_error(ast::Error::Value),
                    Value::Text(t) => match t.as_str() {
                        "i" => CalcVertex::from_text(complex),
                        "j" => {
                            let r = complex.replace("i", "j");
                            CalcVertex::from_text(r)
                        }
                        _ => CalcVertex::from_error(ast::Error::Value),
                    },
                    Value::Boolean(_) => CalcVertex::from_error(ast::Error::Value),
                    Value::Error(e) => CalcVertex::from_error(e),
                    Value::Date(_) => CalcVertex::from_error(ast::Error::Value),
                },
                _ => CalcVertex::from_error(ast::Error::Value),
            }
        }
        None => CalcVertex::from_text(complex),
    }
}
