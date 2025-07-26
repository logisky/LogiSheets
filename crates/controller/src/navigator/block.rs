use im::Vector;
use logisheets_base::{ColId, NormalCellId, RowId};

#[derive(Debug, Clone)]
pub struct BlockPlace {
    pub master: NormalCellId,
    pub rows: Vector<RowId>,
    pub cols: Vector<ColId>,
    next_avail_row: RowId,
    next_avail_col: ColId,
}

impl BlockPlace {
    pub fn new(master: NormalCellId, row_cnt: u32, col_cnt: u32) -> Self {
        let rows = (0..row_cnt).collect::<Vector<RowId>>();
        let cols = (0..col_cnt).collect::<Vector<ColId>>();
        let next_avail_row = row_cnt as RowId;
        let next_avail_col = col_cnt as ColId;
        BlockPlace {
            master,
            rows,
            cols,
            next_avail_row,
            next_avail_col,
        }
    }

    pub fn resize(self, row_cnt: usize, col_cnt: usize) -> Self {
        let mut result = self;

        let rows = if result.rows.len() >= row_cnt {
            result.rows.take(row_cnt)
        } else {
            let mut new_rows = result.rows;
            while new_rows.len() < row_cnt {
                new_rows.push_back(result.next_avail_row);
                result.next_avail_row += 1;
            }
            new_rows
        };
        let cols = if result.cols.len() >= col_cnt {
            result.cols.take(col_cnt)
        } else {
            let mut new_cols = result.cols;
            while new_cols.len() < col_cnt {
                new_cols.push_back(result.next_avail_col);
                result.next_avail_col += 1;
            }
            new_cols
        };
        BlockPlace {
            master: result.master,
            rows,
            cols,
            next_avail_row: result.next_avail_row,
            next_avail_col: result.next_avail_col,
        }
    }

    pub fn add_new_rows(self, idx: usize, cnt: u32) -> Self {
        let new_next_avail_row = self.next_avail_row + cnt;
        let new_row_ids = (self.next_avail_row..new_next_avail_row)
            .into_iter()
            .collect::<Vector<_>>();
        let (mut left, right) = self.rows.split_at(idx);
        left.append(new_row_ids);
        left.append(right);
        BlockPlace {
            master: self.master,
            rows: left,
            cols: self.cols,
            next_avail_row: new_next_avail_row,
            next_avail_col: self.next_avail_col,
        }
    }

    pub fn add_new_cols(self, idx: usize, cnt: u32) -> Self {
        let new_next_avail_col = self.next_avail_col + cnt;
        let new_col_ids = (self.next_avail_col..new_next_avail_col)
            .into_iter()
            .collect::<Vector<_>>();
        let (mut left, right) = self.cols.split_at(idx);
        left.append(new_col_ids);
        left.append(right);
        BlockPlace {
            master: self.master,
            rows: self.rows,
            cols: left,
            next_avail_row: self.next_avail_row,
            next_avail_col: new_next_avail_col,
        }
    }

    pub fn delete_rows(self, idx: usize, cnt: u32) -> Self {
        let (mut left, right) = self.rows.split_at(idx);
        let (_, right) = right.split_at(cnt as usize);
        left.append(right);
        BlockPlace {
            master: self.master,
            rows: left,
            cols: self.cols,
            next_avail_row: self.next_avail_row,
            next_avail_col: self.next_avail_col,
        }
    }

    pub fn delete_cols(self, idx: usize, cnt: u32) -> Self {
        let (mut left, right) = self.cols.split_at(idx);
        let (_, right) = right.split_at(cnt as usize);
        left.append(right);
        BlockPlace {
            master: self.master,
            rows: self.rows,
            cols: left,
            next_avail_row: self.next_avail_row,
            next_avail_col: self.next_avail_col,
        }
    }

    pub fn get_inner_id(&self, row: usize, col: usize) -> Option<(RowId, ColId)> {
        let rid = self.rows.get(row)?.clone();
        let cid = self.cols.get(col)?.clone();
        Some((rid, cid))
    }

    pub fn get_inner_idx(&self, row: RowId, col: ColId) -> Option<(usize, usize)> {
        let (ridx, _rid) = self.rows.iter().enumerate().find(|(_, r)| **r == row)?;
        let (cidx, _cid) = self.cols.iter().enumerate().find(|(_, c)| **c == col)?;
        Some((ridx, cidx))
    }

    pub fn get_block_size(&self) -> (usize, usize) {
        (self.rows.len(), self.cols.len())
    }
}
