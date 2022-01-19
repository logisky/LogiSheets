use controller_base::{CellId, CellValue, SheetId};

use crate::{
    cell::Cell,
    container::{col_info_manager::ColInfo, row_info_manager::RowInfo, DataContainer},
    navigator::Navigator,
    payloads::sheet_process::{
        block::BlockPayload,
        cell::CellChange,
        line::{ColInfoUpdate, LineInfoUpdate, RowInfoUpdate},
        style::CellStylePayload,
    },
    payloads::sheet_process::{SheetPayload, SheetProcess},
    style_manager::StyleManager,
};

#[derive(Debug, Clone)]
pub struct DataExecutor {
    pub navigator: Navigator,
    pub style_manager: StyleManager,
    pub container: DataContainer,
}

impl DataExecutor {
    pub fn execute(self, proc: &SheetProcess) -> Self {
        log!("data excutor ready to handle sheet process");
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
                        self.handle_cell_style_payload(sheet_id, row, col, csp)
                    }
                    CellChange::Recalc => self,
                }
            }
            SheetPayload::Shift(s) => {
                let new_navigator = self.navigator.execute_shift(sheet_id, &s);
                DataExecutor {
                    navigator: new_navigator,
                    container: self.container,
                    style_manager: self.style_manager,
                }
            }
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
            SheetPayload::Property(_) => self,
            SheetPayload::Formula(_) => self,
            SheetPayload::Block(bp) => self.handle_block_payload(sheet_id, bp),
        }
    }

    fn handle_block_payload(self, sheet_id: SheetId, bp: &BlockPayload) -> Self {
        let mut navigator = self.navigator.clone();
        let new_container = {
            match bp {
                BlockPayload::Move(mv) => {
                    let bid = mv.block_id;
                    let cells = navigator.get_cells_covered_by_block(sheet_id, bid);
                    self.container.delete_cells(sheet_id, cells)
                }
                // TODO: Optimization
                BlockPayload::DeleteRows(dr) => {
                    let bid = dr.block_id;
                    let cells = navigator.get_cells_covered_by_block(sheet_id, bid);
                    self.container.delete_cells(sheet_id, cells)
                }
                BlockPayload::DeleteCols(dc) => {
                    let bid = dc.block_id;
                    let cells = navigator.get_cells_covered_by_block(sheet_id, bid);
                    self.container.delete_cells(sheet_id, cells)
                }
                _ => self.container,
            }
        };
        let new_navigator = match bp {
            BlockPayload::Create(c) => {
                let master_row = c.master_row;
                let master_col = c.master_col;
                if let Some(CellId::NormalCell(master)) =
                    navigator.fetch_cell_id(sheet_id, master_row, master_col)
                {
                    navigator.create_block(sheet_id, c.block_id, master, c.row_cnt, c.col_cnt);
                    navigator
                } else {
                    navigator
                }
            }
            BlockPayload::DeleteCols(dc) => {
                let bp = navigator.get_block_place(sheet_id, dc.block_id);
                if bp.is_none() {
                    navigator
                } else {
                    let bp = bp.unwrap().clone();
                    let new_bp = bp.delete_cols(dc.idx, dc.delete_cnt as u32);
                    navigator.add_block_place(sheet_id, dc.block_id, new_bp)
                }
            }
            BlockPayload::DeleteRows(dr) => {
                let bp = navigator.get_block_place(sheet_id, dr.block_id);
                if bp.is_none() {
                    navigator
                } else {
                    let bp = bp.unwrap().clone();
                    let new_bp = bp.delete_rows(dr.idx, dr.delete_cnt as u32);
                    navigator.add_block_place(sheet_id, dr.block_id, new_bp)
                }
            }
            BlockPayload::InsertCols(ic) => {
                let bp = navigator.get_block_place(sheet_id, ic.block_id);
                if bp.is_none() {
                    navigator
                } else {
                    let bp = bp.unwrap().clone();
                    let new_bp = bp.add_new_cols(ic.idx, ic.insert_cnt as u32);
                    navigator.add_block_place(sheet_id, ic.block_id, new_bp)
                }
            }
            BlockPayload::InsertRows(ir) => {
                let bp = navigator.get_block_place(sheet_id, ir.block_id);
                if bp.is_none() {
                    navigator
                } else {
                    let bp = bp.unwrap().clone();
                    let new_bp = bp.add_new_cols(ir.idx, ir.insert_cnt as u32);
                    navigator.add_block_place(sheet_id, ir.block_id, new_bp)
                }
            }
            BlockPayload::Move(m) => {
                let master_row = m.new_master_row;
                let master_col = m.new_master_col;
                if let Some(CellId::NormalCell(master)) =
                    navigator.fetch_cell_id(sheet_id, master_row, master_col)
                {
                    navigator.move_block(sheet_id, m.block_id, master);
                    navigator
                } else {
                    navigator
                }
            }
            BlockPayload::Remove(r) => {
                navigator.remove_block(sheet_id, r.block_id);
                navigator
            }
        };
        DataExecutor {
            navigator: new_navigator,
            style_manager: self.style_manager,
            container: new_container,
        }
    }

    fn handle_cell_value_payload(
        self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
        value: &CellValue,
    ) -> Self {
        let mut res = self.clone();
        if let Some(id) = res.navigator.fetch_cell_id(sheet_id, row, col) {
            if let Some(c) = res.container.get_cell(sheet_id, &id) {
                c.value = value.clone();
            } else {
                let mut c = Cell::default();
                c.value = value.clone();
                res.container.add_cell(sheet_id, id, c);
            }
        }
        res
    }

    fn handle_cell_style_payload(
        self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
        p: &CellStylePayload,
    ) -> Self {
        let mut res = self.clone();
        let id = res.navigator.fetch_cell_id(sheet_id, row, col);
        if id.is_none() {
            return res;
        }
        let id = id.unwrap();
        let cell = res.container.get_cell(sheet_id, &id);
        if cell.is_none() {
            return res;
        }
        let mut cell = cell.unwrap();
        let old_style = cell.style;
        if let Some((new_style_manager, new_idx)) = self
            .style_manager
            .clone()
            .execute_style_payload(p, old_style)
        {
            cell.style = new_idx;
            res.style_manager = new_style_manager;
            res
        } else {
            res
        }
    }

    fn handle_row_info_payload(self, sheet_id: SheetId, row: usize, p: RowInfoUpdate) -> Self {
        let DataExecutor {
            mut navigator,
            mut style_manager,
            mut container,
        } = self;
        let row_id = navigator.fetch_row_id(sheet_id, row).unwrap_or(0);
        let mut info = container
            .get_row_info(sheet_id, row_id)
            .map_or(RowInfo::default(), |r| r.clone());
        match p {
            RowInfoUpdate::Collapsed(c) => info.collapsed = c,
            RowInfoUpdate::Hidden(h) => info.hidden = h,
            RowInfoUpdate::Height(h) => info.ht = Some(h),
            RowInfoUpdate::Style(sp) => {
                let old_idx = info.style;
                match style_manager.clone().execute_style_payload(&sp, old_idx) {
                    Some((manager, new_idx)) => {
                        info.style = new_idx;
                        style_manager = manager;
                    }
                    None => {}
                }
            }
        };
        let new_container = container.update_row_info(sheet_id, row_id, info);
        DataExecutor {
            navigator,
            style_manager,
            container: new_container,
        }
    }

    fn handle_col_info_payload(self, sheet_id: SheetId, col: usize, p: ColInfoUpdate) -> Self {
        let DataExecutor {
            mut navigator,
            mut style_manager,
            mut container,
        } = self;
        let col_id = navigator.fetch_col_id(sheet_id, col).unwrap_or(0);
        let mut info = container
            .get_col_info(sheet_id, col_id)
            .map_or(ColInfo::default(), |r| r.clone());
        match p {
            ColInfoUpdate::Collapsed(c) => info.collapsed = c,
            ColInfoUpdate::Hidden(h) => info.hidden = h,
            ColInfoUpdate::Width(h) => info.width = Some(h),
            ColInfoUpdate::Style(sp) => {
                let old_idx = info.style;
                match style_manager.clone().execute_style_payload(&sp, old_idx) {
                    Some((manager, new_idx)) => {
                        info.style = new_idx;
                        style_manager = manager;
                    }
                    None => {}
                }
            }
        };
        let new_container = container.update_col_info(sheet_id, col_id, info);
        DataExecutor {
            navigator,
            style_manager,
            container: new_container,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        BlockPayload, CellChange, DataContainer, DataExecutor, Navigator, SheetPayload,
        SheetProcess, StyleManager,
    };
    use crate::payloads::sheet_process::{CellPayload, CreateBlock, MoveBlock};
    use controller_base::{CellId, CellValue, SheetId};

    #[test]
    fn test_move_block() {
        let init = DataExecutor {
            navigator: Navigator::default(),
            style_manager: StyleManager::default(),
            container: DataContainer::default(),
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
        let executor = init.execute(&create_proc);
        let row = 2;
        let col = 2;
        let change = CellChange::Value(CellValue::Number(2.0));
        let value_proc = SheetProcess {
            sheet_id,
            payload: SheetPayload::Cell(CellPayload { row, col, change }),
        };
        let executor = executor.execute(&value_proc);
        let move_payload = BlockPayload::Move(MoveBlock {
            block_id,
            new_master_row: 6,
            new_master_col: 6,
        });
        let mut executor = executor.execute(&block_payload_to_proc(move_payload, sheet_id));
        assert!(matches!(
            executor.navigator.fetch_cell_id(sheet_id, row, col),
            Some(CellId::NormalCell(_))
        ));
        assert!(matches!(
            executor.navigator.fetch_cell_id(sheet_id, 8, 8),
            Some(CellId::BlockCell(_))
        ));
    }

    fn block_payload_to_proc(bp: BlockPayload, sheet_id: SheetId) -> SheetProcess {
        let payload = SheetPayload::Block(bp);
        SheetProcess { sheet_id, payload }
    }
}
