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
    let res = fact(num.floor() as u64).to_u64();
    if let Some(res) = res {
        CalcVertex::from_number(res as f64)
    } else {
        CalcVertex::from_error(ast::Error::Value)
    }
}
