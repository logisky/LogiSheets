use im::HashSet;

use crate::vertex_manager::vertex::{
    MutAddrRange, MutColRange, MutReferenceVertex, MutRowRange, SheetRangeVertex, Vertex,
};
use logisheets_base::{CellId, SheetId};
use logisheets_parser::ast::{self, MutRefWithPrefix};

pub fn find_vertices(node: &ast::Node) -> HashSet<Vertex> {
    match &node.pure {
        ast::PureNode::Func(func) => func.args.iter().fold(HashSet::new(), |mut prev, n| {
            prev.extend(find_vertices(n));
            prev
        }),
        ast::PureNode::Value(_) => HashSet::new(),
        ast::PureNode::Reference(cr) => match cr {
            ast::CellReference::Mut(mut_ref) => find_vertices_from_mut_ref(mut_ref),
            ast::CellReference::UnMut(_) => todo!(),
            ast::CellReference::Name(nid) => {
                let mut res = HashSet::new();
                res.insert(Vertex::Name(*nid));
                res
            }
        },
    }
}

pub fn delete_sheet_range_in_ast(node: ast::Node, srv: &SheetRangeVertex) -> ast::Node {
    let pure = match node.pure {
        ast::PureNode::Func(func) => {
            let args = func
                .args
                .into_iter()
                .map(|n| delete_sheet_range_in_ast(n, srv))
                .collect::<Vec<_>>();
            ast::PureNode::Func(ast::Func { op: func.op, args })
        }
        ast::PureNode::Value(_) => node.pure,
        ast::PureNode::Reference(cr) => {
            if match_vertex(&cr, srv) {
                ast::PureNode::Value(ast::Value::Error(ast::Error::Ref))
            } else {
                ast::PureNode::Reference(cr)
            }
        }
    };
    ast::Node {
        pure,
        bracket: node.bracket,
    }
}

pub fn delete_cell_in_ast(node: ast::Node, sheet_id: SheetId, cell_id: CellId) -> ast::Node {
    let pure = match node.pure {
        ast::PureNode::Func(func) => {
            let args = func
                .args
                .into_iter()
                .map(|n| delete_cell_in_ast(n, sheet_id, cell_id))
                .collect::<Vec<_>>();
            ast::PureNode::Func(ast::Func { op: func.op, args })
        }
        ast::PureNode::Value(_) => node.pure,
        ast::PureNode::Reference(cr) => match cr {
            ast::CellReference::Mut(mr) => {
                if sheet_id != mr.sheet_id {
                    ast::PureNode::Reference(ast::CellReference::Mut(mr))
                } else {
                    match mr.reference {
                        ast::MutRef::A1ReferenceRange(a1r) => {
                            if match_a1ref_and_cell(&a1r.start, &cell_id)
                                || match_a1ref_and_cell(&a1r.end, &cell_id)
                            {
                                ast::PureNode::Value(ast::Value::Error(ast::Error::Ref))
                            } else {
                                let mr = ast::MutRefWithPrefix {
                                    sheet_id,
                                    reference: ast::MutRef::A1ReferenceRange(a1r),
                                };
                                ast::PureNode::Reference(ast::CellReference::Mut(mr))
                            }
                        }
                        ast::MutRef::A1Reference(a1) => {
                            if match_a1ref_and_cell(&a1, &cell_id) {
                                ast::PureNode::Value(ast::Value::Error(ast::Error::Ref))
                            } else {
                                let mr = ast::MutRefWithPrefix {
                                    sheet_id,
                                    reference: ast::MutRef::A1Reference(a1),
                                };
                                ast::PureNode::Reference(ast::CellReference::Mut(mr))
                            }
                        }
                    }
                }
            }
            _ => ast::PureNode::Reference(cr),
        },
    };
    ast::Node {
        pure,
        bracket: node.bracket,
    }
}

fn match_a1ref_and_cell(a1ref: &ast::A1Reference, cell_id: &CellId) -> bool {
    match a1ref {
        ast::A1Reference::A1ColumnRange(_) => false,
        ast::A1Reference::A1RowRange(_) => false,
        ast::A1Reference::Addr(addr) => addr.cell_id == *cell_id,
    }
}

fn match_vertex(cr: &ast::CellReference, srv: &SheetRangeVertex) -> bool {
    match cr {
        ast::CellReference::Mut(mut_ref) => {
            if mut_ref.sheet_id != srv.sheet_id {
                return false;
            }
            let r = &srv.reference;
            match &mut_ref.reference {
                ast::MutRef::A1ReferenceRange(a1ref_range) => match_a1ref_range(a1ref_range, r),
                ast::MutRef::A1Reference(a1ref) => match_a1ref_and_sr(a1ref, r),
            }
        }
        _ => false,
    }
}

fn match_a1ref_range(cr: &ast::A1ReferenceRange, srv: &MutReferenceVertex) -> bool {
    match srv {
        MutReferenceVertex::AddrRange(addr) => match (&cr.start, &cr.end) {
            (ast::A1Reference::Addr(s), ast::A1Reference::Addr(e)) => {
                if s.cell_id == addr.start && e.cell_id == addr.end {
                    true
                } else {
                    false
                }
            }
            _ => match_a1ref_and_sr(&cr.start, srv) || match_a1ref_and_sr(&cr.end, srv),
        },
        _ => match_a1ref_and_sr(&cr.start, srv) || match_a1ref_and_sr(&cr.end, srv),
    }
}

fn match_a1ref_and_sr(cr: &ast::A1Reference, srv: &MutReferenceVertex) -> bool {
    match (cr, srv) {
        (ast::A1Reference::A1ColumnRange(cr), MutReferenceVertex::ColRange(cv)) => {
            if cr.start == cv.start && cr.end == cv.end {
                true
            } else {
                false
            }
        }
        (ast::A1Reference::A1RowRange(rr), MutReferenceVertex::RowRange(rv)) => {
            if rr.start == rv.start && rr.end == rv.end {
                true
            } else {
                false
            }
        }
        _ => false,
    }
}

pub fn update_sheet_range_in_ast(
    node: ast::Node,
    old: &SheetRangeVertex,
    curr: &SheetRangeVertex,
) -> ast::Node {
    let pure = match node.pure {
        ast::PureNode::Func(func) => {
            let args = func
                .args
                .into_iter()
                .map(|n| update_sheet_range_in_ast(n, old, curr))
                .collect::<Vec<_>>();
            ast::PureNode::Func(ast::Func { op: func.op, args })
        }
        ast::PureNode::Value(_) => node.pure,
        ast::PureNode::Reference(cr) => match cr {
            ast::CellReference::Mut(m) => {
                if old.sheet_id != m.sheet_id {
                    ast::PureNode::Reference(ast::CellReference::Mut(m))
                } else {
                    let mut mut_ref = m;
                    match &mut mut_ref.reference {
                        ast::MutRef::A1ReferenceRange(a1ref_range) => {
                            update_a1ref_range_with_srv(a1ref_range, old, curr);
                        }
                        ast::MutRef::A1Reference(a1ref) => {
                            update_a1ref_with_srv(a1ref, old, curr);
                        }
                    };
                    ast::PureNode::Reference(ast::CellReference::Mut(mut_ref))
                }
            }
            _ => ast::PureNode::Reference(cr),
        },
    };
    ast::Node {
        pure,
        bracket: node.bracket,
    }
}

fn update_a1ref_range_with_srv(
    a1ref_range: &mut ast::A1ReferenceRange,
    old: &SheetRangeVertex,
    curr: &SheetRangeVertex,
) {
    match (&old.reference, &curr.reference) {
        (MutReferenceVertex::ColRange(_), MutReferenceVertex::ColRange(_)) => {
            update_a1ref_with_srv(&mut a1ref_range.start, old, curr);
            update_a1ref_with_srv(&mut a1ref_range.end, old, curr);
        }
        (MutReferenceVertex::RowRange(_), MutReferenceVertex::RowRange(_)) => {
            update_a1ref_with_srv(&mut a1ref_range.start, old, curr);
            update_a1ref_with_srv(&mut a1ref_range.end, old, curr);
        }
        (MutReferenceVertex::AddrRange(old_range), MutReferenceVertex::AddrRange(new_range)) => {
            match (&mut a1ref_range.start, &mut a1ref_range.end) {
                (ast::A1Reference::Addr(start), ast::A1Reference::Addr(end)) => {
                    if start.cell_id == old_range.start && end.cell_id == old_range.end {
                        start.cell_id = new_range.start;
                        end.cell_id = new_range.end;
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

fn update_a1ref_with_srv(
    a1ref: &mut ast::A1Reference,
    old: &SheetRangeVertex,
    curr: &SheetRangeVertex,
) {
    match (&old.reference, &curr.reference, a1ref) {
        (
            MutReferenceVertex::ColRange(old_vertex),
            MutReferenceVertex::ColRange(new_vertex),
            ast::A1Reference::A1ColumnRange(col_range),
        ) => {
            if col_range.start == old_vertex.start && col_range.end == old_vertex.end {
                col_range.start = new_vertex.start;
                col_range.end = new_vertex.end;
            }
        }
        (
            MutReferenceVertex::RowRange(old_vertex),
            MutReferenceVertex::RowRange(new_vertex),
            ast::A1Reference::A1RowRange(row_range),
        ) => {
            if row_range.start == old_vertex.start && row_range.end == old_vertex.end {
                row_range.start = new_vertex.start;
                row_range.end = new_vertex.end;
            }
        }
        _ => {}
    };
}

fn find_vertices_from_mut_ref(mut_ref: &MutRefWithPrefix) -> HashSet<Vertex> {
    let sheet_id = mut_ref.sheet_id;
    match &mut_ref.reference {
        ast::MutRef::A1ReferenceRange(a1ref_range) => {
            match (&a1ref_range.start, &a1ref_range.end) {
                (ast::A1Reference::Addr(a1), ast::A1Reference::Addr(a2)) => {
                    let addr = MutAddrRange {
                        start: a1.cell_id,
                        end: a2.cell_id,
                    };
                    let v = SheetRangeVertex {
                        sheet_id,
                        reference: MutReferenceVertex::AddrRange(addr),
                    };
                    let mut res = HashSet::new();
                    res.insert(Vertex::SheetRange(v));
                    res
                }
                _ => {
                    let start = get_vertex_from_a1ref(&a1ref_range.start, sheet_id);
                    let end = get_vertex_from_a1ref(&a1ref_range.end, sheet_id);
                    let mut res = HashSet::new();
                    res.insert(start);
                    res.insert(end);
                    res
                }
            }
        }
        ast::MutRef::A1Reference(a1ref) => {
            let v = get_vertex_from_a1ref(a1ref, sheet_id);
            let mut res = HashSet::new();
            res.insert(v);
            res
        }
    }
}

fn get_vertex_from_a1ref(a1ref: &ast::A1Reference, sheet_id: SheetId) -> Vertex {
    match a1ref {
        ast::A1Reference::A1ColumnRange(cr) => {
            let srv = SheetRangeVertex {
                sheet_id,
                reference: MutReferenceVertex::ColRange(MutColRange {
                    start: cr.start,
                    end: cr.end,
                }),
            };
            Vertex::SheetRange(srv)
        }
        ast::A1Reference::A1RowRange(rr) => {
            let srv = SheetRangeVertex {
                sheet_id,
                reference: MutReferenceVertex::RowRange(MutRowRange {
                    start: rr.start,
                    end: rr.end,
                }),
            };
            Vertex::SheetRange(srv)
        }
        ast::A1Reference::Addr(addr) => {
            let cid = addr.cell_id;
            let fid = (sheet_id, cid);
            Vertex::Cell(fid)
        }
    }
}
