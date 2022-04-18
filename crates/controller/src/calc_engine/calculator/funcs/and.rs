use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    args.into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .try_fold(AndResult::Blank, |and, e| match e {
            CalcValue::Scalar(s) => cal_and_result(and, s),
            CalcValue::Range(r) => r.into_iter().try_fold(and, cal_and_result),
            CalcValue::Cube(_) => Err(ast::Error::Ref),
            CalcValue::Union(_) => todo!(),
        })
        .map_or_else(
            |e| CalcVertex::from_error(e),
            |ok| match ok {
                AndResult::Bool(b) => CalcVertex::from_bool(b),
                AndResult::Blank => CalcVertex::from_error(ast::Error::Value),
            },
        )
}

enum AndResult {
    Bool(bool),
    Blank,
}

fn cal_and_result(and: AndResult, v: Value) -> Result<AndResult, ast::Error> {
    match v {
        Value::Boolean(b) => match and {
            AndResult::Bool(and_result_bool) => Ok(AndResult::Bool(and_result_bool && b)),
            AndResult::Blank => Ok(AndResult::Bool(b)),
        },
        Value::Number(n) => match and {
            AndResult::Bool(b) => Ok(AndResult::Bool(b && n != 0_f64)),
            AndResult::Blank => Ok(AndResult::Bool(n != 0_f64)),
        },
        Value::Date(_) => match and {
            AndResult::Bool(_) => Ok(and),
            AndResult::Blank => Ok(AndResult::Bool(true)),
        },
        Value::Error(e) => Err(e),
        _ => Ok(and),
    }
}

#[cfg(test)]
mod tests {
    use super::super::utils::tests_utils::TestFetcher;
    use super::calc;
    use super::{CalcValue, CalcVertex, Value};
    use chrono::DateTime;
    use logisheets_base::matrix_value::MatrixValue;
    use logisheets_parser::ast::Error;

    #[test]
    fn and_test() {
        let args1 = vec![
            CalcVertex::from_bool(true),
            CalcVertex::from_number(1_f64),
            CalcVertex::from_string(String::from("test")),
            CalcVertex::Value(CalcValue::Scalar(Value::Blank)),
            CalcVertex::Value(CalcValue::Scalar(Value::Date(
                DateTime::parse_from_rfc3339("2021-01-01T00:00:00-00:00").unwrap(),
            ))),
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(vec![
                vec![Value::Boolean(true)],
                vec![Value::Number(1_f64)],
            ]))),
        ];
        let mut fetcher = TestFetcher {};
        let res1 = calc(args1, &mut fetcher);
        assert!(matches!(
            res1,
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(true))),
        ));

        let args2 = vec![CalcVertex::from_bool(true), CalcVertex::from_bool(false)];
        let res2 = calc(args2, &mut fetcher);
        assert!(matches!(
            res2,
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(false))),
        ));

        let args3 = vec![CalcVertex::from_bool(true), CalcVertex::from_number(0_f64)];
        let res3 = calc(args3, &mut fetcher);
        assert!(matches!(
            res3,
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(false))),
        ));

        let args4 = vec![
            CalcVertex::from_bool(true),
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(vec![
                vec![Value::Boolean(true)],
                vec![Value::Number(0_f64)],
            ]))),
        ];
        let res4 = calc(args4, &mut fetcher);
        assert!(matches!(
            res4,
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(false))),
        ));
    }

    #[test]
    fn and_error() {
        let args1 = vec![
            CalcVertex::from_string("test".to_string()),
            CalcVertex::Value(CalcValue::Scalar(Value::Blank)),
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(vec![
                vec![Value::Text("test".to_string())],
                vec![Value::Blank],
            ]))),
        ];
        let mut fetcher = TestFetcher {};
        let res1 = calc(args1, &mut fetcher);
        assert!(matches!(
            res1,
            CalcVertex::Value(CalcValue::Scalar(Value::Error(Error::Value))),
        ));

        let args2 = vec![
            CalcVertex::from_error(Error::Ref),
            CalcVertex::from_error(Error::Div0),
        ];
        let res2 = calc(args2, &mut fetcher);
        assert!(matches!(
            res2,
            CalcVertex::Value(CalcValue::Scalar(Value::Error(Error::Ref))),
        ));

        let args3 = vec![CalcVertex::Value(CalcValue::Range(MatrixValue::from(
            vec![vec![Value::Error(Error::Div0)]],
        )))];
        let res3 = calc(args3, &mut fetcher);
        assert!(matches!(
            res3,
            CalcVertex::Value(CalcValue::Scalar(Value::Error(Error::Div0))),
        ));
    }
}
