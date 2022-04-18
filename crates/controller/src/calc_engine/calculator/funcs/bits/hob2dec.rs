use crate::calc_engine::calculator::math::bits::{bin2dec, hex2dec, oct2dec};
use parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::{CalcValue, CalcVertex, Value};

pub fn calc_oct2dec<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, oct2dec)
}

pub fn calc_hex2dec<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, hex2dec)
}

pub fn calc_bin2dec<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bin2dec)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(&str) -> Option<f64>,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let first = args.into_iter().next().unwrap();
    assert_text_from_calc_value!(num_str, fetcher.get_calc_value(first));
    match func(&num_str) {
        Some(f) => CalcVertex::from_number(f),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
