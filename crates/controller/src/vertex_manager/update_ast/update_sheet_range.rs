use logisheets_parser::ast;

use crate::vertex_manager::vertex::{MutReferenceVertex, SheetRangeVertex};

pub fn update_sheet_range(
    node: &mut ast::Node,
    old_sr: &SheetRangeVertex,
    new_sr: &SheetRangeVertex,
) {
    let res = node;
    match &mut res.pure {
        ast::PureNode::Func(func) => func.args.iter_mut().for_each(|arg| {
            update_sheet_range(arg, old_sr, new_sr);
        }),
        ast::PureNode::Value(_) => {}
        ast::PureNode::Reference(cr) => match cr {
            ast::CellReference::Mut(cr) => {
                if cr.sheet_id != old_sr.sheet_id || cr.sheet_id != new_sr.sheet_id {
                    return;
                }
                let (o, m) = (&old_sr.reference, &new_sr.reference);
                match &mut cr.reference {
                    ast::MutRef::A1ReferenceRange(range) => {
                        update_a1ref(&mut range.start, o, m);
                        update_a1ref(&mut range.end, m, m);
                    }
                    ast::MutRef::A1Reference(a1ref) => update_a1ref(a1ref, o, m),
                }
            }
            _ => {}
        },
    }
}

fn update_a1ref(a1ref: &mut ast::A1Reference, o: &MutReferenceVertex, n: &MutReferenceVertex) {
    match a1ref {
        ast::A1Reference::A1ColumnRange(a1cr) => match (o, n) {
            (MutReferenceVertex::ColRange(orr), MutReferenceVertex::ColRange(nrr)) => {
                if a1cr.start == orr.start && a1cr.end == orr.end {
                    a1cr.start = nrr.start;
                    a1cr.end = nrr.end;
                }
            }
            _ => {}
        },
        ast::A1Reference::A1RowRange(a1rr) => match (o, n) {
            (MutReferenceVertex::RowRange(orr), MutReferenceVertex::RowRange(nrr)) => {
                if a1rr.start == orr.start && a1rr.end == orr.end {
                    a1rr.start = nrr.start;
                    a1rr.end = nrr.end;
                }
            }
            _ => {}
        },
        ast::A1Reference::Addr(_) => {}
    }
}

fn update_a1ref_range(
    a1ref: &mut ast::A1ReferenceRange,
    o: &MutReferenceVertex,
    n: &MutReferenceVertex,
) {
    match (&mut a1ref.start, &mut a1ref.end) {
        (ast::A1Reference::Addr(a1), ast::A1Reference::Addr(a2)) => match (o, n) {
            (MutReferenceVertex::AddrRange(or), MutReferenceVertex::AddrRange(nr)) => {
                if or.start != a1.cell_id || or.end != a2.cell_id {
                    return;
                }
                a1.cell_id = nr.start;
                a2.cell_id = nr.end;
            }
            _ => {}
        },
        _ => {
            update_a1ref(&mut a1ref.start, o, n);
            update_a1ref(&mut a1ref.end, o, n);
        }
    }
}
