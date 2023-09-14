use std::collections::{HashMap, HashSet};

use logisheets_base::{BlockId, CellId, ColId, RowId, SheetId};

use crate::{
    controller::status::Status,
    navigator::Navigator,
    payloads::{
        sheet_process::{
            block::BlockPayload, cell::CellChange, line::LineInfoUpdate, SheetPayload,
        },
        Process,
    },
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Diff {
    CellValue(CellId),
    CellStyle(CellId),
    RowInfo(RowId),
    ColInfo(ColId),
    BlockUpdate { id: BlockId, cnt: usize, row: bool },
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
    status: &Status,
    process: Vec<Process>,
    updated_cells: HashSet<(SheetId, CellId)>,
) -> HashMap<SheetId, SheetDiff> {
    let navigator = &status.navigator;

    let mut result: HashMap<SheetId, SheetDiff> = HashMap::new();

    process
        .into_iter()
        .flat_map(|p| match p {
            Process::Sheet(s) => Some(s),
            _ => None,
        })
        .for_each(|sp| {
            let sheet_id = sp.sheet_id;
            let payload = sp.payload;
            if let Some(diff) = convert_diff(sheet_id, payload, navigator) {
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
fn convert_diff(sheet_id: SheetId, payload: SheetPayload, navigator: &Navigator) -> Option<Diff> {
    match payload {
        SheetPayload::Shift(_) => Some(Diff::Unavailable),
        SheetPayload::Line(l) => match l.change {
            LineInfoUpdate::Row(_) => {
                let id = navigator.fetch_row_id(&sheet_id, l.idx).ok()?;
                Some(Diff::RowInfo(id))
            }
            LineInfoUpdate::Col(_) => {
                let id = navigator.fetch_col_id(&sheet_id, l.idx).ok()?;
                Some(Diff::ColInfo(id))
            }
        },
        SheetPayload::Property(_) => None,
        SheetPayload::Block(bp) => match bp {
            BlockPayload::Create(create) => Some(Diff::BlockUpdate {
                id: create.block_id,
                cnt: 0,
                row: true,
            }),
            BlockPayload::DeleteCols(dc) => Some(Diff::BlockUpdate {
                id: dc.block_id,
                cnt: 0,
                row: false,
            }),
            BlockPayload::DeleteRows(dr) => Some(Diff::BlockUpdate {
                id: dr.block_id,
                cnt: 0,
                row: true,
            }),
            BlockPayload::InsertCols(ic) => Some(Diff::BlockUpdate {
                id: ic.block_id,
                cnt: ic.insert_cnt,
                row: true,
            }),
            BlockPayload::InsertRows(ir) => Some(Diff::BlockUpdate {
                id: ir.block_id,
                cnt: ir.insert_cnt,
                row: true,
            }),
            BlockPayload::Move(_) => Some(Diff::Unavailable),
            BlockPayload::Remove(_) => Some(Diff::Unavailable),
        },
        SheetPayload::Formula(f) => {
            let cell_id = navigator.fetch_cell_id(&sheet_id, f.row, f.col).ok()?;
            Some(Diff::CellValue(cell_id))
        }
        SheetPayload::Cell(cp) => {
            let cell_id = navigator.fetch_cell_id(&sheet_id, cp.row, cp.col).ok()?;
            match cp.change {
                CellChange::Recalc => None,
                CellChange::Value(_) => Some(Diff::CellValue(cell_id)),
                CellChange::DiffStyle(_) => Some(Diff::CellStyle(cell_id)),
            }
        }
    }
}
