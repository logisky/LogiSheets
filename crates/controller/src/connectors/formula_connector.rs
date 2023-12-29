use std::collections::HashSet;

use logisheets_base::block_affect::BlockAffectTrait;
use logisheets_base::errors::BasicError;
use logisheets_base::get_book_name::GetBookNameTrait;
use logisheets_base::id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait, VertexFetcherTrait};
use logisheets_base::matrix_value::cross_product_usize;
use logisheets_base::{
    BlockCellId, BlockId, CellId, ColId, Cube, CubeId, ExtBookId, ExtRef, ExtRefId, FuncId, NameId,
    NormalCellId, Range, RangeId, RowId, SheetId, TextId,
};

use crate::container::DataContainer;
use crate::cube_manager::CubeManager;
use crate::ext_book_manager::ExtBooksManager;
use crate::ext_ref_manager::ExtRefManager;
use crate::formula_manager::ctx::FormulaExecCtx;
use crate::id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager};
use crate::navigator::Navigator;
use crate::range_manager::RangeManager;
use crate::workbook::sheet_pos_manager::SheetPosManager;

use super::IdFetcher;

type Result<T> = std::result::Result<T, BasicError>;

pub struct FormulaConnector<'a> {
    pub book_name: &'a str,
    pub container: &'a mut DataContainer,
    pub sheet_pos_manager: &'a mut SheetPosManager,
    pub sheet_id_manager: &'a mut SheetIdManager,
    pub text_id_manager: &'a mut TextIdManager,
    pub func_id_manager: &'a mut FuncIdManager,
    pub range_manager: &'a mut RangeManager,
    pub cube_manager: &'a mut CubeManager,
    pub ext_ref_manager: &'a mut ExtRefManager,
    pub name_id_manager: &'a mut NameIdManager,
    pub id_navigator: &'a Navigator,
    pub idx_navigator: &'a Navigator,
    pub external_links_manager: &'a mut ExtBooksManager,

    pub dirty_ranges: HashSet<(SheetId, RangeId)>,
    pub dirty_cubes: HashSet<CubeId>,
}

impl<'a> FormulaConnector<'a> {
    fn get_id_fetcher(&mut self) -> IdFetcher {
        IdFetcher {
            sheet_id_manager: self.sheet_id_manager,
            text_id_manager: self.text_id_manager,
            func_id_manager: self.func_id_manager,
            name_id_manager: self.name_id_manager,
            external_links_manager: self.external_links_manager,
            navigator: self.id_navigator,
        }
    }
}

impl<'a> IdFetcherTrait for FormulaConnector<'a> {
    fn fetch_row_id(&self, sheet_id: &SheetId, row_idx: usize) -> Result<RowId> {
        self.id_navigator.fetch_row_id(sheet_id, row_idx)
    }

    fn fetch_col_id(&self, sheet_id: &SheetId, col_idx: usize) -> Result<ColId> {
        self.id_navigator.fetch_col_id(sheet_id, col_idx)
    }

    fn fetch_cell_id(&self, sheet_id: &SheetId, row_idx: usize, col_idx: usize) -> Result<CellId> {
        self.id_navigator.fetch_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_sheet_id(&mut self, sheet_name: &str) -> SheetId {
        self.get_id_fetcher().fetch_sheet_id(sheet_name)
    }

    fn fetch_name_id(&mut self, workbook: &Option<&str>, name: &str) -> NameId {
        self.get_id_fetcher().fetch_name_id(workbook, name)
    }

    fn fetch_ext_book_id(&mut self, book: &str) -> ExtBookId {
        self.get_id_fetcher().fetch_ext_book_id(book)
    }

    fn fetch_text_id(&mut self, text: &str) -> TextId {
        self.get_id_fetcher().fetch_text_id(text)
    }

    fn fetch_func_id(&mut self, func_name: &str) -> FuncId {
        self.get_id_fetcher().fetch_func_id(func_name)
    }

    fn fetch_norm_cell_id(
        &self,
        sheet_id: &SheetId,
        row_idx: usize,
        col_idx: usize,
    ) -> Result<NormalCellId> {
        self.id_navigator
            .fetch_norm_cell_id(sheet_id, row_idx, col_idx)
    }

    fn fetch_block_cell_id(
        &self,
        sheet_id: &SheetId,
        block_id: &BlockId,
        row: usize,
        col: usize,
    ) -> Result<BlockCellId> {
        self.id_navigator
            .fetch_block_cell_id(sheet_id, block_id, row, col)
    }
}

impl<'a> GetBookNameTrait for FormulaConnector<'a> {
    fn get_book_name(&self) -> &str {
        self.book_name
    }
}
impl<'a> BlockAffectTrait for FormulaConnector<'a> {
    fn get_all_block_cells(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Result<Vec<BlockCellId>> {
        let bp = self.id_navigator.get_block_place(&sheet_id, &block_id)?;
        let mut res = Vec::<BlockCellId>::new();
        bp.rows.iter().for_each(|r| {
            bp.cols.iter().for_each(|c| {
                let bid = BlockCellId {
                    block_id,
                    row: r.clone(),
                    col: c.clone(),
                };
                res.push(bid)
            })
        });
        Ok(res)
    }

    fn get_master_cell(&self, sheet_id: SheetId, block_id: BlockId) -> Result<NormalCellId> {
        self.id_navigator.get_master_cell(&sheet_id, &block_id)
    }

    fn get_block_cells_by_line(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Result<Vec<BlockCellId>> {
        let bp = self.id_navigator.get_block_place(&sheet_id, &block_id)?;
        let (row_cnt, col_cnt) = bp.get_block_size();
        let (sr, sc, er, ec) = if is_row {
            let start_row = idx;
            let end_row = start_row + cnt - 1;
            (start_row, 0, end_row, col_cnt - 1)
        } else {
            let start_col = idx;
            let end_col = start_col + cnt - 1;
            (0, start_col, row_cnt - 1, end_col)
        };
        let cells = cross_product_usize(sr, er, sc, ec).into_iter().fold(
            Vec::new(),
            |prev, (r, c)| match bp.get_inner_id(r, c) {
                Some((rid, cid)) => {
                    let bid = BlockCellId {
                        block_id,
                        row: rid,
                        col: cid,
                    };
                    let mut res = prev;
                    res.push(bid);
                    res
                }
                None => prev,
            },
        );
        Ok(cells)
    }

    fn get_block_size(&self, sheet_id: SheetId, block_id: BlockId) -> Result<(usize, usize)> {
        self.id_navigator.get_block_size(&sheet_id, &block_id)
    }

    fn get_blocks_across_line(
        &self,
        sheet_id: SheetId,
        from_idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Result<Vec<BlockId>> {
        self.id_navigator
            .get_affected_blockplace(&sheet_id, from_idx, cnt, is_row)
    }

    fn any_other_blocks_in(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        start_row: usize,
        end_row: usize,
        start_col: usize,
        end_col: usize,
    ) -> bool {
        self.idx_navigator
            .any_other_blocks_in(sheet_id, block_id, start_row, end_row, start_col, end_col)
    }

    fn get_affected_blockplace(
        &self,
        sheet_id: SheetId,
        line_idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> std::prelude::v1::Result<Vec<BlockId>, BasicError> {
        self.id_navigator
            .get_affected_blockplace(&sheet_id, line_idx, cnt, is_row)
    }

    fn get_block_cell_id(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        row: usize,
        col: usize,
    ) -> std::prelude::v1::Result<BlockCellId, BasicError> {
        self.id_navigator
            .fetch_block_cell_id(&sheet_id, &block_id, row, col)
    }
}

impl<'a> VertexFetcherTrait for FormulaConnector<'a> {
    fn fetch_range_id(&mut self, sheet_id: &SheetId, range: &Range) -> RangeId {
        self.range_manager.get_range_id(sheet_id, range)
    }

    fn fetch_cube_id(&mut self, cube: &Cube) -> CubeId {
        self.cube_manager.get_cube_id(cube)
    }

    fn fetch_ext_ref_id(&mut self, ext_ref: &ExtRef) -> ExtRefId {
        self.ext_ref_manager.get_ext_ref_id(ext_ref)
    }
}

impl<'a> SheetIdFetcherByIdxTrait for FormulaConnector<'a> {
    fn fetch_sheet_id_by_index(&self, idx: usize) -> std::prelude::v1::Result<SheetId, usize> {
        self.sheet_pos_manager
            .get_sheet_id(idx)
            .ok_or(self.sheet_pos_manager.pos.len())
    }
}

impl<'a> logisheets_parser::context::ContextTrait for FormulaConnector<'a> {}

impl<'a> FormulaExecCtx for FormulaConnector<'a> {
    fn remove_range_id(&mut self, sheet_id: &SheetId, range_id: &RangeId) {
        self.range_manager.remove_range_id(sheet_id, range_id)
    }

    fn remove_cube_id(&mut self, cube_id: &CubeId) {
        self.cube_manager.remove_cube(cube_id)
    }

    fn remove_ext_ref_id(&mut self, id: &ExtRefId) {
        self.ext_ref_manager.remove_ext_ref_id(id)
    }

    fn get_dirty_range_ids(&self) -> HashSet<(SheetId, RangeId)> {
        self.dirty_ranges.clone()
    }

    fn get_dirty_cube_ids(&self) -> HashSet<CubeId> {
        self.dirty_cubes.clone()
    }
}
