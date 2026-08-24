use logisheets_base::{BlockRange, CellId, NormalRange, Range, SheetId, id_fetcher::IdFetcherTrait};
use logisheets_parser::{Parser, ast};

use crate::{connectors::FormulaConnector, formula_manager::FormulaManager};

/// The single-cell `Range` addressing `cid`.
///
/// A cell inside a block is addressed by `BlockRange`, never `NormalRange` —
/// its identity is (block, row id, col id), not a sheet coordinate. Registering
/// a formula under the wrong range kind means the formula manager never
/// associates it with the cell, so this has to match what the runtime
/// formula-input path builds (see `formula_manager::executors::input_formula`).
///
/// `None` for ephemeral cells, which no file can contain.
fn single_cell_range(cid: CellId) -> Option<Range> {
    match cid {
        CellId::NormalCell(c) => Some(Range::Normal(NormalRange::Single(c))),
        CellId::BlockCell(b) => Some(Range::Block(BlockRange::Single(b))),
        CellId::EphemeralCell(_) => None,
    }
}

pub fn load_normal_formula<'a, 'b>(
    formula_manager: &'b mut FormulaManager,
    sheet_id: SheetId,
    row: usize,
    col: usize,
    f: &str,
    connector: &'a mut FormulaConnector<'a>,
) {
    let cid = connector.fetch_cell_id(&sheet_id, row, col).unwrap();
    // Blocks are registered before sheet data, so a cell covered by one resolves
    // to a BlockCell here. This used to match only NormalCell and drop the rest,
    // which silently discarded every formula stored inside a block: the cached
    // <v> still loaded, so the workbook looked intact while the cell had quietly
    // stopped being a formula.
    let Some(range) = single_cell_range(cid) else {
        return;
    };
    let range_id = connector.range_manager.get_range_id(&sheet_id, &range);

    let Some(ast_node) = parse_formula(sheet_id, connector, f) else {
        return;
    };

    formula_manager.add_ast_node(sheet_id, cid, range_id, ast_node)
}

/// `None` when the formula cannot be read.
///
/// A file can hold a formula this parser does not accept — a function we have
/// not implemented, a dialect quirk, plain corruption — and that used to end the
/// load for the entire workbook. The cell's cached `<v>` is already in place by
/// the time this runs, so skipping the registration leaves the value the file
/// shipped, visible and wrong-if-stale, instead of no file at all.
fn parse_formula<'a: 'c, 'b, 'c>(
    sheet_id: SheetId,
    connector: &'c mut FormulaConnector<'a>,
    f: &str,
) -> Option<ast::Node> {
    let parser = Parser {};
    parser.parse(f, sheet_id, connector)
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
    let Some(master_ast) = parse_formula(sheet_id, connector, master_formula) else {
        return;
    };
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
            // Same block-cell case as load_normal_formula — and this arm used to
            // be `unreachable!()`, so a shared formula whose range covered a
            // block cell panicked the whole load rather than losing one formula.
            let Some(range) = single_cell_range(cid) else {
                continue;
            };
            let range_id = connector.range_manager.get_range_id(&sheet_id, &range);
            formula_manager.add_ast_node(sheet_id, cid, range_id, n)
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
        // Literals, scalar or matrix: nothing inside can move.
        ast::PureNode::Value(_) | ast::PureNode::ArrayConstant(_) => {}
        ast::PureNode::Reference(cell_ref) => {
            shift_cell_reference(cell_ref, sheet_id, row_shift, col_shift, connector);
        }
        ast::PureNode::BlockRef(node) => {
            // Shared formulas can hold a BlockRef when the source cell does;
            // shift the inner runtime expressions (key / conditions) but
            // leave the resolved sheet/block/field ids alone — those are
            // intentionally position-independent.
            match node {
                ast::BlockRefNode::Single { key, .. } => {
                    shift_pure_node(
                        formula_manager,
                        &mut key.pure,
                        sheet_id,
                        row_shift,
                        col_shift,
                        connector,
                    );
                }
                ast::BlockRefNode::Multi {
                    key_condition,
                    field_condition,
                    ..
                } => {
                    shift_pure_node(
                        formula_manager,
                        &mut key_condition.pure,
                        sheet_id,
                        row_shift,
                        col_shift,
                        connector,
                    );
                    shift_pure_node(
                        formula_manager,
                        &mut field_condition.pure,
                        sheet_id,
                        row_shift,
                        col_shift,
                        connector,
                    );
                }
            }
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
