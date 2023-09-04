use std::cell::RefCell;

use super::{
    errors::NavError,
    sheet_nav::{Cache, Data},
};
use anyhow::Result;
use logisheets_base::{BlockCellId, CellId, ColId, NormalCellId, RowId, SheetId};

pub struct Fetcher<'a> {
    sheet_id: SheetId,
    data: &'a Data,
    cache: &'a RefCell<Cache>,
}

impl<'a> Fetcher<'a> {
    pub fn from(data: &'a Data, cache: &'a RefCell<Cache>, sheet_id: SheetId) -> Self {
        Fetcher {
            data,
            cache,
            sheet_id,
        }
    }

    pub fn get_row_id(&self, row: usize) -> RowId {
        let cache = self.cache.borrow();
        let cache_id = cache.row_id.get(&row);
        match cache_id {
            Some(result) => *result,
            None => {
                drop(cache);
                let result = *self.data.rows.get(row).unwrap();
                let mut cache = self.cache.borrow_mut();
                cache.row_id.insert(row, result);
                cache.row_index.insert(result, row);
                result
            }
        }
    }

    pub fn get_row_idx(&self, row: RowId) -> Result<usize> {
        let cache = self.cache.borrow();
        let cache_idx = cache.row_index.get(&row);
        match cache_idx {
            Some(r) => Ok(*r),
            None => {
                drop(cache);
                let idx = self.data.rows.iter().position(|e| *e == row);
                match idx {
                    Some(r) => {
                        let mut cache = self.cache.borrow_mut();
                        cache.row_index.insert(row, r);
                        cache.row_id.insert(r, row);
                        Ok(r)
                    }
                    None => Err(NavError::CannotFetchRowIdx(self.sheet_id, row).into()),
                }
            }
        }
    }

    pub fn get_col_id(&self, col: usize) -> ColId {
        let cache = self.cache.borrow();
        let cache_id = cache.col_id.get(&col);
        match cache_id {
            Some(result) => *result,
            None => {
                drop(cache);
                let result = *self.data.cols.get(col).unwrap();
                let mut cache = self.cache.borrow_mut();
                cache.col_id.insert(col, result);
                cache.col_index.insert(result, col);
                result
            }
        }
    }

    pub fn get_col_idx(&self, col: ColId) -> Result<usize> {
        let cache = self.cache.borrow();
        let cache_idx = cache.col_index.get(&col);
        match cache_idx {
            Some(r) => Ok(*r),
            None => {
                let idx = self.data.cols.iter().position(|e| *e == col);
                match idx {
                    Some(r) => {
                        drop(cache);
                        let mut cache = self.cache.borrow_mut();
                        cache.col_index.insert(col, r);
                        cache.col_id.insert(r, col);
                        Ok(r)
                    }
                    None => Err(NavError::CannotFetchColIdx(self.sheet_id, col).into()),
                }
            }
        }
    }

    pub fn get_cell_id(&self, row: usize, col: usize) -> Result<CellId> {
        if let Some(r) = self.cache.borrow().cell_id.get(&(row, col)) {
            return Ok(r.clone());
        }
        let mut res: Option<CellId> = None;
        for (id, bp) in self.data.blocks.iter() {
            let master = &bp.master;
            let (ridx, cidx) = self.get_norm_cell_idx(master)?;
            if row < ridx || col < cidx {
                continue;
            } else {
                match bp.get_inner_id(row - ridx, col - cidx) {
                    Some((rid, cid)) => {
                        let bid = BlockCellId {
                            block_id: *id,
                            row: rid,
                            col: cid,
                        };
                        res = Some(CellId::BlockCell(bid));
                        break;
                    }
                    None => {}
                }
            }
        }
        if let Some(res) = res {
            self.cache.borrow_mut().cell_id.insert((row, col), res);
            return Ok(res);
        }
        let res = CellId::NormalCell(self.get_norm_cell_id(row, col));
        self.cache.borrow_mut().cell_id.insert((row, col), res);
        Ok(res)
    }

    pub fn get_norm_cell_id(&self, row: usize, col: usize) -> NormalCellId {
        let row_id = self.get_row_id(row);
        let col_id = self.get_col_id(col);
        NormalCellId {
            row: row_id,
            col: col_id,
            follow_row: None,
            follow_col: None,
        }
    }

    pub fn get_block_cell_idx(&self, block_cell_id: &BlockCellId) -> Result<(usize, usize)> {
        let bid = block_cell_id.block_id;
        let bp = self
            .data
            .blocks
            .get(&bid)
            .ok_or(NavError::CannotGetBlockById(self.sheet_id, bid))?;
        let master = &bp.master;
        let (m_row, m_col) = self.get_norm_cell_idx(master)?;
        let (row_idx, col_idx) = bp
            .get_inner_idx(block_cell_id.row, block_cell_id.col)
            .ok_or(NavError::CannotFindIdxInBlock(
                self.sheet_id,
                bid,
                block_cell_id.row,
                block_cell_id.col,
            ))?;
        Ok((row_idx + m_row, col_idx + m_col))
    }

    pub fn get_cell_idx(&self, cell_id: &CellId) -> Result<(usize, usize)> {
        if let Some(r) = self.cache.borrow().cell_idx.get(cell_id) {
            return Ok(r.clone());
        }
        let res = match cell_id {
            CellId::NormalCell(c) => self.get_norm_cell_idx(c),
            CellId::BlockCell(b) => self.get_block_cell_idx(b),
        }?;
        self.cache
            .borrow_mut()
            .cell_idx
            .insert(cell_id.clone(), res);
        Ok(res)
    }

    pub fn get_norm_cell_idx(&self, cell_id: &NormalCellId) -> Result<(usize, usize)> {
        let (row_id, col_id) = {
            if let Some(fr) = cell_id.follow_row {
                (fr, cell_id.col.clone())
            } else if let Some(fc) = cell_id.follow_col {
                (cell_id.row.clone(), fc)
            } else {
                (cell_id.row.clone(), cell_id.col.clone())
            }
        };
        let row_idx = self.get_row_idx(row_id)?;
        let col_idx = self.get_col_idx(col_id)?;
        Ok((row_idx, col_idx))
    }
}
