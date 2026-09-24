use super::utils::scalar_arg_as_number;
use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_result = args
        .into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .try_fold(0_f64, |sum, v| match sum_calc_value(v) {
            Ok(n) => Ok(sum + n),
            Err(e) => Err(e),
        });
    match sum_result {
        Ok(num) => CalcVertex::from_number(num),
        Err(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_sumsq<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sum_result = args
        .into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .try_fold(0_f64, |sum, v| match sum_calc_value(v) {
            Ok(n) => Ok(sum + n.powi(2)),
            Err(e) => Err(e),
        });
    match sum_result {
        Ok(num) => CalcVertex::from_number(num),
        Err(e) => CalcVertex::from_error(e),
    }
}

/// The value one SUM argument contributes.
///
/// The Scalar and Range arms differ on purpose — see `scalar_arg_as_number`.
fn sum_calc_value(value: CalcValue) -> Result<f64, ast::Error> {
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Error(e) => Err(e),
            other => Ok(scalar_arg_as_number(&other).unwrap_or(0_f64)),
        },
        CalcValue::Range(r) => {
            let result = r.into_iter().try_fold(0_f64, |s, e| match e {
                Value::Number(n) => Ok(s + n),
                Value::Error(e) => Err(e),
                _ => Ok(s),
            })?;
            Ok(result)
        }
        CalcValue::Cube(c) => {
            let result = c.into_iter().try_fold(0_f64, |s, e| match e {
                Value::Number(n) => Ok(s + n),
                Value::Error(e) => Err(e),
                _ => Ok(s),
            })?;
            Ok(result)
        }
        CalcValue::Union(values) => values.into_iter().map(|v| sum_calc_value(*v)).try_fold(
            0_f64,
            |prev, this| match this {
                Ok(n) => Ok(prev + n),
                Err(e) => Err(e),
            },
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::super::utils::tests_utils::TestFetcher;
    use super::{CalcValue, CalcVertex, Value};
    use logisheets_base::matrix_value::MatrixValue;
    use logisheets_parser::ast;

    #[test]
    fn sum_test() {
        let args = vec![
            CalcVertex::from_bool(true),
            CalcVertex::from_bool(false),
            CalcVertex::from_number(-1_f64),
            CalcVertex::from_string(String::from("text")),
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(vec![
                vec![Value::Text(String::from("1"))],
                vec![Value::Number(1_f64)],
            ]))),
        ];
        let mut fetcher = TestFetcher {};
        let result = super::calc(args, &mut fetcher);
        // TRUE(1) + FALSE(0) + -1 + "text"(0) + the range's single number(1).
        // Was 0 while a logical ARGUMENT was ignored; Excel counts one typed
        // into the argument list and ignores one inside a range, and the
        // range's text "1" is still not counted.
        if let CalcVertex::Value(CalcValue::Scalar(Value::Number(f))) = result {
            assert!((f - 1.0).abs() < 1e-10, "expected 1, got {f}")
        } else {
            panic!()
        }
    }

    #[test]
    fn sum_error() {
        let args = vec![
            CalcVertex::from_error(ast::Error::Name),
            CalcVertex::from_bool(false),
            CalcVertex::from_number(100_f64),
        ];
        let mut fetcher = TestFetcher {};
        let result = super::calc(args, &mut fetcher);
        assert!(matches!(
            result,
            CalcVertex::Value(CalcValue::Scalar(Value::Error(ast::Error::Name)))
        ))
    }
}
