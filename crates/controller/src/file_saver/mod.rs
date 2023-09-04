use logisheets_base::{
    index_fetcher::IndexFetcherTrait, name_fetcher::NameFetcherTrait, RowId, SheetId, TextId,
};
use logisheets_workbook::workbook::Workbook;

use crate::{
    ext_book_manager::ExtBooksManager,
    file_saver::workbook::save_workbook,
    formula_manager::FormulaManager,
    id_manager::{errors::IdError, FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
    workbook::sheet_pos_manager::SheetPosManager,
    Controller,
};

pub use self::error::SaveError;

mod error;
mod external_links;
mod sst;
mod styles;
mod utils;
mod workbook;
mod worksheet;

pub fn save_file(controller: &Controller) -> Result<Workbook, SaveError> {
    let func_manager = &controller.status.func_id_manager;
    let external_links_manager = &controller.status.external_links_manager;
    let text_id_manager = &controller.status.text_id_manager;
    let name_id_manager = &controller.status.name_id_manager;
    let formula_manager = &controller.status.formula_manager;

    let data_container = &controller.status.container;
    let attachment_manager = &controller.status.cell_attachment_manager;
    let sheet_pos_manager = &controller.status.sheet_pos_manager;
    let sheet_id_manager = &controller.status.sheet_id_manager;
    let style_manager = &controller.status.style_manager;
    let ext_book_manager = &controller.status.external_links_manager;
    let theme_manager = &controller.settings.theme;

    let settings = &controller.settings;

    let mut navigator_replication = controller.status.navigator.clone();
    let mut saver = Saver {
        part_count: 0,
        external_count: 0,
        func_manager,
        sheet_id_manager,
        external_links_manager,
        text_id_manager,
        name_id_manager,
        navigator: &mut navigator_replication,
        formula_manager,
        sheet_pos_manager,
    };

    save_workbook(
        data_container,
        formula_manager,
        attachment_manager,
        sheet_pos_manager,
        sheet_id_manager,
        style_manager,
        ext_book_manager,
        theme_manager,
        text_id_manager,
        settings,
        &mut saver,
    )
}

pub trait SaverTrait: IndexFetcherTrait + NameFetcherTrait {
    fn fetch_part_id(&mut self) -> String;

    fn fetch_row_id(&mut self, sheet_id: SheetId, idx: usize) -> RowId;
}

pub struct Saver<'a> {
    pub part_count: u32,
    pub external_count: u32,

    pub func_manager: &'a FuncIdManager,
    pub sheet_id_manager: &'a SheetIdManager,
    pub external_links_manager: &'a ExtBooksManager,
    pub text_id_manager: &'a TextIdManager,
    pub name_id_manager: &'a NameIdManager,
    pub navigator: &'a mut Navigator,
    pub formula_manager: &'a FormulaManager,
    pub sheet_pos_manager: &'a SheetPosManager,
}

impl<'a> IndexFetcherTrait for Saver<'a> {
    fn fetch_row_index(&self, sheet_id: &SheetId, row_id: &RowId) -> anyhow::Result<usize> {
        self.navigator.fetch_row_idx(sheet_id, row_id)
    }

    fn fetch_col_index(
        &self,
        sheet_id: &SheetId,
        col_id: &logisheets_base::ColId,
    ) -> anyhow::Result<usize> {
        self.navigator.fetch_col_idx(sheet_id, col_id)
    }

    fn fetch_cell_index(
        &self,
        sheet_id: &SheetId,
        cell_id: &logisheets_base::CellId,
    ) -> anyhow::Result<(usize, usize)> {
        self.navigator.fetch_cell_idx(sheet_id, cell_id)
    }

    fn fetch_sheet_index(&self, sheet_id: &SheetId) -> anyhow::Result<usize> {
        self.sheet_pos_manager
            .get_sheet_idx(sheet_id)
            .ok_or(IdError::SheetIdNotFound(*sheet_id).into())
    }

    fn fetch_normal_cell_index(
        &self,
        sheet_id: &SheetId,
        normal_cell_id: &logisheets_base::NormalCellId,
    ) -> anyhow::Result<(usize, usize)> {
        self.navigator
            .fetch_normal_cell_idx(sheet_id, normal_cell_id)
    }

    fn fetch_block_cell_index(
        &self,
        sheet: &SheetId,
        block_cell_id: &logisheets_base::BlockCellId,
    ) -> anyhow::Result<(usize, usize)> {
        self.navigator.fetch_block_cell_idx(sheet, block_cell_id)
    }
}

impl<'a> NameFetcherTrait for Saver<'a> {
    fn fetch_text(&self, text_id: &TextId) -> String {
        println!("text id: {}", text_id);
        println!("text: {:?}", self.text_id_manager.get_string(text_id));
        self.text_id_manager
            .get_string(text_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_func_name(&self, func_id: &logisheets_base::FuncId) -> String {
        self.func_manager
            .get_string(func_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_sheet_name(&self, sheet_id: &SheetId) -> String {
        self.sheet_id_manager
            .get_string(sheet_id)
            .unwrap_or(String::from("Unknown"))
    }

    fn fetch_book_name(&self, book_id: &logisheets_base::ExtBookId) -> String {
        self.external_links_manager
            .fetch_book_name(book_id)
            .unwrap_or(String::from(""))
    }

    fn fetch_defined_name(&self, nid: &logisheets_base::NameId) -> String {
        match self.name_id_manager.get_string(nid) {
            Some((_, name)) => name,
            None => String::from(""),
        }
    }

    fn fetch_cell_idx(
        &self,
        sheet_id: &SheetId,
        cell_id: &logisheets_base::CellId,
    ) -> (usize, usize) {
        self.navigator.fetch_cell_idx(sheet_id, cell_id).unwrap()
    }

    fn fetch_row_idx(&self, sheet_id: &SheetId, row_id: &RowId) -> usize {
        self.navigator.fetch_row_idx(sheet_id, row_id).unwrap()
    }

    fn fetch_col_idx(&self, sheet_id: &SheetId, col_id: &logisheets_base::ColId) -> usize {
        self.navigator.fetch_col_idx(sheet_id, col_id).unwrap()
    }

    fn fetch_range(
        &self,
        sheet_id: &SheetId,
        range_id: &logisheets_base::RangeId,
    ) -> Option<logisheets_base::Range> {
        self.formula_manager
            .range_manager
            .get_range(sheet_id, range_id)
    }

    fn fetch_cube(&self, cube_id: &logisheets_base::CubeId) -> logisheets_base::Cube {
        self.formula_manager.cube_manager.get_cube(cube_id).unwrap()
    }

    fn fetch_ext_ref(&mut self, ext_ref_id: &logisheets_base::ExtRefId) -> logisheets_base::ExtRef {
        self.formula_manager
            .ext_ref_manager
            .get_ext_ref(ext_ref_id)
            .unwrap()
    }
}

impl<'a> SaverTrait for Saver<'a> {
    fn fetch_part_id(&mut self) -> String {
        self.part_count += 1;
        format!("rId{}", self.part_count)
    }

    fn fetch_row_id(&mut self, sheet_id: SheetId, idx: usize) -> RowId {
        self.navigator.fetch_row_id(&sheet_id, idx).unwrap()
    }
}
