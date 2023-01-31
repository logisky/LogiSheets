use super::sheet_nav::{Cache, Data};
use logisheets_base::{BlockCellId, CellId, ColId, NormalCellId, RowId};

pub struct Fetcher<'a> {
    data: &'a Data,
    cache: &'a mut Cache,
}

impl<'a> Fetcher<'a> {
    pub fn from(data: &'a Data, cache: &'a mut Cache) -> Self {
        Fetcher { data, cache }
    }

    pub fn get_row_id(&mut self, row: usize) -> Option<RowId> {
        let cache_id = self.cache.row_id.get(&row);
        match cache_id {
            Some(result) => Some(result.clone()),
            None => {
                let id = self.data.rows.get(row);
                match id {
                    Some(r) => {
                        let result = r.clone();
                        self.cache.row_id.insert(row, result);
                        self.cache.row_index.insert(result, row);
                        Some(result)
                    }
                    None => None,
                }
            }
        }
    }

    pub fn get_row_idx(&mut self, row: RowId) -> Option<usize> {
        let cache_idx = self.cache.row_index.get(&row);
        match cache_idx {
            Some(r) => Some(r.clone()),
            None => {
                let idx = self.data.rows.iter().position(|e| *e == row);
                match idx {
                    Some(r) => {
                        self.cache.row_index.insert(row, r);
                        self.cache.row_id.insert(r, row);
                        Some(r)
                    }
                    None => None,
                }
            }
        }
    }

    pub fn get_col_id(&mut self, col: usize) -> Option<ColId> {
        let cache_id = self.cache.col_id.get(&col);
        match cache_id {
            Some(result) => Some(result.clone()),
            None => {
                let id = self.data.cols.get(col);
                match id {
                    Some(r) => {
                        let result = r.clone();
                        self.cache.col_id.insert(col, result);
                        self.cache.col_index.insert(result, col);
                        Some(result)
                    }
                    None => None,
                }
            }
        }
    }

    pub fn get_col_idx(&mut self, col: ColId) -> Option<usize> {
        let cache_idx = self.cache.col_index.get(&col);
        match cache_idx {
            Some(r) => Some(r.clone()),
            None => {
                let idx = self.data.cols.iter().position(|e| *e == col);
                match idx {
                    Some(r) => {
                        self.cache.col_index.insert(col, r);
                        self.cache.col_id.insert(r, col);
                        Some(r)
                    }
                    None => None,
                }
            }
        }
    }

    pub fn get_cell_id(&mut self, row: usize, col: usize) -> Option<CellId> {
        if let Some(r) = self.cache.cell_id.get(&(row, col)) {
            return r.clone();
        }
        let mut res: Option<CellId> = None;
        self.data.blocks.iter().for_each(|(id, bp)| {
            let master = &bp.master;
            let idx = self.get_norm_cell_idx(master);
            match idx {
                Some((ridx, cidx)) => {
                    if row < ridx || col < cidx {
                        {}
                    } else {
                        match bp.get_inner_id(row - ridx, col - cidx) {
                            Some((rid, cid)) => {
                                let bid = BlockCellId {
                                    block_id: *id,
                                    row: rid,
                                    col: cid,
                                };
                                res = Some(CellId::BlockCell(bid));
                            }
                            None => {}
                        }
                    }
                }
                None => {}
            }
        });
        if res.is_some() {
            self.cache.cell_id.insert((row, col), res.clone());
            return res;
        }
        res = self
            .get_norm_cell_id(row, col)
            .and_then(|ncid| Some(CellId::NormalCell(ncid)));
        self.cache.cell_id.insert((row, col), res.clone());
        res
    }

    pub fn get_norm_cell_id(&mut self, row: usize, col: usize) -> Option<NormalCellId> {
        self.get_cell_id_with_version(row, col)
    }

    pub fn get_cell_id_with_version(&mut self, row: usize, col: usize) -> Option<NormalCellId> {
        let row_id = self.get_row_id(row)?;
        let col_id = self.get_col_id(col)?;
        Some(NormalCellId {
            row: row_id,
            col: col_id,
            follow_row: None,
            follow_col: None,
        })
    }

    pub fn get_block_cell_idx(&mut self, block_cell_id: &BlockCellId) -> Option<(usize, usize)> {
        let bid = block_cell_id.block_id;
        let bp = self.data.blocks.get(&bid)?;
        let master = &bp.master;
        let (m_row, m_col) = self.get_norm_cell_idx(master)?;
        let (row_idx, col_idx) = bp.get_inner_idx(block_cell_id.row, block_cell_id.col)?;
        Some((row_idx + m_row, col_idx + m_col))
    }

    pub fn get_cell_idx(&mut self, cell_id: &CellId) -> Option<(usize, usize)> {
        if let Some(r) = self.cache.cell_idx.get(cell_id) {
            return r.clone();
        }
        let res = match cell_id {
            CellId::NormalCell(c) => self.get_norm_cell_idx(c),
            CellId::BlockCell(b) => self.get_block_cell_idx(b),
        };
        self.cache.cell_idx.insert(cell_id.clone(), res.clone());
        res
    }

    pub fn get_norm_cell_idx(&mut self, cell_id: &NormalCellId) -> Option<(usize, usize)> {
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
        Some((row_idx, col_idx))
    }
}
