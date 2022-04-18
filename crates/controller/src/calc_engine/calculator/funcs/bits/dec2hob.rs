use crate::calc_engine::calculator::math::bits::{dec2bin, dec2hex, dec2oct};
use parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::{CalcValue, CalcVertex, Value};

pub fn calc_dec2bin<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, dec2bin)
}

pub fn calc_dec2oct<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, dec2oct)
}

pub fn calc_dec2hex<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, dec2hex)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, Option<usize>) -> Option<String>,
{
    assert_or_return!(args.len() == 1 || args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = args_iter.next().unwrap();
    assert_f64_from_calc_value!(num, fetcher.get_calc_value(first));
    let sec = args_iter.next();
    if let Some(places) = sec {
        assert_f64_from_calc_value!(p, fetcher.get_calc_value(places));
        if p <= 0_f64 {
            return CalcVertex::from_error(ast::Error::Num);
        }
        let p = p as usize;
        match func(num, Some(p)) {
            Some(t) => CalcVertex::from_text(t),
            None => CalcVertex::from_error(ast::Error::Num),
        }
    } else {
        match func(num, None) {
            Some(t) => CalcVertex::from_text(t),
            None => CalcVertex::from_error(ast::Error::Num),
        }
    }
}
