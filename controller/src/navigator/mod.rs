use crate::payloads::sheet_process::ShiftPayload;
use controller_base::{BlockId, CellId, ColId, NormalCellId, RowId, SheetId};
use im::HashMap;

use self::{
    block::BlockPlace,
    sheet_nav::{Cache, SheetNav},
};

mod block;
mod executor;
mod fetcher;
mod id_manager;
mod sheet_nav;

#[derive(Debug, Clone, Default)]
pub struct Navigator {
    pub sheet_navs: HashMap<SheetId, SheetNav>,
}

impl Navigator {
    pub fn execute_shift(self, sheet_id: SheetId, payload: &ShiftPayload) -> Self {
        if let Some(nav) = self.sheet_navs.get(&sheet_id) {
            let new_nav = nav.clone().execute_shift(payload);
            Navigator {
                sheet_navs: self.sheet_navs.update(sheet_id, new_nav),
            }
        } else {
            self
        }
    }

    pub fn fetch_row_id(&mut self, sheet_id: SheetId, row: usize) -> Option<RowId> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_row_id(row)
    }

    pub fn fetch_row_idx(&mut self, sheet_id: SheetId, row: RowId) -> Option<usize> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_row_idx(row)
    }

    pub fn fetch_col_id(&mut self, sheet_id: SheetId, col: usize) -> Option<ColId> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_col_id(col)
    }

    pub fn fetch_col_idx(&mut self, sheet_id: SheetId, col: ColId) -> Option<usize> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_col_idx(col)
    }

    pub fn fetch_cell_id(&mut self, sheet_id: SheetId, row: usize, col: usize) -> Option<CellId> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_cell_id(row, col)
    }

    pub fn fetch_norm_cell_id(
        &mut self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
    ) -> Option<NormalCellId> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_norm_cell_id(row, col)
    }

    pub fn fetch_cell_idx(
        &mut self,
        sheet_id: SheetId,
        cell_id: &CellId,
    ) -> Option<(usize, usize)> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_cell_idx(&cell_id)
    }

    pub fn fetch_normal_cell_idx(
        &mut self,
        sheet_id: SheetId,
        cell_id: &NormalCellId,
    ) -> Option<(usize, usize)> {
        let mut fetcher = self.get_sheet_nav(sheet_id).get_fetcher();
        fetcher.get_norm_cell_idx(cell_id)
    }

    pub fn create_block(
        &mut self,
        sheet_id: SheetId,
        master: NormalCellId,
        row_cnt: usize,
        col_cnt: usize,
    ) {
        let sheet_nav = self.get_sheet_nav(sheet_id);
        let block_place = BlockPlace::new(master, row_cnt as u32, col_cnt as u32);
        let block_id = sheet_nav.id_manager.get_block_id();
        sheet_nav.data.blocks.insert(block_id, block_place);
        sheet_nav.cache = Cache::default();
    }

    pub fn remove_block(&mut self, sheet_id: SheetId, block_id: BlockId) {
        let sheet_nav = self.get_sheet_nav(sheet_id);
        sheet_nav.data.blocks.remove(&block_id);
        sheet_nav.cache = Cache::default();
    }

    pub fn move_block(&mut self, sheet_id: SheetId, block_id: BlockId, new_master: NormalCellId) {
        let sheet_nav = self.get_sheet_nav(sheet_id);
        if let Some(mut bp) = sheet_nav.data.blocks.get_mut(&block_id) {
            bp.master = new_master;
            sheet_nav.cache = Cache::default()
        }
    }

    pub fn get_affected_blockplace(
        &mut self,
        sheet_id: SheetId,
        line_idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Vec<BlockId> {
        let sheet_nav = self.sheet_navs.get(&sheet_id);
        if sheet_nav.is_none() {
            return vec![];
        }
        let sheet_nav = sheet_nav.unwrap();
        let mut result: Vec<BlockId> = vec![];
        sheet_nav.data.blocks.clone().iter().for_each(|(b_id, bp)| {
            let master = &bp.master;
            let master_idx = self.fetch_normal_cell_idx(sheet_id, &master);
            if let Some((m_row, m_col)) = master_idx {
                let (row_cnt, col_cnt) = bp.get_block_size();
                if is_row && intersect(m_row, m_row + row_cnt - 1, line_idx, line_idx + cnt - 1) {
                    result.push(b_id.clone())
                } else if !is_row
                    && intersect(m_col, m_col + col_cnt - 1, line_idx, line_idx + cnt - 1)
                {
                    result.push(b_id.clone())
                }
            }
        });
        result
    }

    #[inline]
    pub fn get_block_place(&self, sheet_id: SheetId, block_id: BlockId) -> Option<&BlockPlace> {
        let sheet_nav = self.sheet_navs.get(&sheet_id)?;
        sheet_nav.data.blocks.get(&block_id)
    }

    pub fn get_block_size(&self, sheet_id: SheetId, block_id: BlockId) -> Option<(usize, usize)> {
        let bp = self.get_block_place(sheet_id, block_id)?;
        Some(bp.get_block_size())
    }

    pub fn get_master_cell(&self, sheet_id: SheetId, block_id: BlockId) -> Option<CellId> {
        let bp = self.get_block_place(sheet_id, block_id)?;
        let nc = bp.master;
        Some(CellId::NormalCell(nc))
    }

    fn get_sheet_nav(&mut self, sheet_id: SheetId) -> &mut SheetNav {
        if let Some(_) = self.sheet_navs.get(&sheet_id) {
            self.sheet_navs.get_mut(&sheet_id).unwrap()
        } else {
            self.sheet_navs.insert(sheet_id, SheetNav::default());
            self.sheet_navs.get_mut(&sheet_id).unwrap()
        }
    }

    pub fn add_block_place(self, sheet_id: SheetId, block_id: BlockId, bp: BlockPlace) -> Self {
        let mut res = self;
        let sheet_nav = res.sheet_navs.get_mut(&sheet_id);
        match sheet_nav {
            Some(sn) => {
                sn.data.blocks.insert(block_id, bp);
                res
            }
            None => res,
        }
    }

    pub fn clean_cache(&mut self, sheet_id: SheetId) {
        if let Some(sn) = self.sheet_navs.get_mut(&sheet_id) {
            sn.cache = Cache::default();
        }
    }
}

fn intersect(start1: usize, end1: usize, start2: usize, end2: usize) -> bool {
    if start1 > end2 || start2 > end1 {
        false
    } else {
        true
    }
}
