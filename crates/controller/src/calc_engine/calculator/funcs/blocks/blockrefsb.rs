use logisheets_parser::ast;

use crate::calc_engine::{
    calculator::calc_vertex::{CalcVertex, CalcValue, Value},
    connector::Connector,
};

use super::blockrefs::calc_matrix;

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
    let key_condition = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(key_condition, key_condition);
    let field_condition = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(field_condition, field_condition);

    let sheet_id = sheet_id as u16;
    let block_id = block_id as usize;

    let keys = fetcher
        .get_all_keys_by_block(sheet_id, block_id)
        .into_iter()
        .map(|(t, _, _)| Value::Text(t));
    let fields = fetcher
        .get_all_fields_by_block(sheet_id, block_id)
        .into_iter()
        .map(|t| t);

    calc_matrix(
        fetcher,
        keys,
        fields,
        key_condition,
        field_condition,
        |fetcher, key, field| fetcher.resolve_by_block(sheet_id, block_id, key, field),
    )
}
