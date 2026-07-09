use std::collections::HashMap;

use super::{cell_positioner::CellPositioner, worksheet::Worksheet};
use crate::{
    CellInfo, Controller,
    controller::{
        display::{
            BlockDataRow, BlockField, BlockInfo, CellCoordinateWithSheet, CellPosition,
            ShadowCellInfo, SheetInfo, TempCellChange, TempStatusDiff, Value as DisplayValue,
        },
        status::Status,
    },
    edit_action::{ActionEffect, PayloadsAction, SheetCellId, StatusCode},
    lock::{Locked, locked_write, new_locked},
};
use crate::{
    edit_action::{EditAction, EphemeralCellInput},
    errors::{Error, Result},
};
use logisheets_base::{
    BlockCellId, BlockId, CellId, ColId, RowId, SheetId, TextId,
    async_func::{AsyncCalcResult, Task},
    errors::BasicError,
};
use logisheets_lexer::lex;
use logisheets_workbook::logisheets::AppData;

const CALC_CONDITION_EPHEMERAL_ID: u64 = 225715;

pub(crate) type CellPositionerDefault = CellPositioner<1000>;

pub struct Workbook {
    controller: Controller,
    cell_positioners: Locked<HashMap<SheetId, Locked<CellPositionerDefault>>>,
}

impl Default for Workbook {
    fn default() -> Self {
        Self {
            controller: Default::default(),
            cell_positioners: new_locked(HashMap::new()),
        }
    }
}

impl Workbook {
    /// Create an empty workbook.
    pub fn new() -> Self {
        Workbook {
            controller: Default::default(),
            cell_positioners: new_locked(HashMap::new()),
        }
    }

    /// Execute the `EditAction`
    pub fn handle_action(&mut self, action: EditAction) -> ActionEffect {
        self.controller.handle_action(action)
    }

    /// Install a `ShadowKind::Validation` shadow formula on every non-empty
    /// cell that is covered by a data-validation rule and doesn't have one yet.
    /// The shadow evaluates the rule to a boolean; the frontend flags cells
    /// whose shadow is `false`. Read-only rules → we never remove shadows here.
    /// Empty cells are intentionally left unshadowed (unflagged).
    ///
    /// Only run once at load (`from_file`): shadows are materialized for the
    /// cells that are non-empty in the loaded file. Cells edited afterwards are
    /// not (re)synced for now.
    fn sync_data_validation_shadows(&mut self) {
        use crate::data_validation_manager::{parse_sqref, translate};
        use crate::edit_action::{EphemeralCellInput, PayloadsAction};
        use crate::sid_assigner::ShadowKind;
        use logisheets_base::CellValue;

        if self.controller.status.data_validation_manager.is_empty() {
            return;
        }

        // Pass 1 (immutable): collect the cells that need a new shadow.
        let mut pending: Vec<(usize, SheetId, CellId, String)> = Vec::new();
        {
            let status = &self.controller.status;
            for (sheet_id, dvs) in status.data_validation_manager.validations.iter() {
                let rules: Vec<(Vec<_>, String)> = dvs
                    .data_validations
                    .iter()
                    .filter_map(|dv| {
                        let f = translate::rule_to_formula(dv)?;
                        Some((parse_sqref(&dv.sqref), f))
                    })
                    .collect();
                if rules.is_empty() {
                    continue;
                }
                let sheet_idx = match status.sheet_info_manager.pos.iter().position(|s| s == sheet_id)
                {
                    Some(i) => i,
                    None => continue,
                };
                let container = match status.container.get_sheet_container(*sheet_id) {
                    Some(c) => c,
                    None => continue,
                };
                for (cell_id, cell) in container.cells.iter() {
                    if matches!(cell.value, CellValue::Blank) {
                        continue;
                    }
                    let nc = match cell_id {
                        CellId::NormalCell(nc) => nc,
                        _ => continue,
                    };
                    if self
                        .controller
                        .sid_assigner
                        .find_shadow_id(*sheet_id, *cell_id, ShadowKind::Validation)
                        .is_some()
                    {
                        continue;
                    }
                    let (row, col) = match status.navigator.fetch_normal_cell_idx(sheet_id, nc) {
                        Ok(x) => x,
                        Err(_) => continue,
                    };
                    if let Some((_, formula)) = rules
                        .iter()
                        .find(|(ranges, _)| ranges.iter().any(|r| r.contains(row, col)))
                    {
                        pending.push((sheet_idx, *sheet_id, *cell_id, formula.clone()));
                    }
                }
            }
        }
        if pending.is_empty() {
            return;
        }

        // Pass 2 (mut): allocate shadow ids, then install formulas.
        let mut payloads = Vec::with_capacity(pending.len());
        for (sheet_idx, sheet_id, cell_id, formula) in pending {
            let sid =
                self.controller
                    .sid_assigner
                    .get_shawdow_id(sheet_id, cell_id, ShadowKind::Validation);
            payloads.push(crate::edit_action::EditPayload::EphemeralCellInput(
                EphemeralCellInput {
                    sheet_idx,
                    id: sid,
                    content: format!("={formula}"),
                },
            ));
        }
        self.controller.handle_action(EditAction::Payloads(PayloadsAction {
            payloads,
            undoable: false,
            init: false,
        }));
    }

    pub fn get_sheet_name_by_idx(&self, idx: usize) -> Result<String> {
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .pos
            .get(idx)
            .ok_or(BasicError::SheetIdxExceed(idx))?;
        let name = self
            .controller
            .status
            .sheet_id_manager
            .get_string(sheet_id)
            .ok_or(BasicError::SheetIdNotFound(*sheet_id))?;
        Ok(name)
    }

    /// Execute the `EditAction` on the temp branch. Subsequent calls accumulate on the same branch
    /// until `commit_temp_status` or `clean_temp_status` is called.
    pub fn handle_action_in_temp_status(&mut self, action: PayloadsAction) -> ActionEffect {
        self.controller.handle_action_in_temp_status(action)
    }

    pub fn commit_temp_status(&mut self) {
        self.controller.commit_temp_status();
    }

    pub fn clean_temp_status(&mut self) {
        self.controller.clean_temp_status();
    }

    pub fn toggle_status(&mut self, _use_temp: bool) {
        // No-op: self.status always reflects the active state (temp or real).
    }

    pub fn batch_get_cell_info_by_id(&self, ids: Vec<SheetCellId>) -> Result<Vec<CellInfo>> {
        let mut result = Vec::new();
        for id in ids {
            let sheet_id = id.sheet_id;
            let worksheet = self.get_sheet_by_id(sheet_id)?;
            let info = worksheet.get_cell_info_by_cell_id(&id.cell_id)?;
            result.push(info);
        }
        Ok(result)
    }

    pub fn batch_get_cell_coordinate_with_sheet_by_id(
        &self,
        ids: Vec<SheetCellId>,
    ) -> Result<Vec<CellCoordinateWithSheet>> {
        let mut result = Vec::new();
        for id in ids {
            let sheet_id = id.sheet_id;
            let worksheet = self.get_sheet_by_id(sheet_id)?;
            let coordinate = worksheet.get_cell_coordinate_by_id(&id.cell_id)?;
            result.push(CellCoordinateWithSheet {
                sheet_idx: self.get_sheet_idx_by_id(sheet_id)?,
                coordinate,
            });
        }
        Ok(result)
    }

    pub fn get_cell_info_by_id(&self, id: SheetCellId) -> Result<CellInfo> {
        let sheet_id = id.sheet_id;
        let worksheet = self.get_sheet_by_id(sheet_id)?;
        worksheet.get_cell_info_by_cell_id(&id.cell_id)
    }

    /// Create a workbook from a .xlsx file.
    pub fn from_file(buf: &[u8], book_name: String) -> Result<Self> {
        let controller = Controller::from_file(book_name, buf)?;
        let mut wb = Workbook {
            controller,
            cell_positioners: new_locked(HashMap::new()),
        };
        // Materialize validation shadows for the loaded, non-empty cells before
        // snapshotting the init status, so the baseline includes them.
        wb.sync_data_validation_shadows();
        wb.controller
            .version_manager
            .set_init_status(wb.controller.status.clone());
        Ok(wb)
    }

    #[inline]
    pub fn get_app_data(&self) -> Vec<AppData> {
        self.controller.app_data.clone()
    }

    #[inline]
    pub fn set_app_data(&mut self, app_data: Vec<AppData>) {
        self.controller.app_data = app_data;
    }

    /// List-type data-validation options for a cell, or `None` if the cell is
    /// not covered by a `list` validation. Inline literal lists come back as
    /// `ListValidation::Inline(values)` ready to use; range / named references
    /// come back as `ListValidation::Reference(raw)` for the caller to resolve
    /// via its own cell reads. Only `list` validations are surfaced — this is
    /// the read path douyoushu uses to infer `enum` inputs.
    pub fn get_cell_list_validation(
        &self,
        sheet_idx: usize,
        row: usize,
        col: usize,
    ) -> Option<crate::data_validation_manager::ListValidation> {
        use crate::data_validation_manager::{list_validation, parse_sqref};
        let sheet_id = self.controller.get_sheet_id_by_idx(sheet_idx)?;
        let dvs = self
            .controller
            .status
            .data_validation_manager
            .get_sheet(sheet_id)?;
        dvs.data_validations.iter().find_map(|dv| {
            let opts = list_validation(dv)?;
            parse_sqref(&dv.sqref)
                .iter()
                .any(|r| r.contains(row, col))
                .then_some(opts)
        })
    }

    #[inline]
    pub fn save(&self) -> Result<Vec<u8>> {
        self.controller.save()
    }

    #[inline]
    pub fn undo(&mut self) -> bool {
        self.controller.undo()
    }

    #[inline]
    pub fn redo(&mut self) -> bool {
        self.controller.redo()
    }

    /// Clear the undo/redo history, keeping the current state as the baseline.
    /// Nothing is reverted; only the history is dropped.
    #[inline]
    pub fn clear_history(&mut self) {
        self.controller.clear_history()
    }

    // ----- Named checkpoints -------------------------------------------
    //
    // Save / delete / list are workbook methods (not payloads) because
    // they don't touch sheet state — they manage the CheckpointManager.
    // Restore goes through the standard payload pipeline as
    // `RestoreCheckpoint` so it lands on the undo stack (user Ctrl-Z
    // reverses an AI restore).

    /// Snapshot the current workbook state under `label`. Overwrites
    /// any existing checkpoint with the same label. Returns the number
    /// of checkpoints currently stored after the save.
    pub fn save_checkpoint(&mut self, label: String, description: Option<String>) -> usize {
        self.controller
            .checkpoint_manager
            .save(label, description, self.controller.status.clone());
        self.controller.checkpoint_manager.len()
    }

    /// Drop a named checkpoint. Returns `true` if it existed.
    pub fn delete_checkpoint(&mut self, label: &str) -> bool {
        self.controller.checkpoint_manager.delete(label)
    }

    /// Enumerate all checkpoints, newest first. Returns just labels
    /// and descriptions — the bulky `Status` snapshot stays inside the
    /// manager.
    pub fn list_checkpoints(&self) -> Vec<crate::checkpoint_manager::CheckpointMeta> {
        self.controller.checkpoint_manager.list()
    }

    #[inline]
    pub fn handle_async_calc_results(
        &mut self,
        tasks: Vec<Task>,
        results: Vec<AsyncCalcResult>,
    ) -> ActionEffect {
        if tasks.len() != results.len() {
            return ActionEffect {
                version: 0,
                async_tasks: vec![],
                status: StatusCode::Err(1),
                value_changed: vec![],
                cell_removed: vec![],
                style_changed: vec![],
                ..Default::default()
            };
        }
        self.controller.handle_async_calc_results(tasks, results)
    }

    #[inline]
    pub fn get_all_sheet_info(&self) -> Vec<SheetInfo> {
        self.controller.get_all_sheet_info()
    }

    #[inline]
    pub fn get_cell_positioner(&self, sheet: SheetId) -> Locked<CellPositionerDefault> {
        let mut cell_positioners = locked_write(&self.cell_positioners);
        let entry = cell_positioners
            .entry(sheet)
            .or_insert_with(|| new_locked(CellPositionerDefault::new()));

        entry.clone()
    }

    pub fn get_block_values(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        row_ids: &[RowId],
        col_ids: &[ColId],
    ) -> Result<Vec<String>> {
        let text_id_fetcher = |id: TextId| {
            self.controller
                .status
                .text_id_manager
                .get_string(&id)
                .unwrap()
        };
        let values = row_ids
            .iter()
            .zip(col_ids.iter())
            .map(|(row_id, col_id)| {
                let cell_id = CellId::BlockCell(BlockCellId {
                    block_id,
                    row: *row_id,
                    col: *col_id,
                });
                let v = self
                    .controller
                    .status
                    .container
                    .get_cell(sheet_id, &cell_id)
                    .map(|c| c.value.to_string(&text_id_fetcher))
                    .unwrap_or_default();
                v
            })
            .collect::<Vec<String>>();
        Ok(values)
    }

    pub fn get_sheet_by_name(&self, name: &str) -> Result<Worksheet> {
        let id = self.controller.get_sheet_id_by_name(name);
        if id.is_none() {
            return Err(BasicError::SheetNameNotFound(name.to_string()).into());
        }
        let sheet_id = id.unwrap();
        self.get_sheet_by_id(sheet_id)
    }

    pub fn get_sheet_idx_by_id(&self, sheet_id: SheetId) -> Result<usize> {
        self.controller
            .status
            .sheet_info_manager
            .get_sheet_idx(&sheet_id)
            .ok_or(BasicError::UnavailableSheetId(sheet_id).into())
    }

    pub fn get_sheet_by_id(&self, sheet_id: SheetId) -> Result<Worksheet> {
        let positioner = self.get_cell_positioner(sheet_id);
        let c = &self.controller;
        Ok(Worksheet {
            sheet_id,
            controller: c,
            positioner,
        })
    }

    pub fn get_sheet_idx_by_name(&self, name: &str) -> Result<usize> {
        let sheet_id = self.controller.get_sheet_id_by_name(name);
        if let Some(id) = sheet_id {
            if let Some(idx) = self.controller.status.sheet_info_manager.get_sheet_idx(&id) {
                Ok(idx)
            } else {
                Err(BasicError::SheetNameNotFound(name.to_string()).into())
            }
        } else {
            Err(BasicError::SheetNameNotFound(name.to_string()).into())
        }
    }

    pub fn get_sheet_by_idx(&self, idx: usize) -> Result<Worksheet> {
        match self.controller.get_sheet_id_by_idx(idx) {
            Some(sheet_id) => Ok(Worksheet {
                sheet_id,
                controller: &self.controller,
                positioner: self.get_cell_positioner(sheet_id),
            }),
            None => Err(Error::UnavailableSheetIdx(idx)),
        }
    }

    pub fn get_sheet_count(&self) -> usize {
        self.controller.status.sheet_info_manager.pos.len()
    }

    /// To see if the formula is valid.
    pub fn check_formula(&self, f: String) -> bool {
        if f.is_empty() {
            return false;
        }
        let f = f.trim();
        if !f.starts_with('=') {
            return false;
        }
        let tokens = lex(&f[1..]);
        tokens.is_some()
    }

    pub fn get_all_block_fields(&self) -> Result<Vec<BlockField>> {
        Ok(self.controller.status.container.get_all_block_fields())
    }

    /// Enumerate blocks across the workbook.
    ///
    /// Scope selection:
    ///   - `sheet_id == Some(id)`     → only that sheet
    ///   - `sheet_idx == Some(idx)`   → resolve to sheet_id, then that sheet
    ///   - both `None`                → every sheet
    ///
    /// If both are set, `sheet_id` wins (more specific).
    pub fn get_all_blocks(
        &self,
        sheet_idx: Option<usize>,
        sheet_id: Option<SheetId>,
    ) -> Result<Vec<BlockInfo>> {
        // Resolve to a list of sheet ids to iterate.
        let sheet_ids: Vec<SheetId> = if let Some(id) = sheet_id {
            vec![id]
        } else if let Some(idx) = sheet_idx {
            match self.controller.get_sheet_id_by_idx(idx) {
                Some(id) => vec![id],
                None => return Err(Error::UnavailableSheetIdx(idx)),
            }
        } else {
            self.controller
                .status
                .navigator
                .sheet_navs
                .keys()
                .copied()
                .collect()
        };

        let mut out: Vec<BlockInfo> = Vec::new();
        for sid in sheet_ids {
            // Snapshot block ids to avoid borrowing the navigator across
            // the get_block_info call (which itself reads the navigator).
            let block_ids: Vec<BlockId> =
                match self.controller.status.navigator.sheet_navs.get(&sid) {
                    Some(nav) => nav.data.blocks.keys().copied().collect(),
                    None => continue,
                };
            let ws = self.get_sheet_by_id(sid)?;
            for bid in block_ids {
                // Skip blocks whose lookup fails (defensive — shouldn't
                // happen with a consistent snapshot, but a missing block
                // shouldn't sink the whole call).
                if let Ok(info) = ws.get_block_info(bid) {
                    out.push(info);
                }
            }
        }
        Ok(out)
    }

    /// Returns the owner and modify policy of a block. Used by the frontend
    /// validate hook to gate writes.
    pub fn get_block_modify_info(
        &self,
        sheet_idx: usize,
        block_id: usize,
    ) -> Result<crate::edit_action::BlockModifyInfo> {
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        let sheet_nav = self.controller.status.navigator.get_sheet_nav(&sheet_id)?;
        let block = sheet_nav
            .data
            .blocks
            .get(&block_id)
            .ok_or(BasicError::BlockIdNotFound(sheet_id, block_id))?;
        Ok(crate::edit_action::BlockModifyInfo {
            owner: block.owner.clone(),
            modify_policy: block.modify_policy.clone(),
        })
    }

    pub fn get_available_block_id(&self, sheet_idx: usize) -> Result<usize> {
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        let block_id = self
            .controller
            .status
            .navigator
            .get_available_block_id(&sheet_id)?;
        Ok(block_id)
    }

    pub fn get_shadow_cell_id(
        &mut self,
        sheet_idx: usize,
        row_idx: usize,
        col_idx: usize,
        kind: crate::sid_assigner::ShadowKind,
    ) -> Result<SheetCellId> {
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&sheet_id, row_idx, col_idx)?;
        let eid = self
            .controller
            .sid_assigner
            .get_shawdow_id(sheet_id, cell_id, kind);
        Ok(SheetCellId {
            sheet_id,
            cell_id: CellId::EphemeralCell(eid),
        })
    }

    pub fn get_shawdow_cell_ids(
        &mut self,
        sheet_idx: usize,
        row_idx: Vec<usize>,
        col_idx: Vec<usize>,
        kind: crate::sid_assigner::ShadowKind,
    ) -> Result<Vec<SheetCellId>> {
        if row_idx.len() != col_idx.len() {
            return Err(BasicError::IncompleteRowColLength(row_idx.len(), col_idx.len()).into());
        }
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx))?;
        row_idx
            .into_iter()
            .zip(col_idx.into_iter())
            .map(|(row, col)| {
                let cell_id = self
                    .controller
                    .status
                    .navigator
                    .fetch_cell_id(&sheet_id, row, col)?;
                let eid = self
                    .controller
                    .sid_assigner
                    .get_shawdow_id(sheet_id, cell_id, kind);
                Ok(SheetCellId {
                    sheet_id,
                    cell_id: CellId::EphemeralCell(eid),
                })
            })
            .collect()
    }

    pub fn get_shadow_info_by_id(&self, shadow_id: u64) -> Result<ShadowCellInfo> {
        let (sheet_id, cell_id) = self
            .controller
            .sid_assigner
            .get_cell_id(shadow_id)
            .ok_or(BasicError::InvalidShadowId(shadow_id))?;
        let (start_position, end_position) = self.get_cell_position_by_id(sheet_id, cell_id)?;
        let value = self
            .get_sheet_by_id(sheet_id)?
            .get_value_by_id(&CellId::EphemeralCell(shadow_id))?;
        Ok(ShadowCellInfo {
            start_position,
            end_position,
            value,
        })
    }

    fn get_cell_position_by_id(
        &self,
        sheet_id: SheetId,
        cell_id: CellId,
    ) -> Result<(CellPosition, CellPosition)> {
        if let CellId::EphemeralCell(_) = cell_id {
            return Err(BasicError::ReferencingEphemeralCell.into());
        }

        let (row, col) = self
            .controller
            .status
            .navigator
            .fetch_cell_idx(&sheet_id, &cell_id)?;
        let ws = self.get_sheet_by_id(sheet_id)?;
        let mut positioner = locked_write(&ws.positioner);
        let x = ws.get_col_start_x(col, &mut *positioner)?;
        let y = ws.get_row_start_y(row, &mut *positioner)?;
        let end_x = ws.get_col_start_x(col + 1, &mut *positioner)?;
        let end_y = ws.get_row_start_y(row + 1, &mut *positioner)?;
        drop(positioner);
        Ok((CellPosition { x, y }, CellPosition { x: end_x, y: end_y }))
    }

    pub fn check_bind_block(
        &mut self,
        sheet_idx: usize,
        block_id: usize,
        row_count: usize,
        col_count: usize,
    ) -> Result<SheetId> {
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .unwrap();

        let block_size = self
            .controller
            .status
            .navigator
            .get_block_size(&sheet_id, &block_id)?;
        if row_count > block_size.0 || col_count > block_size.1 {
            return Err(BasicError::BindBlockSizeMismatch(block_id, row_count, col_count).into());
        }
        Ok(sheet_id)
    }

    /// Resolve a (refName, key, field) triple to the concrete cell in a
    /// block-bound table. Mirrors how the BLOCKREF formula resolves at
    /// evaluation time:
    ///   1. refName → (sheetId, blockId) via the schema manager's ref map
    ///   2. enumerate the block's key cells and find the one whose value
    ///      matches `key`
    ///   3. ask the schema to convert (keyCellId, field) → BlockCellId
    ///
    /// Returns the BlockCell wrapped in a SheetCellId for direct use with
    /// e.g. cell-changed subscriptions or batch reads.
    pub fn get_cell_id_by_block_ref(
        &self,
        ref_name: &str,
        key: &str,
        field: &str,
    ) -> Result<SheetCellId> {
        let status = &self.controller.status;
        let navigator = &status.navigator;
        let bp_fetcher = |sid: &SheetId, bid: &BlockId| navigator.get_block_place(sid, bid).ok();

        let (sheet_id, key_cell_ids) = status
            .block_schema_manager
            .get_all_key_cell_ids(ref_name, &bp_fetcher)
            .ok_or_else(|| {
                BasicError::InvalidFormula(format!("unknown block ref: {}", ref_name))
            })?;

        // Read each key cell's string value and find the one matching `key`.
        let text_fetcher = |id: TextId| status.text_id_manager.get_string(&id).unwrap_or_default();
        let key_string = key.to_string();
        let matched_key_cell = key_cell_ids
            .into_iter()
            .find(|bcid| {
                status
                    .container
                    .get_cell(sheet_id, &CellId::BlockCell(*bcid))
                    .map(|cell| cell.value.to_string(&text_fetcher) == key_string)
                    .unwrap_or(false)
            })
            .ok_or_else(|| {
                BasicError::InvalidFormula(format!(
                    "key '{}' not found in block ref '{}'",
                    key, ref_name
                ))
            })?;

        let field_string = field.to_string();
        let bcid = status
            .block_schema_manager
            .partially_resolve(ref_name, matched_key_cell, &field_string)
            .ok_or_else(|| {
                BasicError::InvalidFormula(format!(
                    "field '{}' not found in block ref '{}'",
                    field, ref_name
                ))
            })?;

        Ok(SheetCellId {
            sheet_id,
            cell_id: CellId::BlockCell(bcid),
        })
    }

    /// Export a block's data as a row-per-key, column-per-field matrix of
    /// values.
    ///
    /// - `ref_name`: the block's bound ref name.
    /// - `key_filter`: when `Some`, keep only rows whose key cell's string
    ///   value is in the list (order follows the block's keys, not the
    ///   filter); when `None`, every key row is returned.
    /// - `field_filter`: when `Some`, keep only these fields, in the schema's
    ///   field order; when `None`, every field is returned.
    ///
    /// Columns follow the same order as `get_all_fields(ref_name)` (filtered),
    /// so the host can pair each column with that field list and the key index
    /// it already holds — no metadata is duplicated here.
    pub fn export_block_data(
        &self,
        ref_name: &str,
        key_filter: Option<Vec<String>>,
        field_filter: Option<Vec<String>>,
    ) -> Result<Vec<BlockDataRow>> {
        let status = &self.controller.status;
        let navigator = &status.navigator;
        let schema = &status.block_schema_manager;
        let bp_fetcher = |sid: &SheetId, bid: &BlockId| navigator.get_block_place(sid, bid).ok();

        let unknown = || BasicError::InvalidFormula(format!("unknown block ref: {}", ref_name));

        // Fields to emit, in schema order, optionally narrowed by the filter.
        let all_fields = schema.get_all_fields(ref_name).ok_or_else(unknown)?;
        let fields: Vec<String> = match &field_filter {
            Some(wanted) => all_fields
                .into_iter()
                .filter(|f| wanted.iter().any(|w| w == f))
                .collect(),
            None => all_fields,
        };

        let (sheet_id, key_cell_ids) = schema
            .get_all_key_cell_ids(ref_name, &bp_fetcher)
            .ok_or_else(unknown)?;

        let text_fetcher = |id: TextId| status.text_id_manager.get_string(&id).unwrap_or_default();
        let key_set: Option<std::collections::HashSet<String>> =
            key_filter.map(|ks| ks.into_iter().collect());

        let mut rows: Vec<BlockDataRow> = vec![];
        for key_cell in key_cell_ids {
            if let Some(set) = &key_set {
                let key_str = status
                    .container
                    .get_cell(sheet_id, &CellId::BlockCell(key_cell))
                    .map(|cell| cell.value.to_string(&text_fetcher))
                    .unwrap_or_default();
                if !set.contains(&key_str) {
                    continue;
                }
            }
            let mut row = Vec::with_capacity(fields.len());
            for field in &fields {
                let value = match schema.partially_resolve(ref_name, key_cell, field) {
                    Some(bcid) => read_display_value(status, sheet_id, &CellId::BlockCell(bcid)),
                    None => DisplayValue::Empty,
                };
                row.push(value);
            }
            rows.push(BlockDataRow { cells: row });
        }
        Ok(rows)
    }

    /// Snapshot of every cell whose value differs between the active
    /// temp branch and the committed (fork) status. Used by the host's
    /// diff layer to drive its overlay without needing JS-side
    /// snapshot/compare logic. Returns an empty diff when no temp
    /// branch is currently active.
    ///
    /// Position (`row`, `col`) reflects the *current* sheet coordinates
    /// in the temp branch — block inserts may have shifted earlier rows
    /// since the fork point. Cells whose `CellId` exists in temp but
    /// not in main (or vice versa) are skipped here; for the moment
    /// they surface as structural changes which a future revision can
    /// add to the diff.
    pub fn get_temp_status_changes(&self) -> Result<TempStatusDiff> {
        let Some(temp) = &self.controller.temp_status else {
            return Ok(TempStatusDiff::default());
        };

        let mut cells: Vec<TempCellChange> = Vec::new();
        for (sheet_id, cell_id) in &temp.accumulated_updated_cells {
            // Resolve to (row, col) via the current navigator (post-
            // temp). If the cell was deleted (no longer addressable),
            // skip it — that surfaces as a structural diff, future
            // work.
            let (row, col) = match self
                .controller
                .status
                .navigator
                .clone()
                .fetch_cell_idx(sheet_id, cell_id)
            {
                Ok(rc) => rc,
                Err(_) => continue,
            };
            let sheet_idx = match self
                .controller
                .status
                .sheet_info_manager
                .get_sheet_idx(sheet_id)
            {
                Some(i) => i,
                None => continue,
            };
            let new_value = read_display_value(&self.controller.status, *sheet_id, cell_id);
            let old_value = read_display_value(&temp.fork_status, *sheet_id, cell_id);
            cells.push(TempCellChange {
                sheet_idx,
                row,
                col,
                old_value,
                new_value,
            });
        }
        Ok(TempStatusDiff { cells })
    }

    pub fn calc_condition(&mut self, sheet_idx: usize, f: String) -> Result<bool> {
        let effect = self.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
            EphemeralCellInput {
                sheet_idx,
                id: CALC_CONDITION_EPHEMERAL_ID,
                content: f.clone(),
            },
        )));
        let sheet_id = self
            .controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .unwrap();
        if let StatusCode::Ok(_) = effect.status {
            let cell = self
                .controller
                .status
                .container
                .get_cell(
                    sheet_id,
                    &CellId::EphemeralCell(CALC_CONDITION_EPHEMERAL_ID),
                )
                .unwrap();
            if cell.value.is_error() {
                Err(BasicError::InvalidFormula(f).into())
            } else {
                Ok(cell.value.bool_value())
            }
        } else {
            Err(BasicError::InvalidFormula(f).into())
        }
    }

    /// Get the worksheet id by its index.
    ///
    /// It is not recommended to use this function because worksheet id is an internal
    /// conception. Use this only when you know what you are doing.
    pub fn get_worksheet_id(&self, sheet_idx: usize) -> Result<SheetId> {
        self.controller
            .status
            .sheet_info_manager
            .get_sheet_id(sheet_idx)
            .ok_or(BasicError::SheetIdxExceed(sheet_idx).into())
    }
}

/// Read a single cell's display value from a specific Status. The temp
/// branch and the fork (main) branch are both `Status` instances — this
/// helper lets `get_temp_status_changes` resolve old/new values without
/// going through `Worksheet` (which is tied to the live status only).
fn read_display_value(status: &Status, sheet_id: SheetId, cell_id: &CellId) -> DisplayValue {
    let Some(cell) = status.container.get_cell(sheet_id, cell_id) else {
        return DisplayValue::Empty;
    };
    match cell.value {
        logisheets_base::CellValue::Blank => DisplayValue::Empty,
        logisheets_base::CellValue::Boolean(b) => DisplayValue::Bool(b),
        logisheets_base::CellValue::Error(ref e) => DisplayValue::Error(e.to_string()),
        logisheets_base::CellValue::String(ref s) => match status.text_id_manager.get_string(s) {
            Some(r) => DisplayValue::Str(r),
            None => DisplayValue::Str(String::new()),
        },
        logisheets_base::CellValue::Number(n) => DisplayValue::Number(n),
        logisheets_base::CellValue::InlineStr(_) => DisplayValue::Empty,
        logisheets_base::CellValue::FormulaStr(ref s) => DisplayValue::Str(s.clone()),
    }
}
