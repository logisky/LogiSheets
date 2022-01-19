use controller_base::{id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, SheetId};
use im::{HashMap, HashSet};
use parser::{
    ast::{self, A1Reference, PureNode},
    context::Context,
    Parser,
};

use crate::vertex_manager::{
    executors::input_formula::add_ast_node, status::Status as VertexStatus, VertexManager,
};

#[derive(Debug, Clone, Default)]
pub struct VertexLoader {
    book_name: String,
    status: VertexStatus,
}

impl VertexLoader {
    pub fn load_formula<T>(
        &mut self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
        f: &str,
        id_fetcher: &mut T,
    ) where
        T: IdFetcherTrait,
    {
        let cell_id = id_fetcher.fetch_cell_id(sheet_id, row, col).unwrap();
        let mut context = Context {
            sheet_id,
            book_name: &self.book_name,
            id_fetcher,
        };
        let parser = Parser {};
        let ast = parser.parse(f, &mut context);
        if ast.is_none() {
            return;
        }
        let ast = ast.unwrap();
        let status = add_ast_node(self.status.clone(), sheet_id, cell_id, ast);
        self.status = status;
    }

    pub fn load_shared_formulas<T, F>(
        &mut self,
        sheet_id: SheetId,
        master_row: usize,
        master_col: usize,
        row_start: usize,
        col_start: usize,
        row_end: usize,
        col_end: usize,
        master_formula: &str,
        id_fetcher: &mut T,
        idx_fetcher: &mut F,
    ) where
        T: IdFetcherTrait,
        F: IndexFetcherTrait,
    {
        let mut context = Context {
            sheet_id,
            book_name: &self.book_name,
            id_fetcher,
        };
        let parser = Parser {};
        let master_ast = parser.parse(master_formula, &mut context);
        if master_ast.is_none() {
            return;
        }
        let master_ast = master_ast.unwrap();
        (row_start..row_end + 1).into_iter().for_each(|row| {
            (col_start..col_end + 1).into_iter().for_each(|col| {
                let row_shift = row as i32 - master_row as i32;
                let col_shift = col as i32 - master_col as i32;
                let n = shift_ast_node(
                    master_ast.clone(),
                    sheet_id,
                    row_shift,
                    col_shift,
                    id_fetcher,
                    idx_fetcher,
                );
                let cid = id_fetcher.fetch_cell_id(sheet_id, row, col).unwrap();
                let new_status = add_ast_node(self.status.clone(), sheet_id, cid, n);
                self.status = new_status;
            })
        })
    }

    pub fn finish(self) -> VertexManager {
        VertexManager {
            status: self.status,
            dirty_nodes: HashSet::new(),
            calc_rdeps: HashMap::new(),
        }
    }
}

fn shift_ast_node<T, F>(
    master: ast::Node,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    id_fetcher: &mut T,
    idx_fetcher: &mut F,
) -> ast::Node
where
    T: IdFetcherTrait,
    F: IndexFetcherTrait,
{
    if row_shift == 0 && col_shift == 0 {
        return master;
    }
    let mut result = master;
    let pure = &mut result.pure;
    shift_pure_node(
        pure,
        sheet_id,
        row_shift,
        col_shift,
        id_fetcher,
        idx_fetcher,
    );
    result
}

fn shift_pure_node<T, F>(
    pure: &mut PureNode,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    id_fetcher: &mut T,
    idx_fetcher: &mut F,
) where
    T: IdFetcherTrait,
    F: IndexFetcherTrait,
{
    match pure {
        ast::PureNode::Func(func) => {
            let args = &mut func.args;
            args.iter_mut().for_each(|node| {
                let p = &mut node.pure;
                shift_pure_node(p, sheet_id, row_shift, col_shift, id_fetcher, idx_fetcher);
            });
        }
        ast::PureNode::Value(_) => {}
        ast::PureNode::Reference(cell_ref) => {
            shift_cell_reference(
                cell_ref,
                sheet_id,
                row_shift,
                col_shift,
                id_fetcher,
                idx_fetcher,
            );
        }
    }
}

fn shift_cell_reference<T, F>(
    cr: &mut ast::CellReference,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    id_fetcher: &mut T,
    idx_fetcher: &mut F,
) -> Option<()>
where
    T: IdFetcherTrait,
    F: IndexFetcherTrait,
{
    if row_shift == 0 && col_shift == 0 {
        return None;
    }
    match cr {
        ast::CellReference::Mut(ref_prefix) => match &mut ref_prefix.reference {
            ast::MutRef::A1ReferenceRange(range) => {
                let start = &mut range.start;
                shift_a1_reference(
                    start,
                    sheet_id,
                    row_shift,
                    col_shift,
                    id_fetcher,
                    idx_fetcher,
                )?;
                let end = &mut range.end;
                shift_a1_reference(end, sheet_id, row_shift, col_shift, id_fetcher, idx_fetcher)
            }
            ast::MutRef::A1Reference(addr) => shift_a1_reference(
                addr,
                sheet_id,
                row_shift,
                col_shift,
                id_fetcher,
                idx_fetcher,
            ),
        },
        _ => unreachable!(),
    }
}

fn shift_a1_reference<T, F>(
    a1_ref: &mut A1Reference,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    id_fetcher: &mut T,
    idx_fetcher: &mut F,
) -> Option<()>
where
    T: IdFetcherTrait,
    F: IndexFetcherTrait,
{
    match a1_ref {
        ast::A1Reference::A1ColumnRange(col_range) => {
            if col_range.start_abs && col_range.end_abs {
                return None;
            }
            let start = if col_range.start_abs {
                col_range.start
            } else {
                let idx = idx_fetcher.fetch_col_index(sheet_id, col_range.start)?;
                let new_idx = idx as i32 + col_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = id_fetcher.fetch_col_id(sheet_id, new_idx)?;
                new_id
            };
            let end = if col_range.end_abs {
                col_range.end
            } else {
                let idx = idx_fetcher.fetch_col_index(sheet_id, col_range.end)?;
                let new_idx = idx as i32 + col_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = id_fetcher.fetch_col_id(sheet_id, new_idx)?;
                new_id
            };
            col_range.start = start;
            col_range.end = end;
            Some(())
        }
        ast::A1Reference::A1RowRange(row_range) => {
            if row_range.start_abs && row_range.end_abs {
                return None;
            }
            let start = if row_range.start_abs {
                row_range.start
            } else {
                let idx = idx_fetcher.fetch_row_index(sheet_id, row_range.start)?;
                let new_idx = idx as i32 + row_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = id_fetcher.fetch_row_id(sheet_id, new_idx)?;
                new_id
            };
            let end = if row_range.end_abs {
                row_range.end
            } else {
                let idx = idx_fetcher.fetch_row_index(sheet_id, row_range.end)?;
                let new_idx = idx as i32 + row_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = id_fetcher.fetch_row_id(sheet_id, new_idx)?;
                new_id
            };
            row_range.start = start;
            row_range.end = end;
            Some(())
        }
        ast::A1Reference::Addr(addr) => {
            if addr.row_abs && addr.row_abs {
                return None;
            }
            let (row, col) = idx_fetcher
                .fetch_cell_index(sheet_id, &addr.cell_id)
                .unwrap_or((0, 0));
            let row = if addr.row_abs {
                row
            } else {
                let r = row as i32 + row_shift;
                if r < 0 {
                    0
                } else {
                    r as usize
                }
            };
            let col = if addr.col_abs {
                col
            } else {
                let c = col as i32 + col_shift;
                if c < 0 {
                    0
                } else {
                    c as usize
                }
            };
            let new_cell_id = id_fetcher.fetch_cell_id(sheet_id, row, col)?;
            addr.cell_id = new_cell_id;
            Some(())
        }
    }
}
