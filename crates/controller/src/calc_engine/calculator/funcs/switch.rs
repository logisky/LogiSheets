use super::super::compare::{compare, CompareResult};
use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 3 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let expr = iter.next().unwrap();
    let expr_value = fetcher.get_calc_value(expr);
    match expr_value {
        CalcValue::Scalar(v) => next_step(v, iter, fetcher),
        CalcValue::Range(_) => CalcVertex::from_error(ast::Error::Value),
        CalcValue::Cube(_) => CalcVertex::from_error(ast::Error::Value),
        CalcValue::Union(_) => CalcVertex::from_error(ast::Error::Value),
    }
}

fn next_step<C>(
    expr_value: Value,
    mut iter: std::vec::IntoIter<CalcVertex>,
    fetcher: &mut C,
) -> CalcVertex
where
    C: Connector,
{
    let condition_or_default = iter.next();
    let value = iter.next();
    match (condition_or_default, value) {
        (None, None) => CalcVertex::from_error(ast::Error::Na),
        (Some(default), None) => default,
        (Some(condition), Some(result)) => {
            let condition_value = fetcher.get_calc_value(condition);
            match condition_value {
                CalcValue::Scalar(v) => match compare(&v, &expr_value) {
                    CompareResult::Equal => result,
                    CompareResult::Error(e) => CalcVertex::from_error(e),
                    _ => next_step(expr_value, iter, fetcher),
                },
                CalcValue::Range(_) => next_step(expr_value, iter, fetcher),
                CalcValue::Cube(_) => CalcVertex::from_error(ast::Error::Ref),
                CalcValue::Union(_) => todo!(),
            }
        }
        (None, Some(_)) => unreachable!(),
    }
}

#[cfg(test)]
mod tests {
    use super::super::utils::tests_utils::TestFetcher;
    use super::{CalcValue, CalcVertex, Value};
    use parser::ast;

    #[test]
    fn default_value() {
        let args = vec![
            CalcVertex::from_number(1_f64),
            CalcVertex::from_number(2_f64),
            CalcVertex::from_number(3_f64),
            CalcVertex::from_number(4_f64),
            CalcVertex::from_number(5_f64),
            CalcVertex::from_number(6_f64),
        ];
        let mut fetcher = TestFetcher {};
        let result = super::calc(args, &mut fetcher);
        if let CalcVertex::Value(CalcValue::Scalar(Value::Number(f))) = result {
            assert!((f - 6.0).abs() < 1e-10)
        } else {
            panic!()
        }
    }

    #[test]
    fn match_value() {
        let args = vec![
            CalcVertex::from_bool(false),
            CalcVertex::from_bool(false),
            CalcVertex::from_number(1_f64),
        ];
        let mut fetcher = TestFetcher {};
        let result = super::calc(args, &mut fetcher);
        if let CalcVertex::Value(CalcValue::Scalar(Value::Number(f))) = result {
            assert!((f - 1.0).abs() < 1e-10)
        } else {
            panic!()
        }
    }

    #[test]
    fn unmatch() {
        let args = vec![
            CalcVertex::from_bool(true),
            CalcVertex::from_bool(false),
            CalcVertex::from_number(1_f64),
        ];
        let mut fetcher = TestFetcher {};
        let result = super::calc(args, &mut fetcher);
        assert!(matches!(
            result,
            CalcVertex::Value(CalcValue::Scalar(Value::Error(ast::Error::Na)))
        ))
    }
}
