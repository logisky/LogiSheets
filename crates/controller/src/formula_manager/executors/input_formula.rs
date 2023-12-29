use super::FormulaExecutor;
use logisheets_base::errors::BasicError;
use logisheets_base::{BlockRange, CellId, NormalRange, Range, RangeId, SheetId};
use logisheets_parser::ast;
use logisheets_parser::Parser;
use std::collections::HashSet;

use crate::formula_manager::{ctx::FormulaExecCtx, FormulaManager, Vertex};

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

    let range = match cell_id {
        CellId::NormalCell(normal) => Range::Normal(NormalRange::Single(normal)),
        CellId::BlockCell(block) => Range::Block(BlockRange::Single(block)),
    };
    let range_id = ctx.fetch_range_id(&sheet, &range);
    let this_vertex = Vertex::Range(sheet, range_id);

    let parser = Parser {};
    let ast = parser.parse(&formula, sheet, ctx);
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
            if graph.get_rdeps(old_dep).map_or(0, |r| r.len()) == 0 {
                match old_dep {
                    Vertex::Range(sheet_id, range_id) => ctx.remove_range_id(&sheet_id, &range_id),
                    Vertex::Cube(cube_id) => ctx.remove_cube_id(&cube_id),
                    Vertex::Ext(ext_ref_id) => ctx.remove_ext_ref_id(&ext_ref_id),
                    Vertex::Name(_) => {}
                };
            }
        })
    };

    new_formula_deps
        .into_iter()
        .for_each(|new_dep| graph.add_dep(this_vertex.clone(), new_dep));

    formulas.insert((sheet, cell_id), ast);

    Ok(FormulaExecutor {
        manager: FormulaManager {
            graph,
            formulas,
            names,
        },
        dirty_vertices: executor.dirty_vertices,
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
        },
    }
}
