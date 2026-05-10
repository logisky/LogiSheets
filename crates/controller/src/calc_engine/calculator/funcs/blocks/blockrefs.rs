use logisheets_base::matrix_value::MatrixValue;
use logisheets_parser::ast;

use crate::calc_engine::{
    calculator::{
        calc_vertex::{CalcValue, CalcVertex, Value},
        funcs::condition::{match_condition, parse_condition},
    },
    connector::Connector,
};

/// Multi-cell block reference. The textual ref-name has already been
/// resolved to `(sheet_id, block_id)` at parse time, so this just evaluates
/// the runtime conditions and gathers the matching cells.
pub fn calc_multi<C>(
    sheet_id: logisheets_base::SheetId,
    block_id: logisheets_base::BlockId,
    key_condition: &ast::Node,
    field_condition: &ast::Node,
    fetcher: &mut C,
) -> CalcVertex
where
    C: Connector,
{
    let key_condition_str = match calc_text_arg(key_condition, fetcher) {
        Some(s) => s,
        None => return CalcVertex::from_error(ast::Error::Value),
    };
    let field_condition_str = match calc_text_arg(field_condition, fetcher) {
        Some(s) => s,
        None => return CalcVertex::from_error(ast::Error::Value),
    };

    let keys = fetcher
        .get_all_keys_by_block(sheet_id, block_id)
        .into_iter()
        .map(|(t, _, _)| Value::Text(t));
    let fields = fetcher
        .get_all_fields_by_block(sheet_id, block_id)
        .into_iter();

    calc_matrix(
        fetcher,
        keys,
        fields,
        key_condition_str,
        field_condition_str,
        |fetcher, key, field| fetcher.resolve_by_block(sheet_id, block_id, key, field),
    )
}

fn calc_text_arg<C: Connector>(node: &ast::Node, fetcher: &mut C) -> Option<String> {
    let v = crate::calc_engine::calculator::calculator::calc_node(node, fetcher);
    match fetcher.get_calc_value(v) {
        CalcValue::Scalar(Value::Text(t)) => Some(t),
        CalcValue::Scalar(Value::Number(n)) => Some(n.to_string()),
        _ => None,
    }
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
