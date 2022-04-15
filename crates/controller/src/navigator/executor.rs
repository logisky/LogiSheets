use super::{
    sheet_nav::{Cache, ChangeType, IndexChange},
    SheetNav,
};
use crate::payloads::sheet_process::{Direction, LineShift, RangeShift, ShiftPayload, ShiftType};

pub fn execute_shift_payload(sheet_nav: SheetNav, payload: &ShiftPayload) -> SheetNav {
    match payload {
        ShiftPayload::Line(ls) => execute_line_shift(sheet_nav, ls),
        ShiftPayload::Range(rs) => execute_range_shift(sheet_nav, rs),
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

fn execute_range_shift(sheet_nav: SheetNav, rs: &RangeShift) -> SheetNav {
    match (&rs.ty, &rs.direction) {
        (ShiftType::Delete, Direction::Horizontal) => delete_horizontal_range(
            sheet_nav,
            rs.row as usize,
            rs.col as usize,
            rs.row_cnt,
            rs.col_cnt,
        ),
        (ShiftType::Delete, Direction::Vertical) => delete_vertical_range(
            sheet_nav,
            rs.row as usize,
            rs.col as usize,
            rs.row_cnt,
            rs.col_cnt,
        ),
        (ShiftType::Insert, Direction::Horizontal) => insert_horizontal_range(
            sheet_nav,
            rs.row as usize,
            rs.col as usize,
            rs.row_cnt,
            rs.col_cnt,
        ),
        (ShiftType::Insert, Direction::Vertical) => insert_vertical_range(
            sheet_nav,
            rs.row as usize,
            rs.col as usize,
            rs.row_cnt,
            rs.col_cnt,
        ),
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
    let new_row_version = {
        let row_version = sheet_nav.data.row_version.clone();
        new_ids
            .into_iter()
            .fold(row_version, |prev, id| prev.update(id, version))
    };
    SheetNav {
        version,
        data: sheet_nav
            .data
            .update_rows(new_rows)
            .update_row_version(new_row_version),
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
    let new_col_version = {
        let row_version = sheet_nav.data.row_version.clone();
        new_ids
            .into_iter()
            .fold(row_version, |prev, id| prev.update(id, version))
    };
    SheetNav {
        version,
        data: sheet_nav
            .data
            .update_cols(new_cols)
            .update_col_version(new_col_version),
        cache: Cache::default(),
        id_manager: new_id_manager,
    }
}

fn delete_rows(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let mut result = sheet_nav;
    let version = result.version.clone() + 1;
    let mut new_id_manager = result.id_manager.clone();
    let new_ids = new_id_manager.get_row_ids(cnt);
    let new_rows = {
        let rows = result.data.rows.clone();
        log!("delete rows:{}", idx);
        let removed_cnt = std::cmp::min(rows.len() - idx, cnt as usize);
        let (mut left, right) = rows.split_at(idx);
        left.append(right.skip(removed_cnt));
        left.append(new_ids.clone());
        left
    };
    let new_row_version = {
        let row_version = result.data.row_version.clone();
        new_ids
            .into_iter()
            .fold(row_version, |prev, id| prev.update(id, version))
    };
    let new_blocks = {
        let mut old_blocks = result.data.blocks.clone();
        old_blocks.iter_mut().for_each(|(_, bp)| {
            let master = &bp.master;
            let (row, col) = result.get_fetcher().get_norm_cell_idx(master).unwrap();
            if row >= idx && row <= idx + cnt as usize - 1 {
                let new_row = idx + cnt as usize;
                let new_master_id = result.get_fetcher().get_norm_cell_id(new_row, col).unwrap();
                bp.master = new_master_id;
            }
        });
        old_blocks
    };
    SheetNav {
        version: result.version + 1,
        data: result
            .data
            .update_rows(new_rows)
            .update_row_version(new_row_version)
            .update_blocks(new_blocks),
        cache: Cache::default(),
        id_manager: new_id_manager,
    }
}

fn delete_cols(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
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
    let new_col_version = {
        let col_version = result.data.col_version.clone();
        new_ids
            .into_iter()
            .fold(col_version, |prev, id| prev.update(id, version))
    };
    let new_blocks = {
        let mut old_blocks = result.data.blocks.clone();
        old_blocks.iter_mut().for_each(|(_, bp)| {
            let master = &bp.master;
            let (row, col) = result.get_fetcher().get_norm_cell_idx(master).unwrap();
            if col >= idx && col <= idx + cnt as usize - 1 {
                let new_col = idx + cnt as usize;
                let new_master_id = result.get_fetcher().get_norm_cell_id(row, new_col).unwrap();
                bp.master = new_master_id;
            }
        });
        old_blocks
    };
    SheetNav {
        version,
        data: result
            .data
            .update_cols(new_cols)
            .update_col_version(new_col_version)
            .update_blocks(new_blocks),
        cache: Cache::default(),
        id_manager: new_id_manager,
    }
}

fn delete_horizontal_range(
    sheet_nav: SheetNav,
    row: usize,
    col: usize,
    row_cnt: u32,
    col_cnt: u32,
) -> SheetNav {
    let mut new_id_manager = sheet_nav.id_manager.clone();
    let end_row = row + row_cnt as usize - 1;
    let mut cols_copy = sheet_nav.data.cols.clone();
    let col_ids = cols_copy.split_off(cols_copy.len() - row_cnt as usize);
    let free_id = new_id_manager.get_preserved_row_ids(col_ids);
    let change = IndexChange {
        free_id,
        offset: col_cnt,
        version: sheet_nav.version,
        start: col,
        ty: ChangeType::Delete,
    };
    let new_data = sheet_nav
        .data
        .rows
        .clone()
        .slice(row..end_row + 1)
        .into_iter()
        .fold(sheet_nav.data, |prev, row_id| {
            prev.add_row_index_change(row_id, change.clone())
        });
    SheetNav {
        data: new_data,
        version: sheet_nav.version + 1,
        id_manager: sheet_nav.id_manager,
        cache: Cache::default(),
    }
}

fn delete_vertical_range(
    sheet_nav: SheetNav,
    row: usize,
    col: usize,
    row_cnt: u32,
    col_cnt: u32,
) -> SheetNav {
    let mut new_id_manager = sheet_nav.id_manager.clone();
    let end_col = col + col_cnt as usize - 1;
    let mut rows_copy = sheet_nav.data.rows.clone();
    let row_ids = rows_copy.split_off(rows_copy.len() - row_cnt as usize);
    let free_id = new_id_manager.get_preserved_row_ids(row_ids);
    let change = IndexChange {
        free_id,
        offset: row_cnt,
        version: sheet_nav.version,
        start: row,
        ty: ChangeType::Delete,
    };
    let new_data = sheet_nav
        .data
        .cols
        .clone()
        .slice(col..end_col + 1)
        .into_iter()
        .fold(sheet_nav.data, |prev, col_id| {
            prev.add_col_index_change(col_id, change.clone())
        });
    SheetNav {
        data: new_data,
        version: sheet_nav.version + 1,
        id_manager: sheet_nav.id_manager,
        cache: Cache::default(),
    }
}

fn insert_horizontal_range(
    sheet_nav: SheetNav,
    row: usize,
    col: usize,
    row_cnt: u32,
    col_cnt: u32,
) -> SheetNav {
    let mut new_id_manager = sheet_nav.id_manager.clone();
    let end_row = row + row_cnt as usize - 1;
    let end_col = col + col_cnt as usize - 1;
    let col_ids = sheet_nav.data.cols.clone().slice(col..end_col + 1);
    let free_id = new_id_manager.get_preserved_col_ids(col_ids);
    let index_change = IndexChange {
        free_id,
        offset: col_cnt,
        version: sheet_nav.version,
        start: col,
        ty: ChangeType::Insert,
    };
    let new_data = sheet_nav
        .data
        .rows
        .clone()
        .slice(row..end_row + 1)
        .into_iter()
        .fold(sheet_nav.data, |prev, row_id| {
            prev.add_row_index_change(row_id, index_change.clone())
        });
    SheetNav {
        data: new_data,
        version: sheet_nav.version + 1,
        id_manager: sheet_nav.id_manager,
        cache: Cache::default(),
    }
}

fn insert_vertical_range(
    sheet_nav: SheetNav,
    row: usize,
    col: usize,
    row_cnt: u32,
    col_cnt: u32,
) -> SheetNav {
    let mut new_id_manager = sheet_nav.id_manager.clone();
    let end_row = row + row_cnt as usize - 1;
    let end_col = col + col_cnt as usize - 1;
    let row_ids = sheet_nav.data.rows.clone().slice(row..end_row + 1);
    let free_id = new_id_manager.get_preserved_row_ids(row_ids);
    let index_change = IndexChange {
        free_id,
        offset: row_cnt,
        version: sheet_nav.version,
        start: row,
        ty: ChangeType::Insert,
    };
    let new_data = sheet_nav
        .data
        .cols
        .clone()
        .slice(col..end_col + 1)
        .into_iter()
        .fold(sheet_nav.data, |prev, col_id| {
            prev.add_col_index_change(col_id, index_change.clone())
        });
    SheetNav {
        data: new_data,
        version: sheet_nav.version + 1,
        id_manager: sheet_nav.id_manager,
        cache: Cache::default(),
    }
}

#[cfg(test)]
mod tests {
    use im::Vector;

    use super::{delete_cols, delete_rows};
    use crate::navigator::sheet_nav::SheetNav;

    #[test]
    fn delete_row_test() {
        let sheet_nav = SheetNav::init(5, 5);
        assert_eq!(&sheet_nav.data.rows, &Vector::from(vec![0, 1, 2, 3, 4]));
        let new_sheet_nav = delete_rows(sheet_nav, 1, 1);
        assert_eq!(&new_sheet_nav.data.rows, &Vector::from(vec![0, 2, 3, 4, 5]));
    }

    #[test]
    fn delete_col_test() {
        let sheet_nav = SheetNav::init(5, 5);
        assert_eq!(&sheet_nav.data.cols, &Vector::from(vec![0, 1, 2, 3, 4]));
        let new_sheet_nav = delete_cols(sheet_nav, 1, 1);
        assert_eq!(&new_sheet_nav.data.cols, &Vector::from(vec![0, 2, 3, 4, 5]));
    }
}
