use logisheets_math::bits::{bitand, bitlshift, bitor, bitrshift, bitxor};
use parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::{CalcValue, CalcVertex, Value};

pub fn calc_bitand<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bitand)
}

pub fn calc_bitor<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bitor)
}

pub fn calc_bitxor<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bitxor)
}

pub fn calc_bitlshift<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bitlshift)
}

pub fn calc_bitrshift<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, bitrshift)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, f64) -> Option<f64>,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let first = iter.next().unwrap();
    assert_f64_from_calc_value!(n1, fetcher.get_calc_value(first));
    let second = iter.next().unwrap();
    assert_f64_from_calc_value!(n2, fetcher.get_calc_value(second));
    match func(n1, n2) {
        Some(f) => CalcVertex::from_number(f),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
