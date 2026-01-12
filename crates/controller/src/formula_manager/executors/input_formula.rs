use super::FormulaExecutor;
use logisheets_base::errors::BasicError;
use logisheets_base::{
    BlockRange, CellId, EphemeralId, NormalRange, Range, RangeId, RefAbs, SheetId,
};
use logisheets_parser::ast::{self, RangeDisplay};
use logisheets_parser::Parser;
use std::collections::HashSet;

use crate::formula_manager::{ctx::FormulaExecCtx, FormulaManager, Vertex};
use crate::id_manager::{BLOCKREFS_ID, BLOCKREF_ID};

pub fn input_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    row: usize,
    col: usize,
    formula: String,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let cell_id = ctx.fetch_cell_id(&sheet, row, col)?;
    input(executor, sheet, cell_id, formula, None, ctx)
}

pub fn input_ephemeral_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    id: EphemeralId,
    formula: String,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    if let Some((sheet_id, cell_id)) = ctx.get_cell_id_by_shadow_id(&id) {
        let range = match cell_id {
            CellId::NormalCell(normal_cell_id) => {
                Range::Normal(NormalRange::Single(normal_cell_id))
            }
            CellId::BlockCell(block_cell_id) => Range::Block(BlockRange::Single(block_cell_id)),
            CellId::EphemeralCell(_) => unreachable!(),
        };
        let range_id = ctx.fetch_range_id(&sheet_id, &range);
        let reference = ast::CellReference::Mut(RangeDisplay {
            range_id,
            ref_abs: RefAbs::default(),
            sheet_id,
        });
        let node = ast::Node {
            pure: ast::PureNode::Reference(reference),
            bracket: true,
        };
        input(
            executor,
            sheet,
            CellId::EphemeralCell(id),
            formula,
            Some(node),
            ctx,
        )
    } else {
        let cell_id = CellId::EphemeralCell(id);
        input(executor, sheet, cell_id, formula, None, ctx)
    }
}

pub fn remove_formula<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet_idx: usize,
    row: usize,
    col: usize,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let sheet = ctx
        .fetch_sheet_id_by_index(sheet_idx)
        .map_err(|l| BasicError::SheetIdxExceed(l))?;
    let cell_id = ctx.fetch_cell_id(&sheet, row, col)?;
    remove(executor, sheet, cell_id, ctx)
}

fn remove<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet: SheetId,
    cell_id: CellId,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let range = match cell_id {
        CellId::NormalCell(normal) => Range::Normal(NormalRange::Single(normal)),
        CellId::BlockCell(block) => Range::Block(BlockRange::Single(block)),
        CellId::EphemeralCell(v) => Range::Ephemeral(v),
    };
    let range_id = ctx.fetch_range_id(&sheet, &range);
    let this_vertex = Vertex::Range(sheet, range_id);

    let FormulaManager {
        mut graph,
        mut formulas,
        names,
    } = executor.manager;
    if let Some(old_formula_deps) = graph.clone().get_deps(&this_vertex) {
        old_formula_deps.iter().for_each(|old_dep| {
            graph.remove_dep(&this_vertex, old_dep);
        })
    };

    formulas.remove(&(sheet, cell_id));

    Ok(FormulaExecutor {
        manager: FormulaManager {
            graph,
            formulas,
            names,
        },
        dirty_vertices: executor.dirty_vertices,
        dirty_ranges: executor.dirty_ranges,
        dirty_cubes: executor.dirty_cubes,
        dirty_schemas: executor.dirty_schemas,
        trigger: executor.trigger,
    })
}

fn input<C: FormulaExecCtx>(
    executor: FormulaExecutor,
    sheet: SheetId,
    cell_id: CellId,
    formula: String,
    substitute: Option<ast::Node>,
    ctx: &mut C,
) -> Result<FormulaExecutor, BasicError> {
    let range = match cell_id {
        CellId::NormalCell(normal) => Range::Normal(NormalRange::Single(normal)),
        CellId::BlockCell(block) => Range::Block(BlockRange::Single(block)),
        CellId::EphemeralCell(v) => Range::Ephemeral(v),
    };
    let range_id = ctx.fetch_range_id(&sheet, &range);
    let this_vertex = Vertex::Range(sheet, range_id);

    let parser = Parser {};
    let ast = if let Some(node) = substitute {
        parser.parse_with_substitude(&formula, &node, sheet, ctx)
    } else {
        parser.parse(&formula, sheet, ctx)
    };
    if ast.is_none() {
        return Ok(executor);
    }
    let ast = ast.unwrap();

    let mut new_formula_deps = HashSet::<Vertex>::new();
    get_all_vertices_from_ast(&ast, &mut new_formula_deps);

    let FormulaManager {
        mut graph,
        mut formulas,
        names,
    } = executor.manager;

    if let Some(old_formula_deps) = graph.clone().get_deps(&this_vertex) {
        old_formula_deps.iter().for_each(|old_dep| {
            graph.remove_dep(&this_vertex, old_dep);
        })
    };

    new_formula_deps.into_iter().for_each(|new_dep| {
        graph.add_dep(this_vertex.clone(), new_dep.clone());

        let range_deps = ctx.get_range_deps(&new_dep);
        range_deps.into_iter().for_each(|range_dep| {
            graph.add_dep(new_dep.clone(), range_dep);
        });
    });

    formulas.insert((sheet, cell_id), ast.clone());

    Ok(FormulaExecutor {
        manager: FormulaManager {
            graph,
            formulas,
            names,
        },
        dirty_vertices: executor.dirty_vertices,
        dirty_ranges: executor.dirty_ranges,
        dirty_cubes: executor.dirty_cubes,
        dirty_schemas: executor.dirty_schemas,
        trigger: executor.trigger,
    })
}

// This method is only used in loading a file (especially for shared formula).
// So there are somethings different from inputting a formula.
pub fn add_ast_node(
    manager: &mut FormulaManager,
    sheet_id: SheetId,
    cell_id: CellId,
    range_id: RangeId,
    ast: ast::Node,
) {
    let this_vertex = Vertex::Range(sheet_id, range_id);
    let mut new_formula_deps = HashSet::<Vertex>::new();
    get_all_vertices_from_ast(&ast, &mut new_formula_deps);
    manager.formulas.insert((sheet_id, cell_id), ast);

    new_formula_deps
        .into_iter()
        .for_each(|new_dep| manager.graph.add_dep(this_vertex.clone(), new_dep));
}

fn get_all_vertices_from_ast(ast: &ast::Node, vertices: &mut HashSet<Vertex>) {
    match &ast.pure {
        ast::PureNode::Func(func) => {
            func.args
                .iter()
                .for_each(|n| get_all_vertices_from_ast(n, vertices));
            if let ast::Operator::Function(id) = func.op {
                if id == BLOCKREFS_ID || id == BLOCKREF_ID {
                    if let Some(arg0) = func.args.get(0) {
                        if let ast::PureNode::Value(ast::Value::Text(text)) = &arg0.pure {
                            let vertex = Vertex::BlockSchema(text.clone());
                            vertices.insert(vertex);
                        }
                    }
                }
            }
        }
        ast::PureNode::Value(_) => {}
        ast::PureNode::Reference(reference) => match reference {
            ast::CellReference::Mut(r) => {
                let sheet_id = r.sheet_id;
                let range_id = r.range_id;
                let vertex = Vertex::Range(sheet_id, range_id);
                vertices.insert(vertex);
            }
            ast::CellReference::UnMut(c) => {
                let cube_id = c.cube_id;
                let vertex = Vertex::Cube(cube_id);
                vertices.insert(vertex);
            }
            ast::CellReference::Ext(ext_ref) => {
                let ext_ref_id = ext_ref.ext_ref_id;
                let vertex = Vertex::Ext(ext_ref_id);
                vertices.insert(vertex);
            }
            ast::CellReference::Name(name) => {
                let vertex = Vertex::Name(*name);
                vertices.insert(vertex);
            }
            ast::CellReference::RefErr => {}
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_all_vertices_from_ast() {
        // let f = "=B2*(1+A2)";
        let sum = ast::Node {
            pure: ast::PureNode::Func(ast::Func {
                op: ast::Operator::Infix(ast::InfixOperator::Plus),
                args: vec![
                    ast::Node {
                        pure: ast::PureNode::Value(ast::Value::Number(1.0)),
                        bracket: false,
                    },
                    ast::Node {
                        pure: ast::PureNode::Reference(ast::CellReference::Mut(
                            ast::RangeDisplay {
                                sheet_id: 0,
                                range_id: 0,
                                ref_abs: RefAbs::from_addr(false, false),
                            },
                        )),
                        bracket: false,
                    },
                ],
            }),
            bracket: false,
        };
        let ast = ast::Node {
            pure: ast::PureNode::Func(ast::Func {
                op: ast::Operator::Infix(ast::InfixOperator::Multiply),
                args: vec![
                    sum,
                    ast::Node {
                        pure: ast::PureNode::Reference(ast::CellReference::Mut(
                            ast::RangeDisplay {
                                sheet_id: 0,
                                range_id: 1,
                                ref_abs: RefAbs::from_addr(false, false),
                            },
                        )),
                        bracket: false,
                    },
                ],
            }),
            bracket: false,
        };

        let mut vertices = HashSet::<Vertex>::new();
        get_all_vertices_from_ast(&ast, &mut vertices);
        assert_eq!(vertices.len(), 2);
    }
}
