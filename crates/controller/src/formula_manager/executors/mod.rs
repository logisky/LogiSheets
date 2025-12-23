mod input_formula;

use std::collections::HashSet;

pub use input_formula::{add_ast_node, input_ephemeral_formula, input_formula, remove_formula};
use logisheets_base::{CubeId, RangeId, SheetId};

use crate::{edit_action::EditPayload, Error};

use super::{ctx::FormulaExecCtx, FormulaManager, Vertex};

pub struct FormulaExecutor {
    pub manager: FormulaManager,
    pub dirty_vertices: HashSet<Vertex>,
    pub dirty_ranges: HashSet<(SheetId, RangeId)>,
    pub dirty_cubes: HashSet<CubeId>,
    pub trigger: Option<(SheetId, RangeId)>,
}

impl FormulaExecutor {
    pub fn execute<C: FormulaExecCtx>(
        self,
        payload: EditPayload,
        ctx: &mut C,
    ) -> Result<Self, Error> {
        let executor = match payload {
            EditPayload::CellInput(mut cell_input) => {
                if cell_input.content.starts_with("=") {
                    let formula = cell_input.content.split_off(1);
                    input_formula(
                        self,
                        cell_input.sheet_idx,
                        cell_input.row,
                        cell_input.col,
                        formula,
                        ctx,
                    )
                } else {
                    Ok(self)
                }
            }
            EditPayload::EphemeralCellInput(mut ephemeral_cell_input) => {
                let formula = ephemeral_cell_input.content.split_off(1);
                input_ephemeral_formula(
                    self,
                    ephemeral_cell_input.sheet_idx,
                    ephemeral_cell_input.id,
                    formula,
                    ctx,
                )
            }
            EditPayload::CellClear(p) => remove_formula(self, p.sheet_idx, p.row, p.col, ctx),
            _ => Ok(self),
        }?;
        let FormulaExecutor {
            mut manager,
            mut dirty_vertices,
            dirty_ranges,
            dirty_cubes,
            trigger,
        } = executor;

        if let Some((sheet, range)) = trigger {
            let trigger_vertex = Vertex::Range(sheet, range);
            dirty_vertices.insert(trigger_vertex);
        }

        dirty_ranges
            .into_iter()
            .map(|(s, r)| Vertex::Range(s, r))
            .for_each(|v| {
                if let Some((sheet, range)) = trigger {
                    let trigger_vertex = Vertex::Range(sheet, range);
                    manager.graph.add_dep(v, trigger_vertex);
                } else {
                    dirty_vertices.insert(v);
                }
            });
        dirty_cubes
            .into_iter()
            .map(|r| Vertex::Cube(r))
            .for_each(|v| {
                if let Some((sheet, range)) = trigger {
                    let trigger_vertex = Vertex::Range(sheet, range);
                    manager.graph.add_dep(v, trigger_vertex);
                } else {
                    dirty_vertices.insert(v);
                }
            });

        Ok(FormulaExecutor {
            manager,
            dirty_vertices,
            trigger,
            dirty_cubes: Default::default(),
            dirty_ranges: Default::default(),
        })
    }
}
