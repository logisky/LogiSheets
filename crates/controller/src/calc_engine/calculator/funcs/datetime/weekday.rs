use super::super::{CalcValue, CalcVertex, Connector, Value};
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() <= 3, ast::Error::Unspecified);
    assert_or_return!(args.len() >= 1, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(date, first);
    assert_or_return!(date >= 0., ast::Error::Num);
    let second = if let Some(s) = args_iter.next() {
        let value = fetcher.get_calc_value(s);
        assert_f64_from_calc_value!(v, value);
        v
    } else {
        1_f64
    };
    let date = date.trunc() as u64;
    let return_type = second.trunc() as u32;
    match return_type {
        1 | 17 => CalcVertex::from_number(mod_7_and_return_7_if_0(date) as f64),
        2 | 11 => CalcVertex::from_number(mod_7_and_return_7_if_0(date + 6) as f64),
        3 => CalcVertex::from_number(((date + 5) % 7) as f64),
        12 => CalcVertex::from_number(mod_7_and_return_7_if_0(date + 5) as f64),
        13 => CalcVertex::from_number(mod_7_and_return_7_if_0(date + 4) as f64),
        14 => CalcVertex::from_number(mod_7_and_return_7_if_0(date + 3) as f64),
        15 => CalcVertex::from_number(mod_7_and_return_7_if_0(date + 2) as f64),
        16 => CalcVertex::from_number(mod_7_and_return_7_if_0(date + 1) as f64),
        _ => CalcVertex::from_error(ast::Error::Num),
    }
}

#[inline]
fn mod_7_and_return_7_if_0(num: u64) -> u8 {
    let res = num % 7;
    if res == 0 {
        7
    } else {
        res as u8
    }
}
