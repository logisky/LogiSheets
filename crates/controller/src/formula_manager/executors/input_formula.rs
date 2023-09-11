use super::super::Result;
use logisheets_base::{
    block_affect::BlockAffectTrait,
    errors::BasicError,
    get_active_sheet::GetActiveSheetTrait,
    get_book_name::GetBookNameTrait,
    id_fetcher::{IdFetcherTrait, VertexFetcherTrait},
    index_fetcher::IndexFetcherTrait,
    BlockRange, CellId, ColId, Cube, CubeId, ExtBookId, ExtRef, ExtRefId, FuncId, NameId,
    NormalRange, Range, RangeId, RowId, SheetId, TextId,
};
use logisheets_parser::Parser;
use logisheets_parser::{ast, context::ContextTrait as ParserContextTrait};
use std::collections::HashSet;

use crate::{
    cube_manager::{CubeExecContext, CubeManger},
    ext_ref_manager::ExtRefManager,
    formula_manager::{FormulaExecContext, FormulaManager, Vertex},
    payloads::sheet_process::{FormulaPayload, SheetPayload, SheetProcess},
    range_manager::{RangeExecContext, RangeManager},
};

pub fn input_formula<C>(
    exec_ctx: FormulaExecContext,
    sheet: SheetId,
    row: usize,
    col: usize,
    formula: String,
    ctx: &mut C,
) -> Result<FormulaExecContext>
where
    C: IdFetcherTrait
        + IndexFetcherTrait
        + GetActiveSheetTrait
        + GetBookNameTrait
        + BlockAffectTrait,
{
    let FormulaManager {
        mut graph,
        mut formulas,
        mut range_manager,
        mut cube_manager,
        names,
        mut ext_ref_manager,
    } = exec_ctx.manager;

    let cell_id = ctx.fetch_cell_id(&sheet, row, col).unwrap(); // todo

    let mut parser_context = ParserContext {
        range_manager: &mut range_manager,
        cube_manager: &mut cube_manager,
        ext_ref_manager: &mut ext_ref_manager,
        ctx,
    };

    let range = match cell_id {
        CellId::NormalCell(normal) => Range::Normal(NormalRange::Single(normal)),
        CellId::BlockCell(block) => Range::Block(BlockRange::Single(block)),
    };
    let range_id = parser_context.fetch_range_id(&sheet, &range);
    let this_vertex = Vertex::Range(sheet, range_id);

    let parser = Parser {};
    let ast = parser.parse(&formula, &mut parser_context);
    if ast.is_none() {
        let manager = FormulaManager {
            graph,
            formulas,
            range_manager,
            cube_manager,
            ext_ref_manager,
            names,
        };
        return Ok(FormulaExecContext {
            manager,
            dirty_vertices: exec_ctx.dirty_vertices,
        });
    }
    let ast = ast.unwrap();

    let mut new_formula_deps = HashSet::<Vertex>::new();
    get_all_vertices_from_ast(&ast, &mut new_formula_deps);

    if let Some(old_formula_deps) = graph.clone().get_deps(&this_vertex) {
        old_formula_deps.iter().for_each(|old_dep| {
            graph.remove_dep(&this_vertex, old_dep);
            if graph.get_rdeps(old_dep).map_or(0, |r| r.len()) == 0 {
                match old_dep {
                    Vertex::Range(sheet_id, range_id) => {
                        range_manager.remove_range_id(&sheet_id, &range_id)
                    }
                    Vertex::Cube(cube_id) => cube_manager.remove_cube_id(&cube_id),
                    Vertex::Ext(ext_ref_id) => ext_ref_manager.remove_ext_ref_id(&ext_ref_id),
                    Vertex::Name(_) => {}
                };
            }
        })
    };

    new_formula_deps
        .into_iter()
        .for_each(|new_dep| graph.add_dep(this_vertex.clone(), new_dep));

    formulas.insert((sheet, cell_id), ast);

    let process = SheetProcess {
        sheet_id: sheet,
        payload: SheetPayload::Formula(FormulaPayload { row, col, formula }),
    };

    let RangeExecContext {
        manager: new_range_manager,
        dirty_ranges,
        removed_ranges: _, // No invalid ranges should be generated in InputFormula.
    } = range_manager.execute_sheet_proc(process.clone(), ctx)?;
    let mut dirty_vertices: HashSet<Vertex> = dirty_ranges
        .into_iter()
        .map(|(s, r)| Vertex::Range(s, r))
        .collect();
    dirty_vertices.insert(this_vertex);

    let CubeExecContext {
        manager: new_cube_manager,
        dirty_cubes,
        removed_cubes: _,
    } = cube_manager.execute_sheet_proc(process, ctx);
    dirty_cubes
        .into_iter()
        .map(|c| Vertex::Cube(c))
        .for_each(|v| {
            dirty_vertices.insert(v);
        });

    Ok(FormulaExecContext {
        manager: FormulaManager {
            graph,
            formulas,
            range_manager: new_range_manager,
            cube_manager: new_cube_manager,
            ext_ref_manager,
            names,
        },
        dirty_vertices,
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

struct ParserContext<'a, C> {
    range_manager: &'a mut RangeManager,
    cube_manager: &'a mut CubeManger,
    ext_ref_manager: &'a mut ExtRefManager,
    ctx: &'a mut C,
}

impl<'a, C> GetBookNameTrait for ParserContext<'a, C>
where
    C: IdFetcherTrait + GetActiveSheetTrait + GetBookNameTrait,
{
    fn get_book_name(&self) -> &str {
        self.ctx.get_book_name()
    }
}

impl<'a, C> GetActiveSheetTrait for ParserContext<'a, C>
where
    C: IdFetcherTrait + GetActiveSheetTrait + GetBookNameTrait,
{
    fn get_active_sheet(&self) -> SheetId {
        self.ctx.get_active_sheet()
    }
}

impl<'a, C> IdFetcherTrait for ParserContext<'a, C>
where
    C: IdFetcherTrait + GetActiveSheetTrait + GetBookNameTrait,
{
    fn fetch_row_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
    ) -> std::result::Result<RowId, BasicError> {
        self.ctx.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(
        &self,
        sheet_id: &SheetId,
        col_idx: usize,
    ) -> std::result::Result<ColId, BasicError> {
        self.ctx.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> std::result::Result<CellId, BasicError> {
        self.ctx.fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.ctx.fetch_sheet_id(sheet_name)
    }

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> NameId {
        self.ctx.fetch_name_id(workbook, name)
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId {
        self.ctx.fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> TextId {
        self.ctx.fetch_text_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> FuncId {
        self.ctx.fetch_func_id(func_name)
    }

    fn fetch_norm_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> std::result::Result<logisheets_base::NormalCellId, BasicError> {
        self.ctx.fetch_norm_cell_id(sheet_id, row_idx, col_idx)
    }
}

impl<'a, C> VertexFetcherTrait for ParserContext<'a, C>
where
    C: IdFetcherTrait + GetActiveSheetTrait + GetBookNameTrait,
{
    fn fetch_range_id(&mut self, sheet_id: &SheetId, range: &Range) -> RangeId {
        self.range_manager.get_range_id(sheet_id, range)
    }

    fn fetch_cube_id(&mut self, cube: &Cube) -> CubeId {
        self.cube_manager.get_cube_id(cube)
    }

    fn fetch_ext_ref_id(&mut self, ext_ref: &ExtRef) -> ExtRefId {
        self.ext_ref_manager.get_ext_ref_id(ext_ref)
    }
}

impl<'a, C> ParserContextTrait for ParserContext<'a, C> where
    C: IdFetcherTrait + GetActiveSheetTrait + GetBookNameTrait
{
}
