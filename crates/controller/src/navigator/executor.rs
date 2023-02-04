use super::{sheet_nav::Cache, SheetNav};
use crate::payloads::sheet_process::{Direction, LineShift, ShiftPayload, ShiftType};

pub fn execute_shift_payload(sheet_nav: SheetNav, payload: &ShiftPayload) -> SheetNav {
    match payload {
        ShiftPayload::Line(ls) => execute_line_shift(sheet_nav, ls),
        ShiftPayload::Range(_) => unreachable!(),
    }
}

fn execute_line_shift(sheet_nav: SheetNav, ls: &LineShift) -> SheetNav {
    match (&ls.ty, &ls.direction) {
        (ShiftType::Delete, Direction::Horizontal) => {
            delete_rows(sheet_nav, ls.start as usize, ls.cnt)
        }
        (ShiftType::Delete, Direction::Vertical) => {
            delete_cols(sheet_nav, ls.start as usize, ls.cnt)
        }
        (ShiftType::Insert, Direction::Horizontal) => {
            insert_new_rows(sheet_nav, ls.start as usize, ls.cnt)
        }
        (ShiftType::Insert, Direction::Vertical) => {
            insert_new_cols(sheet_nav, ls.start as usize, ls.cnt)
        }
    }
}

fn insert_new_rows(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let version = sheet_nav.version + 1;
    let mut new_id_manager = sheet_nav.id_manager.clone();
    let new_ids = new_id_manager.get_row_ids(cnt);
    let new_rows = {
        let rows = sheet_nav.data.rows.clone();
        let row_max = rows.len();
        let (mut left, right) = rows.split_at(idx);
        left.append(new_ids.clone());
        left.append(right);
        left.truncate(row_max);
        left
    };
    SheetNav {
        sheet_id: sheet_nav.sheet_id,
        version,
        data: sheet_nav.data.update_rows(new_rows),
        cache: Cache::default(),
        id_manager: new_id_manager,
    }
}

fn insert_new_cols(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let version = sheet_nav.version + 1;
    let mut new_id_manager = sheet_nav.id_manager.clone();
    let new_ids = new_id_manager.get_col_ids(cnt);
    let new_cols = {
        let cols = sheet_nav.data.cols.clone();
        let row_max = cols.len();
        let (mut left, right) = cols.split_at(idx);
        left.append(new_ids.clone());
        left.append(right);
        left.truncate(row_max);
        left
    };
    SheetNav {
        sheet_id: sheet_nav.sheet_id,
        version,
        data: sheet_nav.data.update_cols(new_cols),
        cache: Cache::default(),
        id_manager: new_id_manager,
    }
}

fn delete_rows(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let sheet_id = sheet_nav.sheet_id;
    let mut result = sheet_nav;
    let mut new_id_manager = result.id_manager.clone();
    let new_ids = new_id_manager.get_row_ids(cnt);
    let new_rows = {
        let rows = result.data.rows.clone();
        let removed_cnt = std::cmp::min(rows.len() - idx, cnt as usize);
        let (mut left, right) = rows.split_at(idx);
        left.append(right.skip(removed_cnt));
        left.append(new_ids.clone());
        left
    };
    let new_blocks = {
        let mut old_blocks = result.data.blocks.clone();
        old_blocks.iter_mut().for_each(|(_, bp)| {
            let master = &bp.master;
            let (row, col) = result.get_fetcher().get_norm_cell_idx(master).unwrap();
            if row >= idx && row <= idx + cnt as usize - 1 {
                let new_row = idx + cnt as usize;
                let new_master_id = result.get_fetcher().get_norm_cell_id(new_row, col);
                bp.master = new_master_id;
            }
        });
        old_blocks
    };
    SheetNav {
        sheet_id,
        version: result.version + 1,
        data: result.data.update_rows(new_rows).update_blocks(new_blocks),
        cache: Cache::default(),
        id_manager: new_id_manager,
    }
}

fn delete_cols(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let sheet_id = sheet_nav.sheet_id;
    let mut result = sheet_nav;
    let version = result.version.clone() + 1;
    let mut new_id_manager = result.id_manager.clone();
    let new_ids = new_id_manager.get_col_ids(cnt);
    let new_cols = {
        let cols = result.data.cols.clone();
        let removed_cnt = std::cmp::min(cols.len() - idx, cnt as usize);
        let (mut left, right) = cols.split_at(idx);
        left.append(right.skip(removed_cnt));
        left.append(new_ids.clone());
        left
    };
    let new_blocks = {
        let mut old_blocks = result.data.blocks.clone();
        old_blocks.iter_mut().for_each(|(_, bp)| {
            let master = &bp.master;
            let (row, col) = result.get_fetcher().get_norm_cell_idx(master).unwrap();
            if col >= idx && col <= idx + cnt as usize - 1 {
                let new_col = idx + cnt as usize;
                let new_master_id = result.get_fetcher().get_norm_cell_id(row, new_col);
                bp.master = new_master_id;
            }
        });
        old_blocks
    };
    SheetNav {
        sheet_id,
        version,
        data: result.data.update_cols(new_cols).update_blocks(new_blocks),
        cache: Cache::default(),
        id_manager: new_id_manager,
    }
}

#[cfg(test)]
mod tests {
    use im::Vector;

    use super::{delete_cols, delete_rows};
    use crate::navigator::sheet_nav::SheetNav;

    #[test]
    fn delete_row_test() {
        let sheet_nav = SheetNav::init(5, 5, 0);
        assert_eq!(&sheet_nav.data.rows, &Vector::from(vec![0, 1, 2, 3, 4]));
        let new_sheet_nav = delete_rows(sheet_nav, 1, 1);
        assert_eq!(&new_sheet_nav.data.rows, &Vector::from(vec![0, 2, 3, 4, 5]));
    }

    #[test]
    fn delete_col_test() {
        let sheet_nav = SheetNav::init(5, 5, 0);
        assert_eq!(&sheet_nav.data.cols, &Vector::from(vec![0, 1, 2, 3, 4]));
        let new_sheet_nav = delete_cols(sheet_nav, 1, 1);
        assert_eq!(&new_sheet_nav.data.cols, &Vector::from(vec![0, 2, 3, 4, 5]));
    }
}
