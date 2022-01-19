use crate::ast::A1ReferenceRange;

use super::ast;

impl ast::Node {
    pub fn delete(self, sub: &ast::CellReference) -> Self {
        let pure = match self.pure {
            ast::PureNode::Func(func) => {
                let new_func = ast::Func {
                    op: func.op,
                    args: func.args.into_iter().map(|arg| arg.delete(sub)).collect(),
                };
                ast::PureNode::Func(new_func)
            }
            ast::PureNode::Value(_) => self.pure,
            ast::PureNode::Reference(cr) => {
                if reference_equal(&cr, sub) {
                    ast::PureNode::Value(ast::Value::Error(ast::Error::Ref))
                } else {
                    ast::PureNode::Reference(cr)
                }
            }
        };
        ast::Node {
            pure,
            bracket: self.bracket,
        }
    }

    pub fn update_reference_with(
        self,
        old: &ast::CellReference,
        with: &ast::CellReference,
    ) -> Self {
        let pure = match self.pure {
            ast::PureNode::Func(func) => {
                let new_func = ast::Func {
                    op: func.op,
                    args: func
                        .args
                        .into_iter()
                        .map(|arg| arg.update_reference_with(old, with))
                        .collect(),
                };
                ast::PureNode::Func(new_func)
            }
            ast::PureNode::Value(_) => self.pure,
            ast::PureNode::Reference(r) => {
                let reference = if reference_equal(&r, old) {
                    reference_update_with(r, with)
                } else {
                    r
                };
                ast::PureNode::Reference(reference)
            }
        };
        ast::Node {
            pure,
            bracket: self.bracket,
        }
    }
}

/// Update the given reference node. abs_row or abs_col should not be updated.
fn reference_update_with(
    reference: ast::CellReference,
    with: &ast::CellReference,
) -> ast::CellReference {
    match (&reference, with) {
        (ast::CellReference::Mut(mrp1), ast::CellReference::Mut(mrp2)) => {
            if mrp1.sheet_id != mrp2.sheet_id {
                reference
            } else {
                match (&mrp1.reference, &mrp2.reference) {
                    (ast::MutRef::A1ReferenceRange(r1), ast::MutRef::A1ReferenceRange(with)) => {
                        let new_start = replace_a1ref(r1.start.clone(), &with.start);
                        let new_end = replace_a1ref(r1.end.clone(), &with.end);
                        let mut_ref = ast::MutRef::A1ReferenceRange(A1ReferenceRange {
                            start: new_start,
                            end: new_end,
                        });
                        ast::CellReference::Mut(ast::MutRefWithPrefix {
                            sheet_id: mrp1.sheet_id,
                            reference: mut_ref,
                        })
                    }
                    (ast::MutRef::A1Reference(ar1), ast::MutRef::A1Reference(ar2)) => {
                        let new_ar = replace_a1ref(ar1.clone(), ar2);
                        let mut_ref = ast::MutRef::A1Reference(new_ar);
                        ast::CellReference::Mut(ast::MutRefWithPrefix {
                            sheet_id: mrp1.sheet_id,
                            reference: mut_ref,
                        })
                    }
                    _ => reference,
                }
            }
        }
        _ => reference,
    }
}

fn a1reference_equal(r1: &ast::A1Reference, r2: &ast::A1Reference) -> bool {
    match (r1, r2) {
        (ast::A1Reference::A1ColumnRange(cr1), ast::A1Reference::A1ColumnRange(cr2)) => {
            cr1.start == cr2.start && cr1.end == cr2.end
        }
        (ast::A1Reference::A1RowRange(rr1), ast::A1Reference::A1RowRange(rr2)) => {
            rr1.start == rr2.start && rr1.end == rr2.end
        }
        (ast::A1Reference::Addr(a1), ast::A1Reference::Addr(a2)) => a1.cell_id == a2.cell_id,
        _ => false,
    }
}

fn reference_equal(r1: &ast::CellReference, r2: &ast::CellReference) -> bool {
    match (r1, r2) {
        (ast::CellReference::Mut(m1), ast::CellReference::Mut(m2)) => {
            if m1.sheet_id != m2.sheet_id {
                false
            } else {
                match (&m1.reference, &m2.reference) {
                    (ast::MutRef::A1ReferenceRange(r1), ast::MutRef::A1ReferenceRange(r2)) => {
                        a1reference_equal(&r1.start, &r2.start)
                            && a1reference_equal(&r1.end, &r2.end)
                    }
                    (ast::MutRef::A1Reference(a1), ast::MutRef::A1Reference(a2)) => {
                        a1reference_equal(a1, a2)
                    }
                    _ => false,
                }
            }
        }
        (ast::CellReference::UnMut(_), ast::CellReference::UnMut(_)) => false,
        (ast::CellReference::Name(id1), ast::CellReference::Name(id2)) => *id1 == *id2,
        _ => false,
    }
}

fn replace_a1ref(curr: ast::A1Reference, update: &ast::A1Reference) -> ast::A1Reference {
    match (&curr, update) {
        (ast::A1Reference::A1ColumnRange(cr1), ast::A1Reference::A1ColumnRange(cr2)) => {
            ast::A1Reference::A1ColumnRange(ast::ColRange {
                start: cr2.start.clone(),
                end: cr2.end.clone(),
                start_abs: cr1.start_abs,
                end_abs: cr1.end_abs,
            })
        }
        (ast::A1Reference::A1RowRange(rr1), ast::A1Reference::A1RowRange(rr2)) => {
            ast::A1Reference::A1RowRange(ast::RowRange {
                start: rr2.start.clone(),
                end: rr2.end.clone(),
                start_abs: rr1.start_abs,
                end_abs: rr1.end_abs,
            })
        }
        (ast::A1Reference::Addr(a1), ast::A1Reference::Addr(a2)) => {
            ast::A1Reference::Addr(ast::Address {
                cell_id: a2.cell_id.clone(),
                row_abs: a1.row_abs,
                col_abs: a1.col_abs,
            })
        }
        _ => curr,
    }
}

#[cfg(test)]
mod tests {
    use crate::context::Context;
    use crate::test_utils::TestFetcher;
    use crate::unparse::Stringify;
    use crate::{ast, Parser};

    fn build_cell_reference(formula: &str) -> ast::CellReference {
        let mut fetcher = TestFetcher {};
        let parser = Parser {};
        let mut context = Context {
            sheet_id: 0,
            book_name: "book",
            id_fetcher: &mut fetcher,
        };
        let ast = parser.parse(formula, &mut context).unwrap();
        match ast.pure {
            ast::PureNode::Func(_) => panic!(),
            ast::PureNode::Value(_) => panic!(),
            ast::PureNode::Reference(r) => r,
        }
    }

    fn build_node(formula: &str) -> ast::Node {
        let mut fetcher = TestFetcher {};
        let parser = Parser {};
        let mut context = Context {
            sheet_id: 0,
            book_name: "book",
            id_fetcher: &mut fetcher,
        };
        let ast = parser.parse(formula, &mut context).unwrap();
        ast
    }

    #[test]
    fn update_addr_range_test1() {
        let f = "SUM(A1:B3)";
        let node = build_node(f);
        let old_ref = build_cell_reference("A1:B3");
        let new_ref = build_cell_reference("B1:B3");
        let new_node = node.update_reference_with(&old_ref, &new_ref);
        let mut fetcher = TestFetcher {};
        let new_f = new_node.unparse(&mut fetcher, 0);
        assert_eq!(new_f, "SUM(B1:B3)")
    }

    #[test]
    fn update_addr_range_test2() {
        let f = "SUM(A1:B3, 2, A1)";
        let node = build_node(f);
        let old_ref = build_cell_reference("A1:B3");
        let new_ref = build_cell_reference("B1:B3");
        let new_node = node.update_reference_with(&old_ref, &new_ref);
        let mut fetcher = TestFetcher {};
        let new_f = new_node.unparse(&mut fetcher, 0);
        assert_eq!(new_f, "SUM(B1:B3, 2, A1)");
    }

    #[test]
    fn update_col_range_test() {
        let f = "SUM(A:C)";
        let node = build_node(f);
        let old_ref = build_cell_reference("A:C");
        let new_ref = build_cell_reference("A:B");
        let new_node = node.update_reference_with(&old_ref, &new_ref);
        let mut fetcher = TestFetcher {};
        let new_f = new_node.unparse(&mut fetcher, 0);
        assert_eq!(new_f, "SUM(A:B)");
    }
}
