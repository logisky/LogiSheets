use logisheets_parser::ast;

use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let first = args.into_iter().next().unwrap();
    match &first {
        CalcVertex::Reference(_) => {
            let values = fetcher.get_calc_value(first);
            let num = match values {
                CalcValue::Scalar(s) => {
                    if is_blank(s) {
                        1.
                    } else {
                        0.
                    }
                }
                CalcValue::Range(r) => {
                    r.into_iter()
                        .fold(0., |prev, v| if is_blank(v) { prev + 1. } else { prev })
                }
                CalcValue::Cube(c) => {
                    c.into_iter()
                        .fold(0., |prev, v| if is_blank(v) { prev + 1. } else { prev })
                }
                CalcValue::Union(_) => unreachable!(),
            };
            CalcVertex::from_number(num)
        }
        _ => CalcVertex::from_error(ast::Error::Unspecified),
    }
}

fn is_blank(v: Value) -> bool {
    match v {
        Value::Blank => true,
        Value::Text(s) => {
            if s.is_empty() {
                true
            } else {
                false
            }
        }
        _ => false,
    }
}
