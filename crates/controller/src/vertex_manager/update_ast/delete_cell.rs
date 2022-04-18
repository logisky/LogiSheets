use logisheets_base::{CellId, SheetId};
use logisheets_parser::ast;

pub fn delete_cell(node: ast::Node, sheet_id: SheetId, cell_id: CellId) -> ast::Node {
    let pure = match node.pure {
        ast::PureNode::Func(func) => {
            let new_func = ast::Func {
                op: func.op,
                args: func
                    .args
                    .into_iter()
                    .map(|arg| delete_cell(arg, sheet_id, cell_id))
                    .collect(),
            };
            ast::PureNode::Func(new_func)
        }
        ast::PureNode::Value(_) => node.pure,
        ast::PureNode::Reference(r) => {
            if match_cell(&r, sheet_id, cell_id) {
                ast::PureNode::Value(ast::Value::Error(ast::Error::Ref))
            } else {
                ast::PureNode::Reference(r)
            }
        }
    };
    ast::Node {
        pure,
        bracket: node.bracket,
    }
}

fn match_cell(cr: &ast::CellReference, sheet_id: SheetId, cell_id: CellId) -> bool {
    match cr {
        ast::CellReference::Mut(r) => {
            if r.sheet_id != sheet_id {
                return false;
            }
            match &r.reference {
                ast::MutRef::A1ReferenceRange(range) => {
                    match_cell_a1ref(&range.start, cell_id) || match_cell_a1ref(&range.end, cell_id)
                }
                ast::MutRef::A1Reference(a1) => match_cell_a1ref(a1, cell_id),
            }
        }
        _ => false,
    }
}

fn match_cell_a1ref(a1ref: &ast::A1Reference, cell_id: CellId) -> bool {
    match a1ref {
        ast::A1Reference::Addr(addr) => addr.cell_id == cell_id,
        _ => false,
    }
}
