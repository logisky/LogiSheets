use super::ast2vertex::delete_cell_in_ast;
use super::base::{AffectResult, ExecuteResult};
use crate::vertex_manager::executors::ast2vertex::{
    delete_sheet_range_in_ast, update_sheet_range_in_ast,
};
use crate::vertex_manager::status::Status;
use crate::vertex_manager::vertex::{FormulaId, SheetRangeVertex, StsRangeVertex, Vertex};
use controller_base::{CellId, SheetId};
use im::HashSet;

pub fn delete_and_get_new(
    range_start: usize,
    range_end: usize,
    delete_start: usize,
    delete_end: usize,
) -> Option<(usize, usize)> {
    if delete_start <= range_start && delete_end <= range_end && delete_end >= range_start {
        // In this case, some top cells deleted and the bottom ones move upwards.
        let deleted_cnt = delete_end - range_start + 1;
        Some((delete_end + 1 - deleted_cnt, range_end - deleted_cnt))
    } else if delete_start > range_start && delete_start <= range_end && delete_end >= range_end {
        Some((range_start, delete_start - 1))
    } else {
        None
    }
}

// Without considering the effect by sheet range vertex or sheet to sheet range vertex.
pub fn delete_cells(prev: ExecuteResult, cells: Vec<FormulaId>) -> ExecuteResult {
    let ExecuteResult {
        status,
        dirty_nodes,
        calc_rdeps,
    } = prev;
    let (status, dirty_nodes) =
        cells
            .into_iter()
            .fold((status, dirty_nodes), |(s, d), (sheet_id, cell_id)| {
                let new_status = erase_deps(s, sheet_id, cell_id);
                let new_status = delete_rdeps_cell(new_status, sheet_id, cell_id);
                let new_dirty = d.update((sheet_id, cell_id));
                (new_status, new_dirty)
            });
    ExecuteResult {
        status,
        dirty_nodes,
        calc_rdeps,
    }
}

pub fn delete_rdeps_cell(status: Status, sheet_id: SheetId, cell_id: CellId) -> Status {
    let formula_id = (sheet_id, cell_id);
    let vertex = Vertex::Cell(formula_id);
    let rdeps = status.graph.get_rdeps(&vertex);
    if rdeps.is_none() {
        return status;
    }
    let formulas = status.formulas;
    let rdeps = rdeps.unwrap();
    let new_formulas = rdeps.iter().fold(formulas, |prev, rdep| match rdep {
        Vertex::Cell(fid) => {
            if let Some(ast) = prev.get(fid) {
                let new_ast = delete_cell_in_ast(ast.clone(), sheet_id, cell_id);
                prev.update(fid.clone(), new_ast)
            } else {
                prev
            }
        }
        _ => prev,
    });
    Status {
        graph: status.graph,
        formulas: new_formulas,
        names: status.names,
        range_vertices: status.range_vertices,
        sts_vertices: status.sts_vertices,
    }
}

pub fn erase_deps(status: Status, sheet_id: SheetId, cell_id: CellId) -> Status {
    let formula_id = (sheet_id, cell_id);
    let vertex = Vertex::Cell(formula_id);
    let deps = status.graph.get_deps(&vertex);
    if deps.is_none() {
        return status;
    }
    let to_remove_deps = deps.unwrap().iter().filter(|e| {
        if let Some(rdeps) = status.graph.get_rdeps(e) {
            rdeps.len() == 1 && {
                match e {
                    Vertex::SheetRange(_) => true,
                    Vertex::StsRange(_) => true,
                    _ => false,
                }
            }
        } else {
            false
        }
    });
    let (new_sheet_ranges, new_sts_ranges) = to_remove_deps.fold(
        (status.range_vertices.clone(), status.sts_vertices.clone()),
        |(sr, sts), v| match v {
            Vertex::SheetRange(s) => {
                if let Some(curr) = sr.get(&sheet_id) {
                    let new_sr = curr.clone().without(s);
                    (sr.update(sheet_id, new_sr), sts)
                } else {
                    (sr, sts)
                }
            }
            Vertex::StsRange(s) => (sr, sts.without(s)),
            _ => (sr, sts),
        },
    );
    Status {
        graph: status.graph.erase_vertex(&vertex),
        formulas: status.formulas.without(&(sheet_id, cell_id)),
        names: status.names,
        range_vertices: new_sheet_ranges,
        sts_vertices: new_sts_ranges,
    }
}

pub fn handle_sts_affect_result(
    prev: ExecuteResult,
    v: &StsRangeVertex,
    affect_result: AffectResult,
    formula: Option<FormulaId>,
) -> ExecuteResult {
    match affect_result {
        AffectResult::DirtyOnly => {
            let vertex = Vertex::StsRange(v.clone());
            let rdeps = prev.status.graph.get_rdeps(&vertex);
            if rdeps.is_none() {
                return prev;
            }
            let rdeps = rdeps.unwrap().clone();
            let (dirty_nodes, calc_rdeps) = {
                let nodes = rdeps
                    .into_iter()
                    .fold(HashSet::new(), |p, node| match node {
                        Vertex::Cell(f) => p.update(f),
                        Vertex::SheetRange(_) => p,
                        Vertex::StsRange(_) => p,
                        Vertex::External => p,
                        Vertex::Name(_) => p,
                    });
                if let Some(fid) = formula {
                    let init = prev.calc_rdeps;
                    let calc_rdeps = nodes.into_iter().fold(init, |p, d| {
                        let new_rdeps = p.get(&fid).map_or(HashSet::new(), |r| r.clone()).update(d);
                        p.update(fid, new_rdeps)
                    });
                    (prev.dirty_nodes, calc_rdeps)
                } else {
                    (nodes, prev.calc_rdeps)
                }
            };
            ExecuteResult {
                status: prev.status,
                dirty_nodes,
                calc_rdeps,
            }
        }
        AffectResult::Removed => unreachable!(),
        AffectResult::UpdateWith(_) => unreachable!(),
        AffectResult::None => prev,
    }
}

pub fn handle_sheet_range_affect_result(
    prev: ExecuteResult,
    v: &SheetRangeVertex,
    affect_result: AffectResult,
    formula: Option<FormulaId>,
) -> ExecuteResult {
    match affect_result {
        AffectResult::DirtyOnly => {
            let vertex = Vertex::SheetRange(v.clone());
            let rdeps = prev.status.graph.get_rdeps(&vertex);
            if rdeps.is_none() {
                return prev;
            }
            let rdeps = rdeps.unwrap().clone();
            let (dirty_nodes, calc_rdeps) = {
                let nodes = rdeps
                    .into_iter()
                    .fold(HashSet::new(), |p, node| match node {
                        Vertex::Cell(f) => p.update(f),
                        Vertex::SheetRange(_) => p,
                        Vertex::StsRange(_) => p,
                        Vertex::External => p,
                        Vertex::Name(_) => p,
                    });
                if let Some(fid) = formula {
                    let init = prev.calc_rdeps;
                    let calc_rdeps = nodes.into_iter().fold(init, |p, d| {
                        let new_rdeps = p.get(&fid).map_or(HashSet::new(), |r| r.clone()).update(d);
                        p.update(fid, new_rdeps)
                    });
                    (prev.dirty_nodes, calc_rdeps)
                } else {
                    (nodes, prev.calc_rdeps)
                }
            };
            ExecuteResult {
                status: prev.status,
                dirty_nodes,
                calc_rdeps,
            }
        }
        AffectResult::Removed => {
            let vertex = Vertex::SheetRange(v.clone());
            let rdeps = prev
                .status
                .graph
                .get_rdeps(&vertex)
                .map_or(HashSet::new(), |r| r.clone());
            let mut new_dirty_nodes =
                rdeps
                    .into_iter()
                    .fold(HashSet::new(), |p, node| match node {
                        Vertex::Cell(f) => p.update(f),
                        Vertex::SheetRange(_) => p,
                        Vertex::StsRange(_) => p,
                        Vertex::External => p,
                        Vertex::Name(_) => p,
                    });
            let mut new_formulas = prev.status.formulas;
            new_dirty_nodes.iter().for_each(|d| {
                let formula = new_formulas.get(d);
                if formula.is_none() {
                    return;
                }
                let formula = formula.unwrap().clone();
                let new_formula = delete_sheet_range_in_ast(formula, v);
                new_formulas.insert(d.clone(), new_formula);
            });
            new_dirty_nodes.extend(prev.dirty_nodes);
            let new_graph = prev.status.graph.delete_vertex(&vertex);
            let new_sheet_ranges = {
                let mut result = prev.status.range_vertices;
                result
                    .get_mut(&v.sheet_id)
                    .and_then(|curr| Some(curr.without(v)));
                result
            };
            let new_status = Status {
                graph: new_graph,
                formulas: new_formulas,
                names: prev.status.names,
                range_vertices: new_sheet_ranges,
                sts_vertices: prev.status.sts_vertices,
            };
            ExecuteResult {
                status: new_status,
                dirty_nodes: new_dirty_nodes,
                calc_rdeps: prev.calc_rdeps,
            }
        }
        AffectResult::UpdateWith(with) => {
            let vertex = Vertex::SheetRange(v.clone());
            let rdeps = prev
                .status
                .graph
                .get_rdeps(&vertex)
                .map_or(HashSet::new(), |r| r.clone());
            let mut new_dirty_nodes =
                rdeps
                    .into_iter()
                    .fold(HashSet::new(), |p, node| match node {
                        Vertex::Cell(f) => p.update(f),
                        Vertex::SheetRange(_) => p,
                        Vertex::StsRange(_) => p,
                        Vertex::External => p,
                        Vertex::Name(_) => p,
                    });
            let mut new_formulas = prev.status.formulas;
            new_dirty_nodes.iter().for_each(|d| {
                let formula = new_formulas.get(d);
                if formula.is_none() {
                    return;
                }
                let formula = formula.unwrap().clone();
                let new_formula = update_sheet_range_in_ast(formula, v, &with);
                new_formulas.insert(d.clone(), new_formula);
            });
            new_dirty_nodes.extend(prev.dirty_nodes);
            let new_graph = prev.status.graph.merge_vertex(&v, &with);
            let new_sheet_ranges = {
                let mut result = prev.status.range_vertices;
                result
                    .get_mut(&v.sheet_id)
                    .and_then(|curr| Some(curr.without(v).update(with)));
                result
            };
            let new_status = Status {
                graph: new_graph,
                formulas: new_formulas,
                names: prev.status.names,
                range_vertices: new_sheet_ranges,
                sts_vertices: prev.status.sts_vertices,
            };
            ExecuteResult {
                status: new_status,
                dirty_nodes: new_dirty_nodes,
                calc_rdeps: prev.calc_rdeps,
            }
        }
        AffectResult::None => prev,
    }
}
