mod intersect;
pub mod range;

use super::super::connector::Connector;
use super::calc_vertex::{CalcValue, CalcVertex, Value};
use super::compare::{compare, CompareResult};
use intersect::intersect;
use parser::ast;
use range::get_range;

pub fn calc_infix(
    lhs: CalcVertex,
    op: &ast::InfixOperator,
    rhs: CalcVertex,
    fetcher: &mut dyn Connector,
) -> CalcVertex {
    match op {
        ast::InfixOperator::Plus => {
            let func =
                |lhs: &Value, rhs: &Value| infix_number(lhs, rhs, |a: &f64, b: &f64| Ok(a + b));
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Minus => {
            let func =
                |lhs: &Value, rhs: &Value| infix_number(lhs, rhs, |a: &f64, b: &f64| Ok(a - b));
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Multiply => {
            let func =
                |lhs: &Value, rhs: &Value| infix_number(lhs, rhs, |a: &f64, b: &f64| Ok(a * b));
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Divide => {
            let func = |lhs: &Value, rhs: &Value| {
                infix_number(lhs, rhs, |a: &f64, b: &f64| {
                    if b.clone().abs() < 1e-10 {
                        Err(ast::Error::Div0)
                    } else {
                        Ok(a / b)
                    }
                })
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Exp => {
            let func = |lhs: &Value, rhs: &Value| {
                infix_number(lhs, rhs, |a: &f64, b: &f64| Ok(a.powf(*b)))
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Concat => {
            let func = |lhs: &Value, rhs: &Value| {
                infix_string(lhs, rhs, |a: &String, b: &String| {
                    let mut string_a = a.to_string();
                    let string_b = b.to_string();
                    string_a.push_str(&string_b);
                    string_a
                })
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Gt => {
            let func = |lhs: &Value, rhs: &Value| {
                let result = compare(lhs, rhs);
                match result {
                    CompareResult::Greater => Value::Boolean(true),
                    CompareResult::Error(e) => Value::Error(e),
                    _ => Value::Boolean(false),
                }
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Lt => {
            let func = |lhs: &Value, rhs: &Value| {
                let result = compare(lhs, rhs);
                match result {
                    CompareResult::Less => Value::Boolean(true),
                    CompareResult::Error(e) => Value::Error(e),
                    _ => Value::Boolean(false),
                }
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Ge => {
            let func = |lhs: &Value, rhs: &Value| {
                let result = compare(lhs, rhs);
                match result {
                    CompareResult::Greater => Value::Boolean(true),
                    CompareResult::Equal => Value::Boolean(true),
                    CompareResult::Error(e) => Value::Error(e),
                    _ => Value::Boolean(false),
                }
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Le => {
            let func = |lhs: &Value, rhs: &Value| {
                let result = compare(lhs, rhs);
                match result {
                    CompareResult::Less => Value::Boolean(true),
                    CompareResult::Equal => Value::Boolean(true),
                    CompareResult::Error(e) => Value::Error(e),
                    _ => Value::Boolean(false),
                }
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Eq => {
            let func = |lhs: &Value, rhs: &Value| {
                let result = compare(lhs, rhs);
                match result {
                    CompareResult::Equal => Value::Boolean(true),
                    CompareResult::Error(e) => Value::Error(e),
                    _ => Value::Boolean(false),
                }
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Neq => {
            let func = |lhs: &Value, rhs: &Value| {
                let result = compare(lhs, rhs);
                match result {
                    CompareResult::Equal => Value::Boolean(false),
                    CompareResult::Error(e) => Value::Error(e),
                    _ => Value::Boolean(true),
                }
            };
            calc(lhs, rhs, func, fetcher)
        }
        ast::InfixOperator::Space => intersect(lhs, rhs),
        ast::InfixOperator::Colon => get_range(lhs, rhs),
        _ => unimplemented!(),
    }
}

fn calc<F>(lhs: CalcVertex, rhs: CalcVertex, func: F, fetcher: &mut dyn Connector) -> CalcVertex
where
    F: 'static + Fn(&Value, &Value) -> Value,
{
    let (lhs_value, rhs_value) = (fetcher.get_calc_value(lhs), fetcher.get_calc_value(rhs));
    let value = match (lhs_value, rhs_value) {
        (CalcValue::Scalar(lhs_scalar), CalcValue::Scalar(rhs_scalar)) => {
            CalcValue::Scalar(func(&lhs_scalar, &rhs_scalar))
        }
        (CalcValue::Scalar(lhs_scalar), CalcValue::Range(rhs_range)) => {
            CalcValue::Range(rhs_range.calc_scalar(lhs_scalar, Box::new(func), true))
        }
        (CalcValue::Range(lhs_range), CalcValue::Scalar(rhs_scalar)) => {
            CalcValue::Range(lhs_range.calc_scalar(rhs_scalar, Box::new(func), false))
        }
        (CalcValue::Range(lhs_range), CalcValue::Range(rhs_range)) => {
            CalcValue::Range(lhs_range.calc_range(rhs_range, Box::new(func), false))
        }
        _ => {
            let e = Value::Error(ast::Error::Value);
            CalcValue::Scalar(e)
        }
    };
    CalcVertex::Value(value)
}

fn infix_number<F>(lhs: &Value, rhs: &Value, func: F) -> Value
where
    F: Fn(&f64, &f64) -> Result<f64, ast::Error>,
{
    let expect = expect_number;
    let f = |a: &f64, b: &f64| {
        let r = func(a, b);
        match r {
            Ok(num) => Value::Number(num),
            Err(e) => Value::Error(e),
        }
    };
    infix(lhs, rhs, expect, f)
}

fn infix_string<F>(lhs: &Value, rhs: &Value, func: F) -> Value
where
    F: Fn(&String, &String) -> String,
{
    let expect = expect_string;
    let f = |a: &String, b: &String| Value::Text(func(a, b));
    infix(lhs, rhs, expect, f)
}

fn infix<E, F, T>(lhs: &Value, rhs: &Value, expect: E, func: F) -> Value
where
    E: Fn(&Value) -> Result<T, ast::Error>,
    F: Fn(&T, &T) -> Value,
{
    let l = expect(lhs);
    match l {
        Ok(l_num) => {
            let r = expect(rhs);
            match r {
                Ok(r_num) => func(&l_num, &r_num),
                Err(e) => Value::Error(e),
            }
        }
        Err(e) => Value::Error(e),
    }
}

fn expect_number(n: &Value) -> Result<f64, ast::Error> {
    match n {
        Value::Blank => Ok(0_f64),
        Value::Error(e) => Err(e.clone()),
        Value::Number(f) => Ok(f.clone()),
        Value::Text(t) => t
            .parse::<f64>()
            .map_or(Err(ast::Error::Value), |num| Ok(num)),
        Value::Boolean(b) => {
            if *b {
                Ok(1_f64)
            } else {
                Ok(0_f64)
            }
        }
        Value::Date(_) => unimplemented!(),
    }
}

fn expect_string(n: &Value) -> Result<String, ast::Error> {
    match n {
        Value::Blank => Ok(String::new()),
        Value::Number(f) => Ok(f.to_string()),
        Value::Text(t) => Ok(t.clone()),
        Value::Boolean(b) => {
            if *b {
                Ok(String::from("TRUE"))
            } else {
                Ok(String::from("FALSE"))
            }
        }
        Value::Error(e) => Err(e.clone()),
        Value::Date(_) => unimplemented!(),
    }
}
