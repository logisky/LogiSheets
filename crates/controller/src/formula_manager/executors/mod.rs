mod input_formula;

use std::collections::HashSet;

pub use input_formula::{
    add_ast_node, input_block_cell_shadow_template, input_block_cell_template, input_block_formula,
    input_ephemeral_formula, input_formula, rebuild_range_deps, remove_ephemeral_formula,
    remove_formula,
};
use logisheets_base::{BlockId, BlockRange, CubeId, Range, RangeId, SheetId, errors::BasicError};

use crate::block_manager::schema_manager::schema::BlockCellRole;
use crate::{Error, edit_action::EditPayload};

use super::{FormulaManager, Vertex, ctx::FormulaExecCtx};

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
                    // Plain value overwriting whatever was here. If the
                    // cell previously held a formula, drop it — otherwise
                    // the next recalc re-evaluates the stale formula and
                    // overwrites the value the user just typed, making
                    // numeric/text input over a formula cell appear to
                    // silently do nothing.
                    let sheet = ctx
                        .fetch_sheet_id_by_index(cell_input.sheet_idx)
                        .map_err(|l| BasicError::SheetIdxExceed(l))?;
                    match ctx.fetch_cell_id(&sheet, cell_input.row, cell_input.col) {
                        Ok(cell_id) if self.manager.formulas.contains_key(&(sheet, cell_id)) => {
                            remove_formula(
                                self,
                                cell_input.sheet_idx,
                                cell_input.row,
                                cell_input.col,
                                ctx,
                            )
                        }
                        _ => Ok(self),
                    }
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
            EditPayload::EphemeralCellRemove(p) => {
                remove_ephemeral_formula(self, p.sheet_idx, p.id, ctx)
            }
            EditPayload::BlockInput(p) => {
                // If the player wrote a literal formula (`=…`) into this
                // block cell, register it directly. This is the
                // per-cell escape hatch from field-level value-formula
                // templates: when only a few rows of a column need a
                // formula and the rest are plain values, you don't have
                // to fold every row's logic into a single templated
                // expression — just blockInput `=…` on the cells that
                // need it.
                //
                // Otherwise (no `=` prefix), fall through to the
                // templated-field path: if the cell sits in a field
                // with a schema-level valueFormula, that template is
                // materialized; non-templated cells are a no-op here
                // (the container path handles them).
                if let Some(formula) = p.input.strip_prefix('=') {
                    input_block_formula(
                        self,
                        p.sheet_idx,
                        p.block_id,
                        p.row,
                        p.col,
                        formula.to_string(),
                        ctx,
                    )
                } else {
                    input_block_cell_template(self, p.sheet_idx, p.block_id, p.row, p.col, ctx)
                }
            }
            EditPayload::InsertRowsInBlock(p) => {
                // Newly inserted rows start blank. For each (new row × field)
                // we materialize three engine-managed templates:
                //   1. value_formula        → written as the cell's main
                //                              formula
                //   2. validation_formula   → installed on the cell's
                //                              ShadowKind::Validation shadow
                //                              (drives the red-marker UX)
                //   3. editability_formula  → installed on the cell's
                //                              ShadowKind::UserEditable
                //                              shadow (drives the host
                //                              permission gate)
                //
                // Free-form cells (no template) are no-ops inside each
                // helper so the loop stays simple. Block size at this
                // point reflects the post-insert state — navigator runs
                // before formula_manager.
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (_, col_cnt) = ctx
                    .get_block_size(sheet_id, p.block_id)
                    .map_err(|e: BasicError| -> Error { e.into() })?;
                let mut exec = self;
                for r in p.start..(p.start + p.cnt as usize) {
                    for c in 0..col_cnt {
                        exec = input_block_cell_template(exec, p.sheet_idx, p.block_id, r, c, ctx)?;
                        exec = input_block_cell_shadow_template(
                            exec,
                            p.sheet_idx,
                            p.block_id,
                            r,
                            c,
                            crate::sid_assigner::ShadowKind::Validation,
                            ctx,
                        )?;
                        exec = input_block_cell_shadow_template(
                            exec,
                            p.sheet_idx,
                            p.block_id,
                            r,
                            c,
                            crate::sid_assigner::ShadowKind::UserEditable,
                            ctx,
                        )?;
                    }
                }
                Ok(exec)
            }
            EditPayload::UpsertFieldFormulas(p) => {
                // The schema_manager executor has already swapped in the
                // new per-field rules. Re-walk every (row × col) and
                // re-materialize all three template kinds — that way a
                // template change (or clear) propagates uniformly to
                // every existing row. Free-form / template-absent paths
                // no-op inside the helpers.
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (row_cnt, col_cnt) = ctx
                    .get_block_size(sheet_id, p.block_id)
                    .map_err(|e: BasicError| -> Error { e.into() })?;
                let mut exec = self;
                for r in 0..row_cnt {
                    for c in 0..col_cnt {
                        exec = input_block_cell_template(exec, p.sheet_idx, p.block_id, r, c, ctx)?;
                        exec = input_block_cell_shadow_template(
                            exec,
                            p.sheet_idx,
                            p.block_id,
                            r,
                            c,
                            crate::sid_assigner::ShadowKind::Validation,
                            ctx,
                        )?;
                        exec = input_block_cell_shadow_template(
                            exec,
                            p.sheet_idx,
                            p.block_id,
                            r,
                            c,
                            crate::sid_assigner::ShadowKind::UserEditable,
                            ctx,
                        )?;
                    }
                }
                Ok(exec)
            }
            EditPayload::BindFormSchema(p) => {
                // The bind itself happens in the schema_manager
                // executor (earlier in the pass order). By the time we
                // land here the schema is in place AND the block's rows
                // already exist (from a prior CreateBlock). For each
                // (row × col) install value / validation / editability
                // templates declared on the schema; absent templates
                // no-op.
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let (row_cnt, col_cnt) = ctx
                    .get_block_size(sheet_id, p.block_id)
                    .map_err(|e: BasicError| -> Error { e.into() })?;
                let mut exec = self;
                for r in 0..row_cnt {
                    for c in 0..col_cnt {
                        exec = input_block_cell_template(exec, p.sheet_idx, p.block_id, r, c, ctx)?;
                        exec = input_block_cell_shadow_template(
                            exec,
                            p.sheet_idx,
                            p.block_id,
                            r,
                            c,
                            crate::sid_assigner::ShadowKind::Validation,
                            ctx,
                        )?;
                        exec = input_block_cell_shadow_template(
                            exec,
                            p.sheet_idx,
                            p.block_id,
                            r,
                            c,
                            crate::sid_assigner::ShadowKind::UserEditable,
                            ctx,
                        )?;
                    }
                }
                Ok(exec)
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
