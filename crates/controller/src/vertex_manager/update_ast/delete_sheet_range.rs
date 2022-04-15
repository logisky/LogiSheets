use super::super::vertex::{MutReferenceVertex, SheetRangeVertex};
use parser::ast;

pub fn delete_sheet_range(node: ast::Node, sr: &SheetRangeVertex) -> ast::Node {
    let pure = match node.pure {
        ast::PureNode::Func(func) => {
            let new_func = ast::Func {
                op: func.op,
                args: func
                    .args
                    .into_iter()
                    .map(|arg| delete_sheet_range(arg, sr))
                    .collect(),
            };
            ast::PureNode::Func(new_func)
        }
        ast::PureNode::Value(_) => node.pure,
        ast::PureNode::Reference(r) => {
            if match_sheet_range(&r, sr) {
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

fn match_sheet_range(cr: &ast::CellReference, srv: &SheetRangeVertex) -> bool {
    match cr {
        ast::CellReference::Mut(r) => {
            if r.sheet_id != srv.sheet_id {
                return false;
            }
            match &r.reference {
                ast::MutRef::A1ReferenceRange(r) => match (&r.start, &r.end) {
                    (ast::A1Reference::Addr(a1), ast::A1Reference::Addr(a2)) => {
                        if let MutReferenceVertex::AddrRange(range) = &srv.reference {
                            a1.cell_id == range.start && a2.cell_id == range.end
                        } else {
                            false
                        }
                    }
                    _ => {
                        match_sheet_range_a1ref(&r.start, &srv.reference)
                            || match_sheet_range_a1ref(&r.end, &srv.reference)
                    }
                },
                ast::MutRef::A1Reference(r) => match_sheet_range_a1ref(r, &srv.reference),
            }
        }
        _ => false,
    }
}

fn match_sheet_range_a1ref(a1ref: &ast::A1Reference, mrv: &MutReferenceVertex) -> bool {
    match (a1ref, mrv) {
        (ast::A1Reference::A1ColumnRange(a), MutReferenceVertex::ColRange(v)) => {
            a.start == v.start && a.end == v.end
        }
        (ast::A1Reference::A1RowRange(a), MutReferenceVertex::RowRange(v)) => {
            a.start == v.start && a.end == v.end
        }
        _ => false,
    }
}
