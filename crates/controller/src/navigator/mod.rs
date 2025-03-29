use crate::lock::locked_write;
use im::HashMap;
use logisheets_base::{
    errors::BasicError, BlockCellId, BlockId, CellId, ColId, NormalCellId, RowId, SheetId,
};

pub use self::{block::BlockPlace, sheet_nav::SheetNav};

mod block;
pub mod ctx;
mod executor;
mod fetcher;
mod id_manager;
mod sheet_nav;
pub use executor::NavExecutor;

#[derive(Debug, Clone, Default)]
pub struct Navigator {
    pub sheet_navs: HashMap<SheetId, SheetNav>,
}

impl Navigator {
    pub fn fetch_row_id(&self, sheet_id: &SheetId, row: usize) -> Result<RowId, BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        let row_id = fetcher.get_row_id(row);
        Ok(row_id)
    }

    pub fn fetch_row_idx(&self, sheet_id: &SheetId, row: &RowId) -> Result<usize, BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        fetcher.get_row_idx(*row)
    }

    pub fn fetch_col_id(&self, sheet_id: &SheetId, col: usize) -> Result<ColId, BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        let col_id = fetcher.get_col_id(col.clone());
        Ok(col_id)
    }

    pub fn fetch_col_idx(&self, sheet_id: &SheetId, col: &ColId) -> Result<usize, BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        fetcher.get_col_idx(*col)
    }

    pub fn fetch_cell_id(
        &self,
        sheet_id: &SheetId,
        row: usize,
        col: usize,
    ) -> Result<CellId, BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        fetcher.get_cell_id(row, col)
    }

    pub fn fetch_block_cell_id(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
        row: usize,
        col: usize,
    ) -> Result<BlockCellId, BasicError> {
        let bp = self.get_block_place(sheet_id, block_id)?;
        if let Some((rid, cid)) = bp.get_inner_id(row, col) {
            Ok(BlockCellId {
                block_id: block_id.clone(),
                row: rid,
                col: cid,
            })
        } else {
            Err(BasicError::BlockCellIdNotFound(
                *sheet_id, *block_id, row, col,
            ))
        }
    }

    pub fn fetch_norm_cell_id(
        &self,
        sheet_id: &SheetId,
        row: usize,
        col: usize,
    ) -> Result<NormalCellId, BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        Ok(fetcher.get_norm_cell_id(row, col))
    }

    pub fn fetch_cell_idx(
        &self,
        sheet_id: &SheetId,
        cell_id: &CellId,
    ) -> Result<(usize, usize), BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        fetcher.get_cell_idx(&cell_id)
    }

    pub fn fetch_normal_cell_idx(
        &self,
        sheet_id: &SheetId,
        cell_id: &NormalCellId,
    ) -> Result<(usize, usize), BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        fetcher.get_norm_cell_idx(cell_id)
    }

    pub fn fetch_block_cell_idx(
        &self,
        sheet_id: &SheetId,
        cell_id: &BlockCellId,
    ) -> Result<(usize, usize), BasicError> {
        let fetcher = self.get_sheet_nav(sheet_id)?.get_fetcher();
        fetcher.get_block_cell_idx(cell_id)
    }

    pub fn create_block(
        &mut self,
        sheet_id: &SheetId,
        master: NormalCellId,
        row_cnt: usize,
        col_cnt: usize,
    ) {
        let sheet_nav = self.get_sheet_nav_mut(sheet_id);
        let block_place = BlockPlace::new(master, row_cnt as u32, col_cnt as u32);
        let block_id = sheet_nav.id_manager.get_block_id();
        sheet_nav.data.blocks.insert(block_id, block_place);
        sheet_nav.cache = Default::default();
    }

    pub fn remove_block(&mut self, sheet_id: &SheetId, block_id: &BlockId) {
        let sheet_nav = self.get_sheet_nav_mut(sheet_id);
        sheet_nav.data.blocks.remove(&block_id);
        sheet_nav.cache = Default::default();
    }

    pub fn move_block(
        &mut self,
        sheet_id: &SheetId,
        block_id: &BlockId,
        row_idx: usize,
        col_idx: usize,
    ) {
        if let Ok((row_cnt, col_cnt)) = self.get_block_size(sheet_id, block_id) {
            if !self.any_other_blocks_in(
                *sheet_id,
                *block_id,
                row_idx,
                col_idx,
                row_idx + row_cnt - 1,
                col_idx + col_cnt - 1,
            ) {
                let new_master = self
                    .fetch_norm_cell_id(&sheet_id, row_idx, col_idx)
                    .unwrap();
                let sheet_nav = self.get_sheet_nav_mut(sheet_id);
                if let Some(bp) = sheet_nav.data.blocks.get_mut(&block_id) {
                    bp.master = new_master;
                    sheet_nav.cache = Default::default();
                }
            }
        }
    }

    pub fn delete_sheet(&mut self, sheet_id: &SheetId) {
        self.sheet_navs.remove(&sheet_id);
    }

    pub fn create_sheet(&mut self, sheet_id: SheetId) {
        self.sheet_navs.insert(sheet_id, SheetNav::default());
    }

    pub fn get_affected_blockplace(
        &self,
        sheet_id: &SheetId,
        line_idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Result<Vec<BlockId>, BasicError> {
        let sheet_nav = self
            .sheet_navs
            .get(&sheet_id)
            .ok_or(BasicError::SheetIdNotFound(*sheet_id))?;
        let mut result: Vec<BlockId> = vec![];
        sheet_nav.data.blocks.iter().for_each(|(b_id, bp)| {
            let master = &bp.master;
            let master_idx = self.fetch_normal_cell_idx(sheet_id, &master);
            if let Ok((m_row, m_col)) = master_idx {
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
        Ok(result)
    }

    #[inline]
    pub fn get_block_place(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
    ) -> Result<&BlockPlace, BasicError> {
        let sheet_nav = self
            .sheet_navs
            .get(sheet_id)
            .ok_or(BasicError::SheetIdNotFound(*sheet_id))?;
        let block_place = sheet_nav
            .data
            .blocks
            .get(block_id)
            .ok_or(BasicError::BlockIdNotFound(*sheet_id, *block_id))?;
        Ok(block_place)
    }

    #[inline]
    pub fn get_block_size(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
    ) -> Result<(usize, usize), BasicError> {
        let bp = self.get_block_place(sheet_id, block_id)?;
        Ok(bp.get_block_size())
    }

    #[inline]
    pub fn get_master_cell(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
    ) -> Result<NormalCellId, BasicError> {
        let bp = self.get_block_place(sheet_id, block_id)?;
        let nc = bp.master;
        Ok(nc)
    }

    pub fn add_sheet_id(&mut self, sheet_id: &SheetId) {
        self.get_sheet_nav_mut(sheet_id);
    }

    fn get_sheet_nav_mut(&mut self, sheet_id: &SheetId) -> &mut SheetNav {
        if let Some(_) = self.sheet_navs.get(&sheet_id) {
            self.sheet_navs.get_mut(&sheet_id).unwrap()
        } else {
            self.sheet_navs
                .insert(sheet_id.clone(), SheetNav::default());
            self.sheet_navs.get_mut(&sheet_id).unwrap()
        }
    }

    fn get_sheet_nav(&self, sheet_id: &SheetId) -> Result<&SheetNav, BasicError> {
        self.sheet_navs
            .get(sheet_id)
            .ok_or(BasicError::SheetIdNotFound(*sheet_id))
    }

    pub fn add_block_place(self, sheet_id: SheetId, block_id: BlockId, bp: BlockPlace) -> Self {
        let mut res = self;
        let sheet_nav = res.sheet_navs.get_mut(&sheet_id);
        match sheet_nav {
            Some(sn) => {
                sn.data.blocks.insert(block_id, bp);
                let mut cache = locked_write(&sn.cache);
                cache.clean_cell();
                drop(cache);
                res
            }
            None => res,
        }
    }

    pub fn clean_cache(&mut self, sheet_id: SheetId) {
        if let Some(sn) = self.sheet_navs.get_mut(&sheet_id) {
            sn.cache = Default::default();
        }
    }

    pub fn any_other_blocks_in(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        start_row: usize,
        end_row: usize,
        start_col: usize,
        end_col: usize,
    ) -> bool {
        for i in start_row..=start_col {
            for j in end_row..=end_col {
                let cell_id = self.fetch_cell_id(&sheet_id, i, j).unwrap();
                if let CellId::BlockCell(b) = cell_id {
                    if b.block_id != block_id {
                        return true;
                    }
                }
            }
        }
        false
    }

    pub fn get_available_block_id(&self, sheet_id: &SheetId) -> Result<BlockId, BasicError> {
        let sheet_nav = self.get_sheet_nav(sheet_id)?;
        let bid =
            sheet_nav.data.blocks.iter().fold(
                0 as BlockId,
                |acc, (b_id, _)| {
                    if *b_id > acc {
                        *b_id
                    } else {
                        acc
                    }
                },
            );
        Ok(bid + 1)
    }
}

fn intersect(start1: usize, end1: usize, start2: usize, end2: usize) -> bool {
    if start1 > end2 || start2 > end1 {
        false
    } else {
        true
    }
}
