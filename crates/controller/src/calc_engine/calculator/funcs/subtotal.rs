//! SUBTOTAL(function_num, ref1, …) — apply an aggregate to the refs, chosen by
//! `function_num` (1–11 include hidden rows, 101–111 exclude them). Headless
//! there are no hidden rows, so both ranges behave identically and we simply
//! dispatch to the matching aggregate.

use super::{aggregate, average, count, distribution, sum};
use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 2, ast::Error::Unspecified);
    let mut iter = args.into_iter();
    let first = fetcher.get_calc_value(iter.next().unwrap());
    assert_f64_from_calc_value!(fnum, first);
    let rest: Vec<CalcVertex> = iter.collect();

    // 101–111 (exclude hidden) collapse onto 1–11 in a headless engine.
    let code = {
        let n = fnum.trunc() as i64;
        if n >= 101 { n - 100 } else { n }
    };
    match code {
        1 => average::calc_average(rest, fetcher),
        2 => count::calc(rest, fetcher),
        3 => count::calc_counta(rest, fetcher),
        4 => aggregate::calc_max(rest, fetcher),
        5 => aggregate::calc_min(rest, fetcher),
        6 => aggregate::calc_product(rest, fetcher),
        7 => distribution::statistics::calc_stdev(rest, fetcher),
        8 => distribution::statistics::calc_stdevp(rest, fetcher),
        9 => sum::calc(rest, fetcher),
        10 => distribution::statistics::calc_var(rest, fetcher),
        11 => distribution::statistics::calc_varp(rest, fetcher),
        _ => CalcVertex::from_error(ast::Error::Value),
    }
}
