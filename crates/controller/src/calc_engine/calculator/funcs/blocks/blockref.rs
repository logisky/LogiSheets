use logisheets_parser::ast;

use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let ref_name = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(ref_name, ref_name);
    let key = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(key, key);
    let field = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(field, field);
    let result = fetcher.resolve(&ref_name, &key, &field);
    if result.is_none() {
        return CalcVertex::from_error(ast::Error::Value);
    }
    let (sheet_id, cell_id) = result.unwrap();
    let value = fetcher.get_block_cell_value(sheet_id, cell_id);
    match value {
        Some(value) => CalcVertex::Value(value),
        None => CalcVertex::from_error(ast::Error::Value),
    }
}
