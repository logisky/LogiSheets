use logisheets_parser::ast;

use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};

use super::blockrefs;

/// Entry point for `PureNode::BlockRef` evaluation. Both `Single` (BLOCKREF /
/// BLOCKREFB) and `Multi` (BLOCKREFS / BLOCKREFSB) forms now share one
/// dispatch — the legacy distinction between `*` and `*B` was just a parsing
/// convention and disappears once ids are resolved at parse time.
pub fn calc_block_ref<C>(node: &ast::BlockRefNode, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match node {
        ast::BlockRefNode::Single {
            sheet_id,
            block_id,
            field_id,
            key,
            ..
        } => calc_single(*sheet_id, *block_id, *field_id, key, fetcher),
        ast::BlockRefNode::Multi {
            sheet_id,
            block_id,
            key_condition,
            field_condition,
            ..
        } => blockrefs::calc_multi(
            *sheet_id,
            *block_id,
            key_condition,
            field_condition,
            fetcher,
        ),
    }
}

fn calc_single<C>(
    sheet_id: logisheets_base::SheetId,
    block_id: logisheets_base::BlockId,
    field_id: logisheets_base::BlockFieldId,
    key: &ast::Node,
    fetcher: &mut C,
) -> CalcVertex
where
    C: Connector,
{
    // Evaluate the runtime `key` expression. It might be a literal string or
    // a cell reference like `A1`; both reduce to a CalcValue::Scalar(Text).
    let key_vertex = crate::calc_engine::calculator::calculator::calc_node(key, fetcher);
    let key_value = fetcher.get_calc_value(key_vertex);
    let key_text = match key_value {
        CalcValue::Scalar(Value::Text(t)) => t,
        CalcValue::Scalar(Value::Number(n)) => n.to_string(),
        CalcValue::Scalar(Value::Boolean(b)) => {
            if b {
                "TRUE".to_string()
            } else {
                "FALSE".to_string()
            }
        }
        _ => return CalcVertex::from_error(ast::Error::Value),
    };

    let result = fetcher.resolve_by_block_field_id(sheet_id, block_id, &key_text, field_id);
    let (resolved_sheet, cell_id) = match result {
        Some(v) => v,
        None => return CalcVertex::from_error(ast::Error::Value),
    };
    match fetcher.get_block_cell_value(resolved_sheet, cell_id) {
        Some(value) => CalcVertex::Value(value),
        None => CalcVertex::from_error(ast::Error::Value),
    }
}
