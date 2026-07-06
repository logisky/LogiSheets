use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let cnt = args
        .into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .fold(0_u16, |i, e| i + count_calc_value(e));
    CalcVertex::from_number(cnt as f64)
}

/// COUNTA(...) — count every value that is not empty (numbers, text, booleans
/// and even errors all count; only blank cells / empty scalars don't).
pub fn calc_counta<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let cnt = args
        .into_iter()
        .map(|arg| fetcher.get_calc_value(arg))
        .fold(0_u32, |i, e| i + counta_calc_value(e));
    CalcVertex::from_number(cnt as f64)
}

fn counta_calc_value(value: CalcValue) -> u32 {
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Blank => 0,
            _ => 1,
        },
        CalcValue::Range(r) => {
            r.into_iter().fold(
                0_u32,
                |s, e| {
                    if matches!(e, Value::Blank) { s } else { s + 1 }
                },
            )
        }
        CalcValue::Cube(c) => {
            c.into_iter().fold(
                0_u32,
                |s, e| {
                    if matches!(e, Value::Blank) { s } else { s + 1 }
                },
            )
        }
        CalcValue::Union(values) => values
            .into_iter()
            .map(|v| counta_calc_value(*v))
            .fold(0_u32, |prev, this| prev + this),
    }
}

fn count_calc_value(value: CalcValue) -> u16 {
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Number(_) => 1_u16,
            _ => 0_u16,
        },
        CalcValue::Range(r) => r.into_iter().fold(0_u16, |s, e| match e {
            Value::Number(_) => s + 1,
            _ => s,
        }),
        CalcValue::Cube(c) => c.into_iter().fold(0_u16, |s, e| match e {
            Value::Number(_) => s + 1,
            _ => s,
        }),
        CalcValue::Union(values) => values
            .into_iter()
            .map(|v| count_calc_value(*v))
            .fold(0_u16, |prev, this| prev + this),
    }
}

#[cfg(test)]
mod tests {
    use super::super::utils::tests_utils::TestFetcher;
    use super::{CalcValue, CalcVertex, Value};
    use logisheets_base::matrix_value::MatrixValue;

    #[test]
    fn count_test() {
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
        if let CalcVertex::Value(CalcValue::Scalar(Value::Number(f))) = result {
            assert!((f - 2.0).abs() < 1e-10)
        } else {
            panic!()
        }
    }
}
