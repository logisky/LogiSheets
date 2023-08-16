use anyhow::Result;
use logisheets_base::{
    matrix_value::cross_product_usize, CellId, CellValue, NormalCellId, SheetId,
};

use crate::{
    cell::Cell,
    container::{col_info_manager::ColInfo, row_info_manager::RowInfo, DataContainer},
    navigator::Navigator,
    payloads::sheet_process::{
        block::BlockPayload,
        cell::CellChange,
        line::{ColInfoUpdate, LineInfoUpdate, RowInfoUpdate},
        style::CellStylePayload,
        Direction, ShiftPayload, ShiftType,
    },
    payloads::sheet_process::{SheetPayload, SheetProcess},
    style_manager::StyleManager,
};

#[derive(Debug, Clone)]
pub struct DataExecutor {
    pub navigator: Navigator,
    pub style_manager: StyleManager,
    pub container: DataContainer,
    // todo: remove it?
    deleted_cells: Vec<(SheetId, CellId)>,
}

impl DataExecutor {
    pub fn new(
        navigator: Navigator,
        style_manager: StyleManager,
        container: DataContainer,
    ) -> Self {
        DataExecutor {
            navigator,
            style_manager,
            container,
            deleted_cells: vec![],
        }
    }
    pub fn execute(self, proc: &SheetProcess) -> Result<Self> {
        let sheet_id = proc.sheet_id;
        match &proc.payload {
            SheetPayload::Cell(cp) => {
                let row = cp.row;
                let col = cp.col;
                match &cp.change {
                    CellChange::Value(value) => {
                        self.handle_cell_value_payload(sheet_id, row, col, value)
                    }
                    CellChange::DiffStyle(csp) => {
                        let mut res = self;
                        for p in csp {
                            res = res.handle_cell_style_payload(sheet_id, row, col, p)?;
                        }
                        Ok(res)
                    }
                    CellChange::Recalc => Ok(self),
                }
            }
            SheetPayload::Shift(s) => self.handle_shift_payload(sheet_id, s),
            SheetPayload::Line(l) => {
                let line_idx = l.idx;
                match &l.change {
                    LineInfoUpdate::Row(riu) => {
                        self.handle_row_info_payload(sheet_id, line_idx, riu.clone())
                    }
                    LineInfoUpdate::Col(ciu) => {
                        self.handle_col_info_payload(sheet_id, line_idx, ciu.clone())
                    }
                }
            }
            SheetPayload::Property(_) => Ok(self),
            SheetPayload::Formula(_) => Ok(self),
            SheetPayload::Block(bp) => self.handle_block_payload(sheet_id, bp),
        }
    }

    fn handle_shift_payload(self, sheet_id: SheetId, sp: &ShiftPayload) -> Result<Self> {
        let (mut old_navigator, mut old_container) = (self.navigator, self.container);
        let (new_container, deleted_cells) = match sp {
            ShiftPayload::Line(l) => match (&l.direction, &l.ty) {
                (Direction::Horizontal, ShiftType::Insert) => (old_container, vec![]),
                (Direction::Vertical, ShiftType::Insert) => (old_container, vec![]),
                (Direction::Horizontal, ShiftType::Delete) => {
                    let bids = old_navigator.get_affected_blockplace(
                        &sheet_id,
                        l.start,
                        l.cnt as usize,
                        true,
                    )?;
                    let mut deleted_cells = Vec::<CellId>::new();
                    bids.into_iter().for_each(|block_id| {
                        let (row_cnt, col_cnt) =
                            old_navigator.get_block_size(sheet_id, block_id).unwrap();
                        let master = old_navigator.get_master_cell(sheet_id, block_id).unwrap();
                        let (master_row, master_col) =
                            old_navigator.fetch_cell_idx(&sheet_id, &master).unwrap();
                        let start_row = master_row + row_cnt;
                        let end_row = start_row + l.cnt as usize - 1;
                        let start_col = master_col;
                        let end_col = master_col + col_cnt as usize - 1;
                        cross_product_usize(start_row, end_row, start_col, end_col)
                            .into_iter()
                            .for_each(|(r, c)| {
                                if let Ok(cid) = old_navigator.fetch_cell_id(&sheet_id, r, c) {
                                    deleted_cells.push(cid)
                                }
                            });
                    });
                    get_norm_cell_ids_by_line(
                        &mut old_navigator,
                        &mut old_container,
                        sheet_id,
                        l.start,
                        l.cnt as usize,
                        true,
                    )
                    .into_iter()
                    .for_each(|nc| {
                        deleted_cells.push(CellId::NormalCell(nc));
                    });
                    (
                        old_container.delete_cells(sheet_id, &deleted_cells),
                        deleted_cells,
                    )
                }
                (Direction::Vertical, ShiftType::Delete) => {
                    let bids = old_navigator.get_affected_blockplace(
                        &sheet_id,
                        l.start,
                        l.cnt as usize,
                        false,
                    )?;
                    let mut deleted_cells = Vec::<CellId>::new();
                    bids.into_iter().for_each(|block_id| {
                        let (row_cnt, col_cnt) =
                            old_navigator.get_block_size(sheet_id, block_id).unwrap();
                        let master = old_navigator.get_master_cell(sheet_id, block_id).unwrap();
                        let (master_row, master_col) =
                            old_navigator.fetch_cell_idx(&sheet_id, &master).unwrap();
                        let start_row = master_row;
                        let end_row = master_row + row_cnt as usize - 1;
                        let start_col = master_col + col_cnt;
                        let end_col = start_col + l.cnt as usize - 1;
                        cross_product_usize(start_row, end_row, start_col, end_col)
                            .into_iter()
                            .for_each(|(r, c)| {
                                if let Ok(cid) = old_navigator.fetch_cell_id(&sheet_id, r, c) {
                                    deleted_cells.push(cid)
                                }
                            });
                    });
                    get_norm_cell_ids_by_line(
                        &mut old_navigator,
                        &mut old_container,
                        sheet_id,
                        l.start,
                        l.cnt as usize,
                        false,
                    )
                    .into_iter()
                    .for_each(|nc| {
                        deleted_cells.push(CellId::NormalCell(nc));
                    });
                    (
                        old_container.delete_cells(sheet_id, &deleted_cells),
                        deleted_cells,
                    )
                }
            },
            ShiftPayload::Range(_) => todo!(),
        };
        let new_navigator = old_navigator.execute_shift(sheet_id, sp);
        let res = DataExecutor {
            navigator: new_navigator,
            container: new_container,
            style_manager: self.style_manager,
            deleted_cells: deleted_cells.into_iter().map(|c| (sheet_id, c)).collect(),
        };
        Ok(res)
    }

    fn handle_block_payload(self, sheet_id: SheetId, bp: &BlockPayload) -> Result<Self> {
        let mut navigator = self.navigator.clone();
        let (new_container, deleted_cells) = {
            match bp {
                BlockPayload::Create(c) => {
                    let start_row = c.master_row;
                    let start_col = c.master_col;
                    let end_row = start_row + c.row_cnt - 1;
                    let end_col = start_col + c.col_cnt - 1;
                    let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                        .into_iter()
                        .map(|(r, c)| navigator.fetch_cell_id(&sheet_id, r, c))
                        .filter(|c| c.is_ok())
                        .map(|c| c.unwrap())
                        .collect::<Vec<_>>();
                    (
                        self.container.delete_cells(sheet_id, &cells),
                        cells.into_iter().map(|c| (sheet_id, c)).collect(),
                    )
                }
                BlockPayload::InsertRows(c) => {
                    let block_id = c.block_id;
                    let bp = navigator
                        .get_block_place(sheet_id, block_id)
                        .map_or(None, |b| Some(b.clone()));
                    match bp {
                        Some(bp) => {
                            let (row_cnt, col_cnt) = bp.get_block_size();
                            let (master_row, master_col) = navigator
                                .fetch_normal_cell_idx(&sheet_id, &bp.master)
                                .unwrap();
                            let start_row = master_row + row_cnt;
                            let end_row = start_row + c.insert_cnt - 1;
                            let start_col = master_col;
                            let end_col = master_col + col_cnt - 1;
                            let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                                .into_iter()
                                .map(|(r, c)| navigator.fetch_cell_id(&sheet_id, r, c))
                                .filter(|c| c.is_ok())
                                .map(|c| c.unwrap())
                                .collect::<Vec<_>>();
                            (
                                self.container.delete_cells(sheet_id, &cells),
                                cells.into_iter().map(|c| (sheet_id, c)).collect(),
                            )
                        }
                        None => (self.container, vec![]),
                    }
                }
                BlockPayload::InsertCols(c) => {
                    let block_id = c.block_id;
                    let bp = navigator
                        .get_block_place(sheet_id, block_id)
                        .map_or(None, |b| Some(b.clone()));
                    match bp {
                        Some(bp) => {
                            let (row_cnt, col_cnt) = bp.get_block_size();
                            let (master_row, master_col) = navigator
                                .fetch_normal_cell_idx(&sheet_id, &bp.master)
                                .unwrap();
                            let start_row = master_row;
                            let end_row = master_row + row_cnt - 1;
                            let start_col = master_col + col_cnt;
                            let end_col = start_col + c.insert_cnt - 1;
                            let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                                .into_iter()
                                .map(|(r, c)| navigator.fetch_cell_id(&sheet_id, r, c))
                                .filter(|c| c.is_ok())
                                .map(|c| c.unwrap())
                                .collect::<Vec<_>>();
                            (
                                self.container.delete_cells(sheet_id, &cells),
                                cells.into_iter().map(|c| (sheet_id, c)).collect(),
                            )
                        }
                        None => (self.container, vec![]),
                    }
                }
                BlockPayload::DeleteRows(dr) => {
                    let block_id = dr.block_id;
                    let bp = navigator
                        .get_block_place(sheet_id, block_id)
                        .map_or(None, |b| Some(b.clone()));
                    match bp {
                        Some(bp) => {
                            let (_, col_cnt) = bp.get_block_size();
                            let (master_row, master_col) = navigator
                                .fetch_normal_cell_idx(&sheet_id, &bp.master)
                                .unwrap();
                            let start_row = master_row + dr.idx;
                            let end_row = start_row + dr.delete_cnt - 1;
                            let start_col = master_col;
                            let end_col = start_col + col_cnt - 1;
                            let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                                .into_iter()
                                .map(|(r, c)| navigator.fetch_cell_id(&sheet_id, r, c))
                                .filter(|c| c.is_ok())
                                .map(|c| c.unwrap())
                                .collect::<Vec<_>>();
                            (
                                self.container.delete_cells(sheet_id, &cells),
                                cells.into_iter().map(|c| (sheet_id, c)).collect(),
                            )
                        }
                        None => (self.container, vec![]),
                    }
                }
                BlockPayload::DeleteCols(dc) => {
                    let block_id = dc.block_id;
                    let bp = navigator
                        .get_block_place(sheet_id, block_id)
                        .map_or(None, |b| Some(b.clone()));
                    match bp {
                        Some(bp) => {
                            let (row_cnt, _) = bp.get_block_size();
                            let (master_row, master_col) = navigator
                                .fetch_normal_cell_idx(&sheet_id, &bp.master)
                                .unwrap();
                            let start_row = master_row;
                            let end_row = start_row + row_cnt - 1;
                            let start_col = master_col + dc.idx;
                            let end_col = start_col + dc.delete_cnt - 1;
                            let cells = cross_product_usize(start_row, end_row, start_col, end_col)
                                .into_iter()
                                .map(|(r, c)| navigator.fetch_cell_id(&sheet_id, r, c))
                                .filter(|c| c.is_ok())
                                .map(|c| c.unwrap())
                                .collect::<Vec<_>>();
                            (
                                self.container.delete_cells(sheet_id, &cells),
                                cells.into_iter().map(|c| (sheet_id, c)).collect(),
                            )
                        }
                        None => (self.container, vec![]),
                    }
                }
                _ => (self.container, vec![]),
            }
        };
        let new_navigator = match bp {
            BlockPayload::Create(c) => {
                let master_row = c.master_row;
                let master_col = c.master_col;
                if let Ok(CellId::NormalCell(master)) =
                    navigator.fetch_cell_id(&sheet_id, master_row, master_col)
                {
                    navigator.create_block(&sheet_id, master, c.row_cnt, c.col_cnt);
                    navigator
                } else {
                    navigator
                }
            }
            BlockPayload::DeleteCols(dc) => {
                let bp = navigator.get_block_place(sheet_id, dc.block_id)?;
                let new_bp = bp.clone().delete_cols(dc.idx, dc.delete_cnt as u32);
                navigator.clean_cache(sheet_id);
                navigator.add_block_place(sheet_id, dc.block_id, new_bp)
            }
            BlockPayload::DeleteRows(dr) => {
                let bp = navigator.get_block_place(sheet_id, dr.block_id)?;
                let new_bp = bp.clone().delete_rows(dr.idx, dr.delete_cnt as u32);
                navigator.clean_cache(sheet_id);
                navigator.add_block_place(sheet_id, dr.block_id, new_bp)
            }
            BlockPayload::InsertCols(ic) => {
                let bp = navigator.get_block_place(sheet_id, ic.block_id)?;
                let new_bp = bp.clone().add_new_cols(ic.idx, ic.insert_cnt as u32);
                navigator.clean_cache(sheet_id);
                navigator.add_block_place(sheet_id, ic.block_id, new_bp)
            }
            BlockPayload::InsertRows(ir) => {
                let bp = navigator.get_block_place(sheet_id, ir.block_id)?;
                let new_bp = bp.clone().add_new_rows(ir.idx, ir.insert_cnt as u32);
                navigator.clean_cache(sheet_id);
                navigator.add_block_place(sheet_id, ir.block_id, new_bp)
            }
            BlockPayload::Move(m) => {
                let master_row = m.new_master_row;
                let master_col = m.new_master_col;
                if let Ok(CellId::NormalCell(master)) =
                    navigator.fetch_cell_id(&sheet_id, master_row, master_col)
                {
                    navigator.move_block(&sheet_id, &m.block_id, master);
                    navigator
                } else {
                    navigator
                }
            }
            BlockPayload::Remove(r) => {
                navigator.remove_block(&sheet_id, &r.block_id);
                navigator
            }
        };
        let res = DataExecutor {
            navigator: new_navigator,
            style_manager: self.style_manager,
            container: new_container,
            deleted_cells,
        };
        Ok(res)
    }

    fn handle_cell_value_payload(
        self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
        value: &CellValue,
    ) -> Result<Self> {
        let mut res = self.clone();
        if let Ok(id) = res.navigator.fetch_cell_id(&sheet_id, row, col) {
            if let Some(c) = res.container.get_cell(sheet_id, &id) {
                c.value = value.clone();
            } else {
                let mut c = Cell::default();
                c.value = value.clone();
                res.container.add_cell(sheet_id, id, c);
            }
        }
        Ok(res)
    }

    fn handle_cell_style_payload(
        self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
        p: &CellStylePayload,
    ) -> Result<Self> {
        let mut res = self.clone();
        let id = res.navigator.fetch_cell_id(&sheet_id, row, col)?;
        let mut cell = res.container.get_cell(sheet_id, &id);
        if cell.is_none() {
            res.container.add_cell(sheet_id, id, Cell::default());
            cell = res.container.get_cell(sheet_id, &id);
        }
        let mut cell = cell.unwrap();
        let old_style = cell.style;
        let (new_style_manager, new_idx) = self
            .style_manager
            .clone()
            .execute_style_payload(p, old_style)?;
        cell.style = new_idx;
        res.style_manager = new_style_manager;
        Ok(res)
    }

    fn handle_row_info_payload(
        self,
        sheet_id: SheetId,
        row: usize,
        p: RowInfoUpdate,
    ) -> Result<Self> {
        let DataExecutor {
            mut navigator,
            mut style_manager,
            mut container,
            deleted_cells,
        } = self;
        let row_id = navigator.fetch_row_id(&sheet_id, row).unwrap_or(0);
        let mut info = container
            .get_row_info(sheet_id, row_id)
            .map_or(RowInfo::default(), |r| r.clone());
        match p {
            RowInfoUpdate::Collapsed(c) => info.collapsed = c,
            RowInfoUpdate::Hidden(h) => info.hidden = h,
            RowInfoUpdate::Height(h) => info.ht = Some(h),
            RowInfoUpdate::Style(sp) => {
                let old_idx = info.style;
                let (manager, new_idx) =
                    style_manager.clone().execute_style_payload(&sp, old_idx)?;
                info.style = new_idx;
                style_manager = manager;
            }
        };
        let new_container = container.update_row_info(sheet_id, row_id, info);
        Ok(DataExecutor {
            navigator,
            style_manager,
            container: new_container,
            deleted_cells,
        })
    }

    fn handle_col_info_payload(
        self,
        sheet_id: SheetId,
        col: usize,
        p: ColInfoUpdate,
    ) -> Result<Self> {
        let DataExecutor {
            mut navigator,
            mut style_manager,
            mut container,
            deleted_cells,
        } = self;
        let col_id = navigator.fetch_col_id(&sheet_id, col)?;
        let mut info = container
            .get_col_info(sheet_id, col_id)
            .map_or(ColInfo::default(), |r| r.clone());
        match p {
            ColInfoUpdate::Collapsed(c) => info.collapsed = c,
            ColInfoUpdate::Hidden(h) => info.hidden = h,
            ColInfoUpdate::Width(h) => info.width = Some(h),
            ColInfoUpdate::Style(sp) => {
                let old_idx = info.style;
                let (manager, new_idx) =
                    style_manager.clone().execute_style_payload(&sp, old_idx)?;
                info.style = new_idx;
                style_manager = manager;
            }
        };
        let new_container = container.update_col_info(sheet_id, col_id, info);
        Ok(DataExecutor {
            navigator,
            style_manager,
            container: new_container,
            deleted_cells,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{
        BlockPayload, CellChange, DataContainer, DataExecutor, Navigator, SheetPayload,
        SheetProcess, StyleManager,
    };
    use crate::payloads::sheet_process::{CellPayload, CreateBlock, MoveBlock};
    use logisheets_base::{CellId, CellValue, SheetId};

    #[test]
    fn test_move_block() {
        let init = DataExecutor {
            navigator: Navigator::default(),
            style_manager: StyleManager::default(),
            container: DataContainer::default(),
            deleted_cells: vec![],
        };
        let sheet_id = 1;
        let block_id = 0;
        let create = BlockPayload::Create(CreateBlock {
            block_id,
            master_row: 0,
            master_col: 0,
            row_cnt: 4,
            col_cnt: 4,
        });
        let create_proc = block_payload_to_proc(create, sheet_id);
        let executor = init.execute(&create_proc).unwrap();
        let row = 2;
        let col = 2;
        let change = CellChange::Value(CellValue::Number(2.0));
        let value_proc = SheetProcess {
            sheet_id,
            payload: SheetPayload::Cell(CellPayload { row, col, change }),
        };
        let executor = executor.execute(&value_proc).unwrap();
        let move_payload = BlockPayload::Move(MoveBlock {
            block_id,
            new_master_row: 6,
            new_master_col: 6,
        });
        let mut executor = executor
            .execute(&block_payload_to_proc(move_payload, sheet_id))
            .unwrap();
        assert!(matches!(
            executor.navigator.fetch_cell_id(&sheet_id, row, col),
            Ok(CellId::NormalCell(_))
        ));
        assert!(matches!(
            executor.navigator.fetch_cell_id(&sheet_id, 8, 8),
            Ok(CellId::BlockCell(_))
        ));
    }

    fn block_payload_to_proc(bp: BlockPayload, sheet_id: SheetId) -> SheetProcess {
        let payload = SheetPayload::Block(bp);
        SheetProcess { sheet_id, payload }
    }
}

fn get_norm_cell_ids_by_line(
    navigator: &mut Navigator,
    container: &mut DataContainer,
    sheet_id: SheetId,
    idx: usize,
    cnt: usize,
    is_row: bool,
) -> Vec<NormalCellId> {
    let sheet_container = container.data.get(&sheet_id);
    if sheet_container.is_none() {
        return Vec::new();
    }
    let mut result = Vec::<NormalCellId>::new();
    let sheet_container = sheet_container.unwrap();
    sheet_container
        .clone()
        .cells
        .iter()
        .for_each(|(cid, _)| match cid {
            CellId::NormalCell(nc) => {
                let cidx = navigator.fetch_cell_idx(&sheet_id, cid);
                match cidx {
                    Ok((r, c)) => {
                        if is_row && r >= idx && r <= idx + cnt - 1 {
                            result.push(nc.clone())
                        } else if !is_row && c >= idx && c <= idx + cnt - 1 {
                            result.push(nc.clone())
                        }
                    }
                    Err(_) => {}
                }
            }
            CellId::BlockCell(_) => {}
        });
    result
}
