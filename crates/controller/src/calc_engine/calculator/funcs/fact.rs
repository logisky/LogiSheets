use crate::calc_engine::{
    calculator::{
        calc_vertex::{CalcValue, CalcVertex, Value},
        math::fact::fact,
    },
    connector::Connector,
};

use logisheets_parser::ast;
use num::ToPrimitive;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let first = args.into_iter().next().unwrap();
    assert_f64_from_calc_value!(num, fetcher.get_calc_value(first));
    // FACT truncates its argument; negatives and anything past 170! (which
    // overflows f64) are #NUM! in Excel.
    assert_or_return!(num >= 0., ast::Error::Num);
    let n = num.floor();
    assert_or_return!(n <= 170., ast::Error::Num);
    match fact(n as u64).to_f64() {
        Some(res) if res.is_finite() => CalcVertex::from_number(res),
        _ => CalcVertex::from_error(ast::Error::Num),
    }
}
