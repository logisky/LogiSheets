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
    let field_condition = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(field_condition, field_condition);

    let keys = fetcher
        .get_all_keys(&ref_name)
        .into_iter()
        .map(|(t, _, _)| Value::Text(t));
    let fields = fetcher.get_all_fields(&ref_name).into_iter();

    calc_matrix(
        fetcher,
        keys,
        fields,
        key_condition,
        field_condition,
        |fetcher, key, field| fetcher.resolve(&ref_name, key, field),
    )
}

pub(crate) fn calc_matrix<C, IKeys, IFields, F>(
    fetcher: &mut C,
    keys: IKeys,
    fields: IFields,
    key_condition_str: String,
    field_condition_str: String,
    resolve: F,
) -> CalcVertex
where
    C: Connector,
    IKeys: Iterator<Item = Value>,
    IFields: Iterator<Item = String>,
    F: Fn(
        &mut C,
        &String,
        &String,
    ) -> Option<(logisheets_base::SheetId, logisheets_base::BlockCellId)>,
{
    let key_condition =
        parse_condition(&key_condition_str).ok_or(CalcVertex::from_error(ast::Error::Unspecified));
    if let Err(e) = key_condition {
        return e;
    }
    let key_condition = key_condition.unwrap();
    let key_values = keys
        .filter(|key| match_condition(&key_condition, key))
        .collect::<Vec<_>>();

    let field_condition = parse_condition(&field_condition_str)
        .ok_or(CalcVertex::from_error(ast::Error::Unspecified));
    if let Err(e) = field_condition {
        return e;
    }
    let field_condition = field_condition.unwrap();
    let field_values = fields
        .filter(|field| match_condition(&field_condition, &Value::Text(field.clone())))
        .collect::<Vec<_>>();

    let mut result = vec![];
    for k in key_values.into_iter() {
        let key = k.assert_text();
        let mut values = vec![];
        for f in field_values.iter() {
            let v = resolve(fetcher, &key, f);
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
