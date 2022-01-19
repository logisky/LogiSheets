use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};
use parser::ast;
use unicode_segmentation::UnicodeSegmentation;

pub fn calc_len<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |t| len(t))
}

pub fn calc_lenb<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, |t| lenb(t))
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: 'static + Fn(&str) -> usize,
{
    if args.len() != 1 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let first = args.into_iter().next().unwrap();
    let value = fetcher.get_calc_value(first);
    match value {
        CalcValue::Scalar(s) => {
            let n = len_value(&s, &func);
            CalcVertex::from_number(n as f64)
        }
        CalcValue::Range(matrix) => {
            let range = matrix.map(move |v| {
                let l = len_value(v, &func);
                Value::Number(l as f64)
            });
            CalcVertex::Value(CalcValue::Range(range))
        }
        CalcValue::Cube(_) => CalcVertex::from_error(ast::Error::Value),
        CalcValue::Union(_) => CalcVertex::from_error(ast::Error::Value),
    }
}

fn len(t: &str) -> usize {
    t.graphemes(true).count()
}

fn lenb(t: &str) -> usize {
    t.len()
}

fn len_value<F>(value: &Value, func: &F) -> usize
where
    F: 'static + Fn(&str) -> usize,
{
    match value {
        Value::Blank => 0_usize,
        Value::Number(f) => f.to_string().len(),
        Value::Text(t) => func(t),
        Value::Boolean(b) => {
            if *b {
                4_usize
            } else {
                5_usize
            }
        }
        Value::Error(e) => e.get_err_str().len(),
        Value::Date(_) => todo!(),
    }
}

#[cfg(test)]
mod tests {
    use super::{len, lenb};

    #[test]
    fn len_test() {
        assert_eq!(len("逻辑汇"), 3);
        assert_eq!(len("abcdefg"), 7);
        assert_eq!(len("こんにちは"), 5);
    }

    #[test]
    fn lenb_test() {
        assert_eq!(lenb("abcdefg"), 7);
    }
}
