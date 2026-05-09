use logisheets_parser::ast;

use crate::calc_engine::{
    calculator::calc_vertex::{CalcVertex, CalcValue, Value},
    connector::Connector,
};

use super::blockref::calc_by_block;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 4, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let sheet_id = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(sheet_id, sheet_id);
    let block_id = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(block_id, block_id);
    let key = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(key, key);
    let field = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(field, field);
    let sheet_id = sheet_id as u16;
    let block_id = block_id as usize;
    calc_by_block(fetcher, sheet_id, block_id, key, field)
}
