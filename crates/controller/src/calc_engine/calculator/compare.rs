use super::calc_vertex::Value;
use logisheets_parser::ast;

pub fn compare(lhs: &Value, rhs: &Value) -> CompareResult {
    match (lhs, rhs) {
        (Value::Blank, Value::Blank) => CompareResult::Equal,
        (Value::Blank, Value::Number(num)) => {
            if *num > 0_f64 && *num > 1e-10 {
                CompareResult::Less
            } else if *num < 0_f64 && *num < 1e-10 {
                CompareResult::Greater
            } else {
                CompareResult::Equal
            }
        }
        (Value::Blank, Value::Text(_)) => CompareResult::Less,
        (Value::Blank, Value::Boolean(_)) => CompareResult::Less,
        (Value::Blank, Value::Error(e)) => CompareResult::Error(e.clone()),
        (Value::Number(num), Value::Blank) => {
            if *num > 0_f64 && *num > 1e-10 {
                CompareResult::Greater
            } else if *num < 0_f64 && *num < 1e-10 {
                CompareResult::Less
            } else {
                CompareResult::Equal
            }
        }
        (Value::Number(num), Value::Number(rhs_num)) => {
            if *num > *rhs_num {
                CompareResult::Greater
            } else if *num < *rhs_num {
                CompareResult::Less
            } else {
                CompareResult::Equal
            }
        }
        (Value::Number(_), Value::Text(_)) => CompareResult::Less,
        (Value::Number(_), Value::Boolean(_)) => CompareResult::Less,
        (Value::Number(_), Value::Error(e)) => CompareResult::Error(e.clone()),
        (Value::Text(_), Value::Blank) => CompareResult::Greater,
        (Value::Text(_), Value::Number(_)) => CompareResult::Greater,
        (Value::Text(l_text), Value::Text(r_text)) => {
            if l_text > r_text {
                CompareResult::Greater
            } else if l_text < r_text {
                CompareResult::Less
            } else {
                CompareResult::Equal
            }
        }
        (Value::Text(_), Value::Boolean(_)) => CompareResult::Less,
        (Value::Text(_), Value::Error(e)) => CompareResult::Error(e.clone()),
        (Value::Boolean(_), Value::Blank) => CompareResult::Greater,
        (Value::Boolean(_), Value::Number(_)) => CompareResult::Greater,
        (Value::Boolean(_), Value::Text(_)) => CompareResult::Greater,
        (Value::Boolean(lhs_bool), Value::Boolean(rhs_bool)) => {
            let l = *lhs_bool;
            let r = *rhs_bool;
            if l == r {
                CompareResult::Equal
            } else if l {
                CompareResult::Greater
            } else {
                CompareResult::Less
            }
        }
        (Value::Boolean(_), Value::Error(e)) => CompareResult::Error(e.clone()),
        (Value::Error(e), _) => CompareResult::Error(e.clone()),
    }
}

pub enum CompareResult {
    Less,
    Greater,
    Equal,
    Error(ast::Error),
}
