use logisheets_base::matrix_value::MatrixValue;
use logisheets_parser::ast;

use crate::calc_engine::{
    calculator::{
        calc_vertex::{CalcValue, CalcVertex, Value},
        funcs::condition::{match_condition, parse_condition},
    },
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

    let key_condition = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(key_condition, key_condition);
    let key_condigtion =
        parse_condition(&key_condition).ok_or(CalcVertex::from_error(ast::Error::Unspecified));
    if let Err(e) = key_condigtion {
        return e;
    }
    let key_condigtion = key_condigtion.unwrap();
    let keys = fetcher
        .get_all_keys(&ref_name)
        .into_iter()
        .map(|(t, _, _)| Value::Text(t));
    let key_values = keys
        .into_iter()
        .filter(|key| match_condition(&key_condigtion, key))
        .collect::<Vec<_>>();

    let field_condition = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(field_condition, field_condition);
    let field_condigtion =
        parse_condition(&field_condition).ok_or(CalcVertex::from_error(ast::Error::Unspecified));
    if let Err(e) = field_condigtion {
        return e;
    }
    let field_condigtion = field_condigtion.unwrap();
    let fields = fetcher
        .get_all_fields(&ref_name)
        .into_iter()
        .map(|t| Value::Text(t));
    let field_values = fields
        .into_iter()
        .filter(|field| match_condition(&field_condigtion, field))
        .collect::<Vec<_>>();

    let mut result = vec![];
    for k in key_values.into_iter() {
        let key = k.assert_text();
        let mut values = vec![];
        for f in field_values.iter() {
            let field = f.assert_text_ptr();
            let v = fetcher.resolve(&ref_name, &key, field);
            if let Some((sheet_id, cell_id)) = v {
                let value = fetcher.get_block_cell_value(sheet_id, cell_id);
                if let Some(value) = value {
                    match value {
                        CalcValue::Scalar(value) => values.push(value),
                        _ => {}
                    }
                }
            }
        }
        result.push(values);
    }
    let matrix = MatrixValue::from(result);
    CalcVertex::Value(CalcValue::Range(matrix))
}
