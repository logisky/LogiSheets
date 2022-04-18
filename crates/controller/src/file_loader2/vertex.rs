use logisheets_base::{id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, SheetId};
use logisheets_parser::{ast, context::Context, Parser};

use crate::vertex_manager::{executors::input_formula::add_ast_node, VertexManager};

pub fn load_normal_formula<T>(
    vertex_manager: &mut VertexManager,
    book_name: &str,
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
        book_name,
        id_fetcher,
    };
    let parser = Parser {};
    let ast = parser.parse(f, &mut context);
    if ast.is_none() {
        return;
    }
    let ast = ast.unwrap();
    let status = add_ast_node(vertex_manager.status.clone(), sheet_id, cell_id, ast);
    vertex_manager.status = status;
}

pub fn load_shared_formulas<T>(
    vertex_manager: &mut VertexManager,
    book_name: &str,
    sheet_id: SheetId,
    master_row: usize,
    master_col: usize,
    row_start: usize,
    col_start: usize,
    row_end: usize,
    col_end: usize,
    master_formula: &str,
    fetcher: &mut T,
) where
    T: IdFetcherTrait + IndexFetcherTrait,
{
    let mut context = Context {
        sheet_id,
        book_name,
        id_fetcher: fetcher,
    };
    let parser = Parser {};
    let master_ast = parser.parse(master_formula, &mut context);
    if master_ast.is_none() {
        return;
    }
    let master_ast = master_ast.unwrap();
    (row_start..row_end + 1).into_iter().for_each(|row| {
        (col_start..col_end + 1).into_iter().for_each(|col| {
            let status = vertex_manager.status.clone();
            let row_shift = row as i32 - master_row as i32;
            let col_shift = col as i32 - master_col as i32;
            let n = shift_ast_node(master_ast.clone(), sheet_id, row_shift, col_shift, fetcher);
            let cid = fetcher.fetch_cell_id(sheet_id, row, col).unwrap();
            let new_status = add_ast_node(status, sheet_id, cid, n);
            vertex_manager.status = new_status;
        })
    })
}

fn shift_ast_node<T>(
    master: ast::Node,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    fetcher: &mut T,
) -> ast::Node
where
    T: IdFetcherTrait + IndexFetcherTrait,
{
    if row_shift == 0 && col_shift == 0 {
        return master;
    }
    let mut result = master;
    let pure = &mut result.pure;
    shift_pure_node(pure, sheet_id, row_shift, col_shift, fetcher);
    result
}

fn shift_pure_node<T>(
    pure: &mut ast::PureNode,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    fetcher: &mut T,
) where
    T: IdFetcherTrait + IndexFetcherTrait,
{
    match pure {
        ast::PureNode::Func(func) => {
            let args = &mut func.args;
            args.iter_mut().for_each(|node| {
                let p = &mut node.pure;
                shift_pure_node(p, sheet_id, row_shift, col_shift, fetcher);
            });
        }
        ast::PureNode::Value(_) => {}
        ast::PureNode::Reference(cell_ref) => {
            shift_cell_reference(cell_ref, sheet_id, row_shift, col_shift, fetcher);
        }
    }
}

fn shift_cell_reference<T>(
    cr: &mut ast::CellReference,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    fetcher: &mut T,
) -> Option<()>
where
    T: IdFetcherTrait + IndexFetcherTrait,
{
    if row_shift == 0 && col_shift == 0 {
        return None;
    }
    match cr {
        ast::CellReference::Mut(ref_prefix) => match &mut ref_prefix.reference {
            ast::MutRef::A1ReferenceRange(range) => {
                let start = &mut range.start;
                shift_a1_reference(start, sheet_id, row_shift, col_shift, fetcher)?;
                let end = &mut range.end;
                shift_a1_reference(end, sheet_id, row_shift, col_shift, fetcher)
            }
            ast::MutRef::A1Reference(addr) => {
                shift_a1_reference(addr, sheet_id, row_shift, col_shift, fetcher)
            }
        },
        _ => unreachable!(),
    }
}

fn shift_a1_reference<T>(
    a1_ref: &mut ast::A1Reference,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    fetcher: &mut T,
) -> Option<()>
where
    T: IdFetcherTrait + IndexFetcherTrait,
{
    match a1_ref {
        ast::A1Reference::A1ColumnRange(col_range) => {
            if col_range.start_abs && col_range.end_abs {
                return None;
            }
            let start = if col_range.start_abs {
                col_range.start
            } else {
                let idx = fetcher.fetch_col_index(sheet_id, col_range.start)?;
                let new_idx = idx as i32 + col_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = fetcher.fetch_col_id(sheet_id, new_idx)?;
                new_id
            };
            let end = if col_range.end_abs {
                col_range.end
            } else {
                let idx = fetcher.fetch_col_index(sheet_id, col_range.end)?;
                let new_idx = idx as i32 + col_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = fetcher.fetch_col_id(sheet_id, new_idx)?;
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
                let idx = fetcher.fetch_row_index(sheet_id, row_range.start)?;
                let new_idx = idx as i32 + row_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = fetcher.fetch_row_id(sheet_id, new_idx)?;
                new_id
            };
            let end = if row_range.end_abs {
                row_range.end
            } else {
                let idx = fetcher.fetch_row_index(sheet_id, row_range.end)?;
                let new_idx = idx as i32 + row_shift;
                let new_idx = if new_idx < 0 { 0 } else { new_idx as usize };
                let new_id = fetcher.fetch_row_id(sheet_id, new_idx)?;
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
            let (row, col) = fetcher
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
            let new_cell_id = fetcher.fetch_cell_id(sheet_id, row, col)?;
            addr.cell_id = new_cell_id;
            Some(())
        }
    }
}
