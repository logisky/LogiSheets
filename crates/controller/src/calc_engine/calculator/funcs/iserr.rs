use crate::calc_engine::calculator::calc_vertex::{CalcValue, Value};
use crate::calc_engine::connector::Connector;

use super::CalcVertex;
use logisheets_parser::ast;

#[derive(Debug, Clone, Copy)]
pub enum IsErrType {
    Na,
    All,
    ExceptNa,
}

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C, ty: IsErrType) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 1 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let arg = args.into_iter().next().unwrap();
    let value = fetcher.get_calc_value(arg);
    let v = match value {
        CalcValue::Scalar(s) => CalcValue::Scalar(is_error(&s, ty)),
        CalcValue::Range(r) => {
            let matrix_value = r.map(move |v| is_error(v, ty));
            CalcValue::Range(matrix_value)
        }
        CalcValue::Cube(_) => CalcValue::Scalar(Value::Error(ast::Error::Ref)),
        CalcValue::Union(u) => {
            // The branch below should be unreachable because there are 2 args
            // at least in the union vector.
            // Check in the grammar part.
            if u.len() == 1 {
                let arg = *u.into_iter().next().unwrap();
                let v = vec![CalcVertex::Value(arg)];
                if let CalcVertex::Value(value) = calc(v, fetcher, ty) {
                    value
                } else {
                    CalcValue::Scalar(Value::Error(ast::Error::Value))
                }
            } else {
                // Take the formula: ISERR((A1:B2, C3, D4)) as instance.
                // We can infer that Microsoft Excel calculates
                // (A1:B2, C4,D4) first and its result is #VALUE!. So this
                // formula returns true.
                CalcValue::Scalar(Value::Boolean(true))
            }
        }
    };
    CalcVertex::Value(v)
}

fn is_error(value: &Value, ty: IsErrType) -> Value {
    let b = match value {
        Value::Error(e) => match ty {
            IsErrType::All => true,
            IsErrType::Na => e.to_owned() == ast::Error::Na,
            IsErrType::ExceptNa => e.to_owned() != ast::Error::Na,
        },
        _ => false,
    };
    Value::Boolean(b)
}
