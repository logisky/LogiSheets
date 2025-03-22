mod input_formula;

use std::collections::HashSet;

use input_formula::input_ephemeral_formula;
pub use input_formula::{add_ast_node, input_formula};

use crate::{edit_action::EditPayload, Error};

use super::{ctx::FormulaExecCtx, FormulaManager, Vertex};

pub struct FormulaExecutor {
    pub manager: FormulaManager,
    pub dirty_vertices: HashSet<Vertex>,
}

impl FormulaExecutor {
    pub fn execute<C: FormulaExecCtx>(
        self,
        payload: EditPayload,
        ctx: &mut C,
    ) -> Result<Self, Error> {
        let mut executor = match payload {
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
            _ => Ok(self),
        }?;
        ctx.get_dirty_range_ids()
            .into_iter()
            .map(|(s, r)| Vertex::Range(s, r))
            .for_each(|v| {
                executor.dirty_vertices.insert(v);
            });
        ctx.get_dirty_cube_ids()
            .into_iter()
            .map(|c| Vertex::Cube(c))
            .for_each(|v| {
                executor.dirty_vertices.insert(v);
            });
        Ok(executor)
    }
}
