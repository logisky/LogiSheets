use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};
use logisheets_parser::ast;

/// OR(logical1, [logical2], …)
///
/// Mirror of `and::calc` but combining results with logical-or. Same
/// argument-coercion rules:
///   - Boolean: used as-is.
///   - Number: truthy iff non-zero.
///   - Range: each cell contributes; non-bool / non-number cells
///     (Blank, Text) are skipped so a stray empty cell in the range
///     doesn't poison the result.
///   - Text / Blank scalars: skipped.
///   - Error: propagates as the result.
///
/// If every argument was skipped (all blank / text), the function
/// returns `#VALUE!` — matching Excel and the AND implementation.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    args.into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .try_fold(OrResult::Blank, |or, e| match e {
            CalcValue::Scalar(s) => cal_or_result(or, s),
            CalcValue::Range(r) => r.into_iter().try_fold(or, cal_or_result),
            CalcValue::Cube(_) => Err(ast::Error::Ref),
            CalcValue::Union(_) => todo!(),
        })
        .map_or_else(
            |e| CalcVertex::from_error(e),
            |ok| match ok {
                OrResult::Bool(b) => CalcVertex::from_bool(b),
                OrResult::Blank => CalcVertex::from_error(ast::Error::Value),
            },
        )
}

enum OrResult {
    Bool(bool),
    Blank,
}

fn cal_or_result(or: OrResult, v: Value) -> Result<OrResult, ast::Error> {
    match v {
        Value::Boolean(b) => match or {
            OrResult::Bool(prev) => Ok(OrResult::Bool(prev || b)),
            OrResult::Blank => Ok(OrResult::Bool(b)),
        },
        Value::Number(n) => match or {
            OrResult::Bool(prev) => Ok(OrResult::Bool(prev || n != 0_f64)),
            OrResult::Blank => Ok(OrResult::Bool(n != 0_f64)),
        },
        Value::Error(e) => Err(e),
        _ => Ok(or),
    }
}

#[cfg(test)]
mod tests {
    use super::super::utils::tests_utils::TestFetcher;
    use super::calc;
    use super::{CalcValue, CalcVertex, Value};
    use logisheets_base::matrix_value::MatrixValue;
    use logisheets_parser::ast::Error;

    #[test]
    fn or_basic_true() {
        let args = vec![CalcVertex::from_bool(false), CalcVertex::from_bool(true)];
        let mut f = TestFetcher {};
        assert!(matches!(
            calc(args, &mut f),
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(true))),
        ));
    }

    #[test]
    fn or_all_false() {
        let args = vec![CalcVertex::from_bool(false), CalcVertex::from_number(0_f64)];
        let mut f = TestFetcher {};
        assert!(matches!(
            calc(args, &mut f),
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(false))),
        ));
    }

    #[test]
    fn or_number_truthy() {
        let args = vec![CalcVertex::from_number(5_f64)];
        let mut f = TestFetcher {};
        assert!(matches!(
            calc(args, &mut f),
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(true))),
        ));
    }

    #[test]
    fn or_range_with_truthy() {
        let args = vec![
            CalcVertex::from_bool(false),
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(vec![
                vec![Value::Boolean(false)],
                vec![Value::Number(1_f64)],
            ]))),
        ];
        let mut f = TestFetcher {};
        assert!(matches!(
            calc(args, &mut f),
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(true))),
        ));
    }

    #[test]
    fn or_skips_text_and_blank() {
        // Stray text/blank cells in a range are skipped; remaining
        // logicals are all false → result is false.
        let args = vec![
            CalcVertex::from_string(String::from("noise")),
            CalcVertex::Value(CalcValue::Scalar(Value::Blank)),
            CalcVertex::from_bool(false),
        ];
        let mut f = TestFetcher {};
        assert!(matches!(
            calc(args, &mut f),
            CalcVertex::Value(CalcValue::Scalar(Value::Boolean(false))),
        ));
    }

    #[test]
    fn or_all_blank_is_value_error() {
        let args = vec![
            CalcVertex::from_string(String::from("noise")),
            CalcVertex::Value(CalcValue::Scalar(Value::Blank)),
        ];
        let mut f = TestFetcher {};
        assert!(matches!(
            calc(args, &mut f),
            CalcVertex::Value(CalcValue::Scalar(Value::Error(Error::Value))),
        ));
    }

    #[test]
    fn or_propagates_error() {
        let args = vec![
            CalcVertex::from_bool(false),
            CalcVertex::from_error(Error::Div0),
            CalcVertex::from_bool(true),
        ];
        let mut f = TestFetcher {};
        assert!(matches!(
            calc(args, &mut f),
            CalcVertex::Value(CalcValue::Scalar(Value::Error(Error::Div0))),
        ));
    }
}
