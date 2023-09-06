use crate::calc_engine::calculator::calc_vertex::CalcValue;
use crate::calc_engine::connector::Connector;

use super::utils::{is_error, is_na_error};
use super::CalcVertex;
use logisheets_parser::ast;

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F) -> CalcVertex
where
    C: Connector,
    F: Fn(&CalcValue) -> bool,
{
    if args.len() != 2 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let value = fetcher.get_calc_value(iter.next().unwrap());
    if f(&value) {
        iter.next().unwrap()
    } else {
        CalcVertex::Value(value)
    }
}

pub fn calc_iferror<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, &is_error)
}

pub fn calc_ifna<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc(args, fetcher, &is_na_error)
}
