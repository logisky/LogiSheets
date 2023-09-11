use logisheets_base::block_affect::BlockAffectTrait;
use logisheets_base::errors::BasicError;
use logisheets_base::get_active_sheet::GetActiveSheetTrait;
use logisheets_base::get_book_name::GetBookNameTrait;
use logisheets_base::get_norm_cell_id::GetNormCellIdTrait;
use logisheets_base::get_norm_cells_in_line::GetNormCellsInLineTrait;
use logisheets_base::id_fetcher::IdFetcherTrait;
use logisheets_base::index_fetcher::IndexFetcherTrait;
use logisheets_base::matrix_value::cross_product_usize;
use logisheets_base::{
    BlockCellId, BlockId, CellId, ColId, ExtBookId, FuncId, NameId, NormalCellId, RowId, SheetId,
    TextId,
};

use crate::container::DataContainer;
use crate::ext_book_manager::ExtBooksManager;
use crate::id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager};
use crate::navigator::Navigator;
use crate::workbook::sheet_pos_manager::SheetPosManager;

use super::{IdFetcher, IndexFetcher};

type Result<T> = std::result::Result<T, BasicError>;

pub struct VertexConnector<'a> {
    pub book_name: &'a str,
    pub active_sheet: SheetId,
    pub container: &'a mut DataContainer,
    pub sheet_pos_manager: &'a mut SheetPosManager,
    pub sheet_id_manager: &'a mut SheetIdManager,
    pub text_id_manager: &'a mut TextIdManager,
    pub func_id_manager: &'a mut FuncIdManager,
    pub name_id_manager: &'a mut NameIdManager,
    pub id_navigator: &'a mut Navigator,
    pub idx_navigator: &'a mut Navigator,
    pub external_links_manager: &'a mut ExtBooksManager,
}

impl<'a> VertexConnector<'a> {
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

    fn get_idx_fetcher(&self) -> IndexFetcher {
        IndexFetcher {
            navigator: self.idx_navigator,
            sheet_pos_manager: self.sheet_pos_manager,
        }
    }

    fn get_norm_cell_ids_by_line(
        &mut self,
        sheet_id: SheetId,
        idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Vec<NormalCellId> {
        let sheet_container = self.container.data.get(&sheet_id);
        if sheet_container.is_none() {
            return Vec::new();
        }
        let mut result = Vec::<NormalCellId>::new();
        let sheet_container = sheet_container.unwrap();
        sheet_container
            .clone()
            .cells
            .iter()
            .for_each(|(cid, _)| match cid {
                CellId::NormalCell(nc) => {
                    let cidx = self.fetch_cell_index(&sheet_id, cid);
                    match cidx {
                        Ok((r, c)) => {
                            if is_row && r >= idx && r <= idx + cnt - 1 {
                                result.push(nc.clone())
                            } else if !is_row && c >= idx && c <= idx + cnt - 1 {
                                result.push(nc.clone())
                            }
                        }
                        Err(_) => {}
                    }
                }
                CellId::BlockCell(_) => {}
            });
        result
    }
}

impl<'a> IdFetcherTrait for VertexConnector<'a> {
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
}

impl<'a> IndexFetcherTrait for VertexConnector<'a> {
    fn fetch_row_index(&self, sheet_id: &SheetId, row_id: &RowId) -> Result<usize> {
        self.get_idx_fetcher().fetch_row_index(sheet_id, row_id)
    }

    fn fetch_col_index(&self, sheet_id: &SheetId, col_id: &ColId) -> Result<usize> {
        self.get_idx_fetcher().fetch_col_index(sheet_id, col_id)
    }

    fn fetch_cell_index(&self, sheet_id: &SheetId, cell_id: &CellId) -> Result<(usize, usize)> {
        self.get_idx_fetcher().fetch_cell_index(sheet_id, cell_id)
    }

    fn fetch_sheet_index(&self, sheet_id: &SheetId) -> Result<usize> {
        self.get_idx_fetcher().fetch_sheet_index(sheet_id)
    }

    fn fetch_normal_cell_index(
        &self,
        sheet_id: &SheetId,
        normal_cell_id: &NormalCellId,
    ) -> Result<(usize, usize)> {
        self.get_idx_fetcher()
            .fetch_normal_cell_index(sheet_id, normal_cell_id)
    }

    fn fetch_block_cell_index(
        &self,
        sheet: &SheetId,
        block_cell_id: &BlockCellId,
    ) -> Result<(usize, usize)> {
        self.get_idx_fetcher()
            .fetch_block_cell_index(sheet, block_cell_id)
    }
}

impl<'a> GetActiveSheetTrait for VertexConnector<'a> {
    fn get_active_sheet(&self) -> SheetId {
        self.active_sheet
    }
}

impl<'a> GetNormCellsInLineTrait for VertexConnector<'a> {
    fn get_norm_cell_ids_by_row(
        &mut self,
        sheet_id: SheetId,
        row: usize,
        cnt: usize,
    ) -> Vec<NormalCellId> {
        self.get_norm_cell_ids_by_line(sheet_id, row, cnt, true)
    }

    fn get_norm_cell_ids_by_col(
        &mut self,
        sheet_id: SheetId,
        col: usize,
        cnt: usize,
    ) -> Vec<NormalCellId> {
        self.get_norm_cell_ids_by_line(sheet_id, col, cnt, false)
    }
}

impl<'a> GetBookNameTrait for VertexConnector<'a> {
    fn get_book_name(&self) -> &str {
        self.book_name
    }
}
impl<'a> BlockAffectTrait for VertexConnector<'a> {
    fn get_all_block_cells(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
    ) -> Result<Vec<BlockCellId>> {
        let bp = self.id_navigator.get_block_place(sheet_id, block_id)?;
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

    fn get_master_cell(&self, sheet_id: SheetId, block_id: BlockId) -> Result<CellId> {
        self.id_navigator.get_master_cell(sheet_id, block_id)
    }

    fn get_block_cells_by_line(
        &self,
        sheet_id: SheetId,
        block_id: BlockId,
        idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Result<Vec<BlockCellId>> {
        let bp = self.id_navigator.get_block_place(sheet_id, block_id)?;
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
        self.id_navigator.get_block_size(sheet_id, block_id)
    }

    fn get_blocks_across_line(
        &mut self,
        sheet_id: SheetId,
        from_idx: usize,
        cnt: usize,
        is_row: bool,
    ) -> Result<Vec<BlockId>> {
        self.id_navigator
            .get_affected_blockplace(&sheet_id, from_idx, cnt, is_row)
    }

    fn any_other_blocks_in(
        &mut self,
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
}

impl<'a> GetNormCellIdTrait for VertexConnector<'a> {
    fn get_norm_cell_id(
        &mut self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
    ) -> Result<NormalCellId> {
        self.id_navigator.fetch_norm_cell_id(&sheet_id, row, col)
    }
}
