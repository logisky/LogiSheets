use logisheets_base::{id_fetcher::IdFetcherTrait, CellId, NormalRange, Range, SheetId};
use logisheets_parser::{ast, Parser};

use crate::{connectors::FormulaConnector, formula_manager::FormulaManager};

pub fn load_normal_formula<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    sheet_id: SheetId,
    row: usize,
    col: usize,
    f: &str,
    connector: &'a mut FormulaConnector<'a>,
) {
    let cid = connector.fetch_cell_id(&sheet_id, row, col).unwrap();
    if let CellId::NormalCell(c) = cid {
        let range = Range::Normal(NormalRange::Single(c));
        let range_id = connector.range_manager.get_range_id(&sheet_id, &range);

        let ast_node = parse_formula(sheet_id, connector, f);

        formula_manager.add_ast_node(sheet_id, cid, range_id, ast_node)
    }
}

fn parse_formula<'a: 'c, 'b, 'c>(
    sheet_id: SheetId,
    connector: &'c mut FormulaConnector<'a>,
    f: &str,
) -> ast::Node {
    let parser = Parser {};
    parser.parse(f, sheet_id, connector).unwrap()
}

pub fn load_shared_formulas<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    sheet_id: SheetId,
    master_row: usize,
    master_col: usize,
    row_start: usize,
    col_start: usize,
    row_end: usize,
    col_end: usize,
    master_formula: &str,
    connector: &'a mut FormulaConnector<'a>,
) {
    let master_ast = parse_formula(sheet_id, connector, master_formula);
    for row in row_start..row_end + 1 {
        for col in col_start..col_end + 1 {
            let cid = connector.fetch_cell_id(&sheet_id, row, col).unwrap();
            let row_shift = row as i32 - master_row as i32;
            let col_shift = col as i32 - master_col as i32;
            let n = shift_ast_node(
                formula_manager,
                master_ast.clone(),
                sheet_id,
                row_shift,
                col_shift,
                connector,
            );
            if let CellId::NormalCell(c) = cid {
                let range = Range::Normal(NormalRange::Single(c));
                let range_id = connector.range_manager.get_range_id(&sheet_id, &range);
                formula_manager.add_ast_node(sheet_id, cid, range_id, n)
            } else {
                unreachable!()
            }
        }
    }
}

fn shift_ast_node<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    master: ast::Node,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    connector: &'a mut FormulaConnector,
) -> ast::Node {
    if row_shift == 0 && col_shift == 0 {
        return master;
    }
    let mut result = master;
    let pure = &mut result.pure;
    shift_pure_node(
        formula_manager,
        pure,
        sheet_id,
        row_shift,
        col_shift,
        connector,
    );
    result
}

fn shift_pure_node<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    pure: &'b mut ast::PureNode,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    connector: &'a mut FormulaConnector,
) {
    match pure {
        ast::PureNode::Func(func) => {
            let args = &mut func.args;
            args.iter_mut().for_each(|node| {
                let p = &mut node.pure;
                shift_pure_node(
                    formula_manager,
                    p,
                    sheet_id,
                    row_shift,
                    col_shift,
                    connector,
                );
            });
        }
        ast::PureNode::Value(_) => {}
        ast::PureNode::Reference(cell_ref) => {
            shift_cell_reference(cell_ref, sheet_id, row_shift, col_shift, connector);
        }
    }
}

fn shift_cell_reference(
    cr: &mut ast::CellReference,
    sheet_id: SheetId,
    row_shift: i32,
    col_shift: i32,
    connector: &mut FormulaConnector,
) -> Option<()> {
    if row_shift == 0 && col_shift == 0 {
        return None;
    }
    match cr {
        ast::CellReference::Mut(range_display) => {
            let range_id = range_display.range_id;
            let range = connector.range_manager.get_range(&sheet_id, &range_id)?;
            match range {
                Range::Normal(n) => match n {
                    NormalRange::Single(c) => {
                        let (row_idx, col_idx) = connector
                            .idx_navigator
                            .fetch_normal_cell_idx(&sheet_id, &c)
                            .unwrap();
                        let r = (row_idx as i32 + row_shift) as usize;
                        let c = (col_idx as i32 + col_shift) as usize;
                        let cell_id = connector.fetch_cell_id(&sheet_id, r, c).unwrap();
                        if let CellId::NormalCell(n) = cell_id {
                            let shift_range = Range::Normal(NormalRange::Single(n));
                            let range_id = connector
                                .range_manager
                                .get_range_id(&sheet_id, &shift_range);
                            range_display.range_id = range_id;
                            Some(())
                        } else {
                            unreachable!()
                        }
                    }
                    _ => None,
                },
                Range::Block(_) => unreachable!(),
                Range::Ephemeral(_) => unreachable!(),
            }
        }
        _ => None,
    }
}
