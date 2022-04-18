use crate::navigator::sheet_nav::{ChangeType, IndexChange};

use super::sheet_nav::{Cache, Data};
use logisheets_base::{BlockCellId, CellId, ColId, Id, NormalCellId, RowId};

pub struct Fetcher<'a> {
    data: &'a Data,
    cache: &'a mut Cache,
    version: u32,
}

impl<'a> Fetcher<'a> {
    pub fn from(data: &'a Data, cache: &'a mut Cache, version: u32) -> Self {
        Fetcher {
            data,
            cache,
            version,
        }
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
        self.get_cell_id_with_version(row, col, self.version)
    }

    pub fn get_cell_id_with_version(
        &mut self,
        row: usize,
        col: usize,
        version: u32,
    ) -> Option<NormalCellId> {
        let row_id = self.get_row_id(row)?;
        let col_id = self.get_col_id(col)?;
        let row_version = self.data.row_version.get(&row_id).unwrap_or(&0).clone();
        let col_version = self.data.col_version.get(&col_id).unwrap_or(&0).clone();
        if row_version == version || col_version == version {
            return Some(NormalCellId {
                row: row_id,
                col: col_id,
                follow_row: None,
                follow_col: None,
            });
        }
        let row_change = self
            .data
            .row_index_changes
            .get(&row_id)
            .map_or(None, |changes| {
                changes.iter().rev().find(|change| change.version < version)
            });
        let col_change = self
            .data
            .col_index_changes
            .get(&col_id)
            .map_or(None, |changes| {
                changes.iter().rev().find(|change| change.version < version)
            });
        let mut apply_index = |index_change: &IndexChange, is_row: bool| {
            let (target, max) = {
                if is_row {
                    (col, self.data.cols.len())
                } else {
                    (row, self.data.rows.len())
                }
            };
            let apply_result = apply_index_change(index_change, target, max);
            match apply_result {
                ApplyResult::FreeId(id) => {
                    let cell_id = if is_row {
                        NormalCellId {
                            row: id,
                            col: col_id,
                            follow_row: Some(row_id),
                            follow_col: None,
                        }
                    } else {
                        NormalCellId {
                            row: row_id,
                            col: id,
                            follow_row: None,
                            follow_col: Some(col_id),
                        }
                    };
                    Some(cell_id)
                }
                ApplyResult::NewOffset(c) => {
                    let (new_row, new_col) = {
                        if is_row {
                            (row, c)
                        } else {
                            (c, col)
                        }
                    };
                    self.get_cell_id_with_version(new_row, new_col, index_change.version)
                }
            }
        };
        match (row_change, col_change) {
            (None, None) => Some(NormalCellId {
                row: row_id,
                col: col_id,
                follow_row: None,
                follow_col: None,
            }),
            (None, Some(col_change)) => apply_index(col_change, false),
            (Some(row_change), None) => apply_index(row_change, true),
            (Some(r), Some(c)) => {
                if r.version > c.version {
                    apply_index(r, true)
                } else {
                    apply_index(c, false)
                }
            }
        }
    }

    pub fn get_cell_idx(&mut self, cell_id: &CellId) -> Option<(usize, usize)> {
        if let Some(r) = self.cache.cell_idx.get(cell_id) {
            return r.clone();
        }
        let res = match cell_id {
            CellId::NormalCell(c) => self.get_norm_cell_idx(c),
            CellId::BlockCell(b) => {
                let bid = b.block_id;
                let bp = self.data.blocks.get(&bid)?;
                let master = &bp.master;
                let (m_row, m_col) = self.get_norm_cell_idx(master)?;
                let (row_idx, col_idx) = bp.get_inner_idx(b.row, b.col)?;
                Some((row_idx + m_row, col_idx + m_col))
            }
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
        let row_version = self.data.row_version.get(&row_id).unwrap_or(&0).clone();
        let col_version = self.data.col_version.get(&col_id).unwrap_or(&0).clone();
        let start_version = std::cmp::max(row_version, col_version);
        let init_row = self.get_row_idx(row_id)?;
        let init_col = self.get_col_idx(col_id)?;
        self.get_norm_cell_idx_with_version(init_row, init_col, start_version)
    }

    pub fn get_norm_cell_idx_with_version(
        &mut self,
        curr_row: usize,
        curr_col: usize,
        version: u32,
    ) -> Option<(usize, usize)> {
        let row_id = self.get_row_id(curr_row)?;
        let col_id = self.get_col_id(curr_col)?;
        let row_change = self
            .data
            .row_index_changes
            .get(&row_id)
            .map_or(None, |changes| {
                changes.iter().find(|ic| ic.version > version)
            });
        let col_change = self
            .data
            .col_index_changes
            .get(&col_id)
            .map_or(None, |changes| {
                changes.iter().find(|ic| ic.version > version)
            });
        match (row_change, col_change) {
            (None, None) => Some((curr_row, curr_col)),
            (None, Some(_)) => todo!(),
            (Some(_), None) => todo!(),
            (Some(_rc), Some(_cc)) => todo!(),
        }
    }
}

fn apply_index_change(index_change: &IndexChange, curr: usize, max: usize) -> ApplyResult {
    let IndexChange {
        start,
        offset,
        free_id,
        version: _,
        ty,
    } = index_change;
    match ty {
        &ChangeType::Insert => {
            if curr >= start + *offset as usize {
                ApplyResult::NewOffset(curr - *offset as usize)
            } else if curr < *start as usize {
                ApplyResult::NewOffset(curr)
            } else {
                ApplyResult::FreeId(free_id.clone())
            }
        }
        &ChangeType::Delete => {
            if *start <= curr {
                ApplyResult::NewOffset(curr + *offset as usize)
            } else if curr >= max - *offset as usize {
                ApplyResult::FreeId(free_id.clone())
            } else {
                ApplyResult::NewOffset(curr)
            }
        }
    }
}

enum ApplyResult {
    FreeId(Id),
    NewOffset(usize),
}
