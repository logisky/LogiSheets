use crate::calc_engine::calculator::math::bits::{
    bin2hex, bin2oct, hex2bin, hex2oct, oct2bin, oct2hex,
};
use logisheets_parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::{CalcValue, CalcVertex, Value};

pub fn calc_bin2hex<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bin2hex)
}

pub fn calc_bin2oct<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bin2oct)
}

pub fn calc_oct2hex<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, oct2hex)
}

pub fn calc_oct2bin<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, oct2bin)
}

pub fn calc_hex2bin<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, hex2bin)
}

pub fn calc_hex2oct<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, hex2oct)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(&str, Option<usize>) -> Option<String>,
{
    assert_or_return!(args.len() == 1 || args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = args_iter.next().unwrap();
    assert_text_from_calc_value!(num_str, fetcher.get_calc_value(first));
    let sec = args_iter.next();
    if let Some(places) = sec {
        assert_f64_from_calc_value!(p, fetcher.get_calc_value(places));
        if p <= 0_f64 {
            return CalcVertex::from_error(ast::Error::Num);
        }
        let p = p as usize;
        match func(&num_str, Some(p)) {
            Some(t) => CalcVertex::from_text(t),
            None => CalcVertex::from_error(ast::Error::Num),
        }
    } else {
        match func(&num_str, None) {
            Some(t) => CalcVertex::from_text(t),
            None => CalcVertex::from_error(ast::Error::Num),
        }
    }
}
