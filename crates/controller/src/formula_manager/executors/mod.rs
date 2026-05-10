mod input_formula;

use std::collections::HashSet;

pub use input_formula::{add_ast_node, input_ephemeral_formula, input_formula, remove_formula};
use logisheets_base::{BlockId, BlockRange, CubeId, Range, RangeId, SheetId};

use crate::block_manager::schema_manager::schema::BlockCellRole;
use crate::{edit_action::EditPayload, Error};

use super::{ctx::FormulaExecCtx, FormulaManager, Vertex};

pub struct FormulaExecutor {
    pub manager: FormulaManager,
    pub dirty_vertices: HashSet<Vertex>,
    pub dirty_ranges: HashSet<(SheetId, RangeId)>,
    /// Blocks whose structure changed (bind/rebind, row or field added/removed).
    /// These translate into `Vertex::BlockAll(sheet, block)` dirty entries.
    pub dirty_blocks: HashSet<(SheetId, BlockId)>,
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
            dirty_blocks,
            dirty_cubes,
            trigger,
        } = executor;

        if let Some((sheet, range)) = trigger {
            let trigger_vertex = Vertex::Range(sheet, range);
            dirty_vertices.insert(trigger_vertex);

            // A block-cell write must also dirty the virtual node(s) for
            // that block — BlockRef formulas don't have edges into the
            // underlying single-cell range. We always dirty `BlockAll` on
            // top of the more specific node because:
            //   * `BLOCKREFS` (Multi) depends only on BlockAll/BlockKey
            //     (the parser can't know which fields the runtime
            //     `field_condition` will pick), so a field-cell change must
            //     reach it via BlockAll.
            //   * Over-invalidation is fine; the topo sort still only
            //     re-runs formulas that subscribed.
            if let Some(Range::Block(BlockRange::Single(bcid))) = ctx.lookup_range(sheet, range) {
                match ctx.block_cell_role(sheet, &bcid) {
                    BlockCellRole::Field(field_id) => {
                        dirty_vertices.insert(Vertex::Block(sheet, bcid.block_id, field_id));
                        dirty_vertices.insert(Vertex::BlockAll(sheet, bcid.block_id));
                    }
                    BlockCellRole::Key => {
                        dirty_vertices.insert(Vertex::BlockKey(sheet, bcid.block_id));
                        dirty_vertices.insert(Vertex::BlockAll(sheet, bcid.block_id));
                    }
                    BlockCellRole::None => {}
                }
            }
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

        // Structural block changes dirty BlockAll. We don't enumerate Block
        // / BlockKey here because BlockAll already covers any formula that
        // depends on this block.
        for (sheet, block) in dirty_blocks {
            dirty_vertices.insert(Vertex::BlockAll(sheet, block));
        }

        Ok(FormulaExecutor {
            manager,
            dirty_vertices,
            trigger,
            dirty_cubes: Default::default(),
            dirty_ranges: Default::default(),
            dirty_blocks: Default::default(),
        })
    }
}
