use imbl::Vector;
use logisheets_base::{ColId, NormalCellId, RowId};

use crate::edit_action::ModifyPolicy;

#[derive(Debug, Clone)]
pub struct BlockPlace {
    pub master: NormalCellId,
    pub rows: Vector<RowId>,
    pub cols: Vector<ColId>,
    next_avail_row: RowId,
    next_avail_col: ColId,
    pub owner: String,
    pub modify_policy: ModifyPolicy,
}

impl BlockPlace {
    pub fn new(
        master: NormalCellId,
        row_cnt: u32,
        col_cnt: u32,
        owner: String,
        modify_policy: ModifyPolicy,
    ) -> Self {
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
            owner,
            modify_policy,
        }
    }

    pub fn resize(self, row_cnt: Option<usize>, col_cnt: Option<usize>) -> Self {
        let mut result = self;

        let row_cnt = row_cnt.unwrap_or(result.rows.len());
        let col_cnt = col_cnt.unwrap_or(result.cols.len());
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
            owner: result.owner,
            modify_policy: result.modify_policy,
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
            owner: self.owner,
            modify_policy: self.modify_policy,
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
            owner: self.owner,
            modify_policy: self.modify_policy,
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
            owner: self.owner,
            modify_policy: self.modify_policy,
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
            owner: self.owner,
            modify_policy: self.modify_policy,
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

    pub fn move_line(self, from: usize, to: usize, is_row: bool) -> Self {
        let mut result = self;
        if is_row {
            let item = result.rows.remove(from);
            result.rows.insert(to, item);
        } else {
            let item = result.cols.remove(from);
            result.cols.insert(to, item);
        }
        result
    }

    pub fn reorder_lines(self, new_order: &[usize], is_row: bool) -> Self {
        let mut result = self;
        if is_row {
            let old = result.rows.clone();
            result.rows = new_order.iter().map(|&i| old[i]).collect();
        } else {
            let old = result.cols.clone();
            result.cols = new_order.iter().map(|&i| old[i]).collect();
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use imbl::Vector;

    fn dummy_block_place(rows: Vector<RowId>, cols: Vector<ColId>) -> BlockPlace {
        BlockPlace {
            master: NormalCellId { row: 0, col: 0 },
            rows,
            cols,
            next_avail_row: 0,
            next_avail_col: 0,
            owner: String::new(),
            modify_policy: ModifyPolicy::All,
        }
    }

    #[test]
    fn test_move_line_row_down() {
        let bp = dummy_block_place(Vector::from(vec![0, 1, 2, 3]), Vector::new());
        let bp = bp.move_line(0, 2, true);
        assert_eq!(bp.rows, Vector::from(vec![1, 2, 0, 3]));
    }

    #[test]
    fn test_move_line_row_up() {
        let bp = dummy_block_place(Vector::from(vec![0, 1, 2, 3]), Vector::new());
        let bp = bp.move_line(3, 1, true);
        assert_eq!(bp.rows, Vector::from(vec![0, 3, 1, 2]));
    }

    #[test]
    fn test_move_line_col() {
        let bp = dummy_block_place(Vector::new(), Vector::from(vec![10, 20, 30, 40]));
        let bp = bp.move_line(1, 3, false);
        assert_eq!(bp.cols, Vector::from(vec![10, 30, 40, 20]));
    }

    #[test]
    fn test_reorder_lines_row() {
        let bp = dummy_block_place(Vector::from(vec![0, 1, 2, 3]), Vector::new());
        let bp = bp.reorder_lines(&[3, 0, 2, 1], true);
        assert_eq!(bp.rows, Vector::from(vec![3, 0, 2, 1]));
    }

    #[test]
    fn test_reorder_lines_col() {
        let bp = dummy_block_place(Vector::new(), Vector::from(vec![10, 20, 30, 40]));
        let bp = bp.reorder_lines(&[2, 0, 3, 1], false);
        assert_eq!(bp.cols, Vector::from(vec![30, 10, 40, 20]));
    }
}
