use controller_base::SheetId;

use crate::ast;
use std::collections::HashSet;
use std::hash::Hash;

pub fn find_cell_references<T, F>(node: &ast::Node, filter: &F) -> HashSet<T>
where
    T: Hash + Eq,
    F: Fn(&ast::CellReference) -> Option<T>,
{
    match &node.pure {
        ast::PureNode::Func(func) => {
            let mut result = HashSet::<T>::new();
            func.args.iter().for_each(|arg| {
                let arg_result = find_cell_references(arg, filter);
                result.extend(arg_result);
            });
            result
        }
        ast::PureNode::Value(_) => HashSet::new(),
        ast::PureNode::Reference(r) => {
            let mut result = HashSet::new();
            if let Some(t) = filter(r) {
                result.insert(t);
            }
            result
        }
    }
}

pub fn is_range_vertex(reference: &ast::CellReference) -> Option<(ast::CellReference, SheetId)> {
    match reference {
        ast::CellReference::Mut(mut_ref) => {
            let sheet_id = mut_ref.sheet_id;
            match &mut_ref.reference {
                ast::MutRef::A1ReferenceRange(_) => Some((reference.clone(), sheet_id)),
                ast::MutRef::A1Reference(a1ref) => match a1ref {
                    ast::A1Reference::A1ColumnRange(_) => Some((reference.clone(), sheet_id)),
                    ast::A1Reference::A1RowRange(_) => Some((reference.clone(), sheet_id)),
                    ast::A1Reference::Addr(_) => None,
                },
            }
        }
        ast::CellReference::Name(_) => None,
        ast::CellReference::UnMut(_) => None,
    }
}

pub fn is_sts_vertex(
    reference: &ast::CellReference,
) -> Option<(SheetId, SheetId, ast::CellReference)> {
    match reference {
        ast::CellReference::Mut(_) => None,
        ast::CellReference::UnMut(unmut_ref) => match &unmut_ref.prefix {
            ast::UnMutRefPrefix::Local(l) => match l {
                ast::LocalUnMutRefPrefix::SheetToSheet(sts) => {
                    Some((sts.from_sheet, sts.to_sheet, reference.clone()))
                }
            },
            ast::UnMutRefPrefix::External(_) => None,
        },
        ast::CellReference::Name(_) => None,
    }
}
