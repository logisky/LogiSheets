use logisheets_base::{errors::BasicError, CellId};

use super::{ctx::NavExecCtx, BlockPlace, Navigator, SheetNav};
use crate::{edit_action::EditPayload, Error};

pub struct NavExecutor {
    pub nav: Navigator,
}

impl NavExecutor {
    pub fn new(nav: Navigator) -> Self {
        NavExecutor { nav }
    }

    pub fn execute<C: NavExecCtx>(
        mut self,
        ctx: &C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::MoveBlock(move_block) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(move_block.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = self.nav.fetch_cell_id(
                    &sheet_id,
                    move_block.new_master_row,
                    move_block.new_master_col,
                )?;
                if let CellId::BlockCell(id) = cell_id {
                    if id.block_id != move_block.id {
                        return Err(BasicError::CreatingBlockOn(id.block_id).into());
                    }
                }
                self.nav.move_block(
                    &sheet_id,
                    &move_block.id,
                    move_block.new_master_row,
                    move_block.new_master_col,
                );
                Ok((self, true))
            }
            EditPayload::RemoveBlock(remove_block) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(remove_block.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                self.nav.remove_block(&sheet_id, &remove_block.id);
                Ok((self, true))
            }
            EditPayload::CreateBlock(create_block) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(create_block.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = self.nav.fetch_cell_id(
                    &sheet_id,
                    create_block.master_row,
                    create_block.master_col,
                )?;
                if let CellId::BlockCell(id) = cell_id {
                    return Err(BasicError::CreatingBlockOn(id.block_id).into());
                }
                let cell_id = cell_id.assert_normal_cell_id();
                let sheet_nav = self.nav.get_sheet_nav_mut(&sheet_id);
                if sheet_nav.data.has_block_id(&create_block.id) {
                    return Err(BasicError::BlockIdHasAlreadyExisted(create_block.id).into());
                }
                let block_place = BlockPlace::new(
                    cell_id,
                    create_block.row_cnt as u32,
                    create_block.col_cnt as u32,
                );
                let block_id = create_block.id;
                sheet_nav.data.blocks.insert(block_id, block_place);
                sheet_nav.cache = Default::default();
                Ok((self, true))
            }
            EditPayload::ResizeBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let sheet_nav = self.nav.get_sheet_nav_mut(&sheet_id);
                if !sheet_nav.data.has_block_id(&p.id) {
                    return Err(BasicError::BlockIdDoesNotExist(p.id).into());
                }
                let block_place = sheet_nav
                    .data
                    .blocks
                    .get_mut(&p.id)
                    .ok_or(BasicError::BlockIdNotFound(sheet_id, p.id))?
                    .clone();
                let new_block_place = block_place.resize(p.new_row_cnt, p.new_col_cnt);
                sheet_nav.data.blocks.insert(p.id, new_block_place);
                sheet_nav.cache = Default::default();

                Ok((self, true))
            }
            EditPayload::CreateSheet(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                self.nav.create_sheet(sheet_id);
                Ok((self, true))
            }
            EditPayload::DeleteSheet(delete_sheet) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(delete_sheet.idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                self.nav.delete_sheet(&sheet_id);
                Ok((self, true))
            }
            EditPayload::InsertCols(insert_cols) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(insert_cols.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let sheet_nav = self.nav.get_sheet_nav_mut(&sheet_id).clone();
                let new_sheet_nav =
                    insert_new_cols(sheet_nav, insert_cols.start, insert_cols.count as u32);
                let sheet_navs = self.nav.sheet_navs.update(sheet_id, new_sheet_nav);
                let res = NavExecutor {
                    nav: Navigator { sheet_navs },
                };
                Ok((res, true))
            }
            EditPayload::DeleteCols(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let sheet_nav = self.nav.get_sheet_nav_mut(&sheet_id).clone();
                let new_sheet_nav = delete_cols(sheet_nav, p.start, p.count as u32);
                let sheet_navs = self.nav.sheet_navs.update(sheet_id, new_sheet_nav);
                let res = NavExecutor {
                    nav: Navigator { sheet_navs },
                };
                Ok((res, true))
            }
            EditPayload::InsertRows(insert_rows) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(insert_rows.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let sheet_nav = self.nav.get_sheet_nav_mut(&sheet_id).clone();
                let new_sheet_nav =
                    insert_new_rows(sheet_nav, insert_rows.start, insert_rows.count as u32);
                let sheet_navs = self.nav.sheet_navs.update(sheet_id, new_sheet_nav);
                let res = NavExecutor {
                    nav: Navigator { sheet_navs },
                };
                Ok((res, true))
            }
            EditPayload::DeleteRows(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let sheet_nav = self.nav.get_sheet_nav_mut(&sheet_id).clone();
                let new_sheet_nav = delete_rows(sheet_nav, p.start, p.count as u32);
                let sheet_navs = self.nav.sheet_navs.update(sheet_id, new_sheet_nav);
                let res = NavExecutor {
                    nav: Navigator { sheet_navs },
                };
                Ok((res, true))
            }
            EditPayload::InsertColsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let bp = self.nav.get_block_place(&sheet_id, &p.block_id)?.clone();
                let new_bp = bp.add_new_cols(p.start, p.cnt as u32);
                let nav = self.nav.add_block_place(sheet_id, p.block_id, new_bp);
                let result = NavExecutor { nav };
                Ok((result, true))
            }
            EditPayload::DeleteColsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let bp = self.nav.get_block_place(&sheet_id, &p.block_id)?.clone();
                let new_bp = bp.delete_cols(p.start, p.cnt as u32);
                let nav = self.nav.add_block_place(sheet_id, p.block_id, new_bp);
                let result = NavExecutor { nav };
                Ok((result, true))
            }
            EditPayload::InsertRowsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let bp = self.nav.get_block_place(&sheet_id, &p.block_id)?.clone();
                let new_bp = bp.add_new_rows(p.start, p.cnt as u32);
                let nav = self.nav.add_block_place(sheet_id, p.block_id, new_bp);
                let result = NavExecutor { nav };
                Ok((result, true))
            }
            EditPayload::DeleteRowsInBlock(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let bp = self.nav.get_block_place(&sheet_id, &p.block_id)?.clone();
                let new_bp = bp.delete_rows(p.start, p.cnt as u32);
                let nav = self.nav.add_block_place(sheet_id, p.block_id, new_bp);
                let result = NavExecutor { nav };
                Ok((result, true))
            }
            _ => Ok((self, false)),
        }
    }
}

fn insert_new_rows(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
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
        data: sheet_nav.data.update_rows(new_rows),
        cache: Default::default(),
        id_manager: new_id_manager,
    }
}

fn insert_new_cols(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let mut new_id_manager = sheet_nav.id_manager.clone();
    let new_ids = new_id_manager.get_col_ids(cnt);
    let new_cols = {
        let cols = sheet_nav.data.cols.clone();
        let col_max = cols.len();
        let (mut left, right) = cols.split_at(idx);
        left.append(new_ids.clone());
        left.append(right);
        left.truncate(col_max);
        left
    };
    SheetNav {
        sheet_id: sheet_nav.sheet_id,
        data: sheet_nav.data.update_cols(new_cols),
        cache: Default::default(),
        id_manager: new_id_manager,
    }
}

fn delete_rows(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let sheet_id = sheet_nav.sheet_id;
    let result = sheet_nav;
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
        data: result.data.update_rows(new_rows).update_blocks(new_blocks),
        cache: Default::default(),
        id_manager: new_id_manager,
    }
}

fn delete_cols(sheet_nav: SheetNav, idx: usize, cnt: u32) -> SheetNav {
    let sheet_id = sheet_nav.sheet_id;
    let result = sheet_nav;
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
        data: result.data.update_cols(new_cols).update_blocks(new_blocks),
        cache: Default::default(),
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
