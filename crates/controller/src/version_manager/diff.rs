use std::collections::{HashMap, HashSet};

use logisheets_base::{errors::BasicError, BlockId, CellId, ColId, RowId, SheetId};

use crate::{
    controller::status::Status,
    edit_action::{EditPayload, PayloadsAction},
    Error,
};

use super::ctx::{VersionExecCtx, VersionExecCtxImpl};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Diff {
    CellValue(CellId),
    CellStyle(CellId),
    RowInfo(RowId),
    ColInfo(ColId),
    BlockUpdate { sheet_id: SheetId, id: BlockId },
    SheetProperty, // like tab color and hidden
    Unavailable,
}

#[derive(Debug, Clone, Default)]
pub struct SheetDiff {
    pub data: HashSet<Diff>,
}

impl SheetDiff {
    pub fn insert_diff(&mut self, diff: Diff) {
        if diff == Diff::Unavailable {
            self.data = HashSet::from([diff]);
        } else if !self.data.contains(&Diff::Unavailable) {
            self.data.insert(diff);
        }
    }

    pub fn diff_unavailable(&self) -> bool {
        self.data.contains(&Diff::Unavailable)
    }
}

// Turning `Process` into `SheetDiff` is for recording the `id` rather than `idx`.
pub fn convert_payloads_to_sheet_diff(
    status: &mut Status,
    process: PayloadsAction,
    updated_cells: HashSet<(SheetId, CellId)>,
) -> HashMap<SheetId, SheetDiff> {
    let mut result: HashMap<SheetId, SheetDiff> = HashMap::new();
    let ctx = VersionExecCtxImpl::new(status);

    process.payloads.into_iter().for_each(|sp| {
        if let Ok(Some((diff, sheet_id))) = convert_diff(sp, &ctx) {
            let sheet_diff = result.entry(sheet_id).or_insert(SheetDiff::default());
            sheet_diff.insert_diff(diff);
        }
    });

    updated_cells.into_iter().for_each(|(sheet_id, cell_id)| {
        let diff = Diff::CellValue(cell_id);
        let sheet_diff = result.entry(sheet_id).or_insert(SheetDiff::default());
        sheet_diff.insert_diff(diff);
    });

    result
}

#[inline]
fn convert_diff<C: VersionExecCtx>(
    payload: EditPayload,
    ctx: &C,
) -> Result<Option<(Diff, SheetId)>, Error> {
    match payload {
        EditPayload::BlockInput(bi) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(bi.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let cell_id = ctx.fetch_block_cell_id(&sheet_id, &bi.block_id, bi.row, bi.col)?;
            Ok(Some((
                Diff::CellValue(CellId::BlockCell(cell_id)),
                sheet_id,
            )))
        }
        EditPayload::MoveBlock(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::RemoveBlock(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::CreateBlock(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::CellStyleUpdate(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let id = ctx.fetch_cell_id(&sheet_id, p.row, p.col)?;
            Ok(Some((Diff::CellStyle(id), sheet_id)))
        }
        EditPayload::BlockStyleUpdate(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let id = ctx.fetch_block_cell_id(&sheet_id, &p.block_id, p.row, p.col)?;
            Ok(Some((Diff::CellStyle(CellId::BlockCell(id)), sheet_id)))
        }
        EditPayload::CellInput(ci) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(ci.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let cell_id = ctx.fetch_cell_id(&sheet_id, ci.row, ci.col)?;
            Ok(Some((Diff::CellValue(cell_id), sheet_id)))
        }
        EditPayload::SetColWidth(col) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(col.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let col_id = ctx.fetch_col_id(&sheet_id, col.col)?;
            Ok(Some((Diff::ColInfo(col_id), sheet_id)))
        }
        EditPayload::SetRowHeight(row) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(row.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let row_id = ctx.fetch_row_id(&sheet_id, row.row)?;
            Ok(Some((Diff::RowInfo(row_id), sheet_id)))
        }
        EditPayload::SetVisible(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::SheetProperty, sheet_id)))
        }
        EditPayload::SheetRename(_) => Ok(Some((Diff::SheetProperty, 0))),
        EditPayload::CreateSheet(_) => Ok(Some((Diff::SheetProperty, 0))),
        EditPayload::DeleteSheet(_) => Ok(Some((Diff::SheetProperty, 0))),
        EditPayload::InsertCols(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::DeleteCols(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::InsertRows(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::DeleteRows(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::InsertColsInBlock(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::DeleteColsInBlock(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::InsertRowsInBlock(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::DeleteRowsInBlock(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::CellClear(cr) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(cr.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let cell_id = ctx.fetch_cell_id(&sheet_id, cr.row, cr.col)?;
            Ok(Some((Diff::CellValue(cell_id), sheet_id)))
        }
        EditPayload::LineStyleUpdate(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::MergeCells(p) => {
            // TODO
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::SplitMergedCells(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::CellFormatBrush(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.dst_sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::LineFormatBrush(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.dst_sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::EphemeralCellStyleUpdate(_) => Ok(None),
        EditPayload::EphemeralCellInput(_) => Ok(None),
        EditPayload::CreateDiyCell(create_diy_cell) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(create_diy_cell.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            let row = create_diy_cell.row;
            let col = create_diy_cell.col;
            let cell_id = ctx
                .fetch_cell_id(&sheet_id, row, col)
                .map_err(|_| BasicError::CellIdNotFound(row, col))?;
            Ok(Some((Diff::CellValue(cell_id), sheet_id)))
        }
        EditPayload::CreateDiyCellById(p) => Ok(Some((
            Diff::BlockUpdate {
                sheet_id: p.sheet_id,
                id: p.block_id,
            },
            p.sheet_id,
        ))),
        EditPayload::RemoveDiyCell(_) => todo!(),
        EditPayload::RemoveDiyCellById(_) => todo!(),
        EditPayload::CreateAppendix(p) => {
            let sheet_id = if let Some(id) = p.sheet_id {
                id
            } else {
                let idx = p.sheet_idx.ok_or(BasicError::InvalidPayload)?;
                ctx.fetch_sheet_id_by_index(idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?
            };
            Ok(Some((
                Diff::BlockUpdate {
                    sheet_id,
                    id: p.block_id,
                },
                sheet_id,
            )))
        }
        EditPayload::RemoveAppendix(p) => {
            let sheet_id = if let Some(id) = p.sheet_id {
                id
            } else {
                let idx = p.sheet_idx.ok_or(BasicError::InvalidPayload)?;
                ctx.fetch_sheet_id_by_index(idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?
            };
            Ok(Some((
                Diff::BlockUpdate {
                    sheet_id,
                    id: p.block_id,
                },
                sheet_id,
            )))
        }
        EditPayload::ResizeBlock(resize_block) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(resize_block.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((
                Diff::BlockUpdate {
                    sheet_id,
                    id: resize_block.id,
                },
                sheet_id,
            )))
        }
        EditPayload::ReproduceCells(rc) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(rc.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((Diff::Unavailable, sheet_id)))
        }
        EditPayload::SetSheetColor(_) => Ok(Some((Diff::SheetProperty, 0))),
        EditPayload::SetSheetVisible(_) => Ok(Some((Diff::SheetProperty, 0))),
        EditPayload::BlockLineStyleUpdate(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((
                Diff::BlockUpdate {
                    sheet_id,
                    id: p.block_id,
                },
                sheet_id,
            )))
        }
        EditPayload::BlockLineNameFieldUpdate(p) => {
            let sheet_id = ctx
                .fetch_sheet_id_by_index(p.sheet_idx)
                .map_err(|l| BasicError::SheetIdxExceed(l))?;
            Ok(Some((
                Diff::BlockUpdate {
                    sheet_id,
                    id: p.block_id,
                },
                sheet_id,
            )))
        }
    }
}
