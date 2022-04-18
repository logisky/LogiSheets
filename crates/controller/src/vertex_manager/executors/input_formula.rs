use crate::vertex_manager::executors::utils::handle_sheet_range_affect_result;
use crate::vertex_manager::status::Status;
use crate::vertex_manager::vertex::{MutReferenceVertex, SheetRangeVertex, StsRangeVertex, Vertex};

use super::super::context::ContextTrait;
use super::ast2vertex::find_vertices;
use super::base::{AffectResult, ExecuteResult, SubPayload};
use super::utils::{erase_deps, handle_sts_affect_result};
use im::HashSet;
use logisheets_base::{CellId, SheetId};
use logisheets_parser::{ast, Parser};

#[derive(Debug)]
pub struct InputFormula {
    pub sheet_id: SheetId,
    pub row: usize,
    pub col: usize,
    pub formula: String,
}

impl SubPayload for InputFormula {
    fn affect_sheet_range<T>(&self, sr: &SheetRangeVertex, ctx: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        affect_sheet_range(sr, self.sheet_id, self.row, self.col, ctx)
    }

    fn affect_sts<T>(&self, _: &StsRangeVertex, _: &mut T) -> AffectResult
    where
        T: ContextTrait,
    {
        // FIX here.
        AffectResult::DirtyOnly
    }

    fn exec<T>(self, prev: ExecuteResult, context: &mut T) -> ExecuteResult
    where
        T: ContextTrait,
    {
        let cell_id = context
            .fetch_cell_id(self.sheet_id, self.row, self.col)
            .unwrap();
        let sheet_ranges = prev
            .status
            .range_vertices
            .get(&self.sheet_id)
            .map_or(HashSet::new(), |r| r.clone());
        let res = sheet_ranges.iter().fold(prev, |p, sr| {
            let affect_result = self.affect_sheet_range(sr, context);
            handle_sheet_range_affect_result(p, sr, affect_result, Some((self.sheet_id, cell_id)))
        });
        let sts = res.status.sts_vertices.clone();
        let res = sts.iter().fold(res, |p, s| {
            let affect_result = self.affect_sts(s, context);
            handle_sts_affect_result(p, s, affect_result, Some((self.sheet_id, cell_id)))
        });
        input_formula(res, self.sheet_id, cell_id, &self.formula, context)
    }
}

fn input_formula<T>(
    prev: ExecuteResult,
    sheet_id: SheetId,
    cell_id: CellId,
    f: &str,
    context: &mut T,
) -> ExecuteResult
where
    T: ContextTrait,
{
    let parser = Parser {};
    let ast = parser.parse(f, context);
    if ast.is_none() {
        return prev;
    }
    let ExecuteResult {
        status,
        mut dirty_nodes,
        calc_rdeps,
    } = prev;
    let ast = ast.unwrap();
    let status = add_ast_node(status, sheet_id, cell_id, ast);
    dirty_nodes.insert((sheet_id, cell_id));
    ExecuteResult {
        status,
        dirty_nodes,
        calc_rdeps,
    }
}

pub fn affect_sheet_range<T>(
    sr: &SheetRangeVertex,
    sheet_id: SheetId,
    row: usize,
    col: usize,
    ctx: &mut T,
) -> AffectResult
where
    T: ContextTrait,
{
    if sr.sheet_id != sheet_id {
        return AffectResult::None;
    }
    match &sr.reference {
        MutReferenceVertex::ColRange(cr) => {
            let start_idx = ctx.fetch_col_index(sheet_id, cr.start).unwrap();
            let end_idx = ctx.fetch_col_index(sheet_id, cr.start).unwrap();
            if start_idx >= col && end_idx <= col {
                AffectResult::DirtyOnly
            } else {
                AffectResult::None
            }
        }
        MutReferenceVertex::RowRange(rr) => {
            let start_idx = ctx.fetch_row_index(sheet_id, rr.start).unwrap();
            let end_idx = ctx.fetch_row_index(sheet_id, rr.end).unwrap();
            if start_idx >= row && end_idx <= col {
                AffectResult::DirtyOnly
            } else {
                AffectResult::None
            }
        }
        MutReferenceVertex::AddrRange(ar) => {
            let (start_row, start_col) = ctx.fetch_cell_index(sheet_id, &ar.start).unwrap();
            let (end_row, end_col) = ctx.fetch_cell_index(sheet_id, &ar.end).unwrap();
            if row >= start_row && row <= end_row && col >= start_col && col <= end_col {
                AffectResult::DirtyOnly
            } else {
                AffectResult::None
            }
        }
    }
}

pub fn add_ast_node(status: Status, sheet_id: SheetId, cell_id: CellId, node: ast::Node) -> Status {
    let deps = find_vertices(&node);
    let status = erase_deps(status, sheet_id, cell_id);
    let status = add_deps_and_ranges(status, sheet_id, cell_id, deps);
    let status = add_formula(status, sheet_id, cell_id, node);
    status
}

fn add_deps_and_ranges(
    status: Status,
    sheet_id: SheetId,
    cell_id: CellId,
    deps: HashSet<Vertex>,
) -> Status {
    let v = Vertex::Cell((sheet_id, cell_id));
    let status = deps.into_iter().fold(status, |p, dep| {
        let Status {
            graph,
            formulas,
            names,
            mut range_vertices,
            mut sts_vertices,
        } = p;
        let graph = graph.add_dep(v.clone(), dep.clone());
        match dep {
            Vertex::Cell(_) => {}
            Vertex::SheetRange(srv) => {
                let set = range_vertices.get_mut(&sheet_id);
                if let Some(set) = set {
                    set.insert(srv);
                } else {
                    let mut set = HashSet::new();
                    set.insert(srv);
                    range_vertices.insert(sheet_id, set);
                }
            }
            Vertex::StsRange(sts) => {
                sts_vertices.insert(sts);
            }
            Vertex::External => {}
            Vertex::Name(_) => {}
        };
        Status {
            graph,
            formulas,
            names,
            range_vertices,
            sts_vertices,
        }
    });
    status
}

fn add_formula(status: Status, sheet_id: SheetId, cell_id: CellId, ast: ast::Node) -> Status {
    let mut res = status;
    res.formulas.insert((sheet_id, cell_id), ast);
    res
}
