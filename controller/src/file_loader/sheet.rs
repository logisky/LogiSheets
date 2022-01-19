use controller_base::{CellId, CellValue, ExtBookId, SheetId};
use im::{HashMap, HashSet, Vector};
use xlrs_workbook::{
    comments::Comments,
    complex_types::Rst,
    shared_string_table::SstPart,
    simple_types::StSheetState,
    styles::StyleSheetPart,
    workbook::Sheets,
    worksheet::{CellFormula, Cols, SheetData, SheetFormatPr},
};

use super::{id_fetcher::IdFetcher, settings::SettingsLoader};
use crate::{
    cell::Cell,
    cell_attachments::comment::Comment as CtrlComment,
    cell_attachments::{
        comment::{Comments as CtrlComments, SheetComments},
        merge_cell::MergeCells,
    },
    connectors::IndexFetcher,
    container::{col_info_manager::ColInfo, row_info_manager::RowInfo, DataContainer},
    file_loader::utils::parse_range,
    id_manager::{FuncIdManager, NameIdManager, SheetIdManager, TextIdManager},
    navigator::Navigator,
    style_manager::StyleManager,
    vertex_manager::VertexManager,
    workbook::sheet_pos_manager::SheetPosManager,
};

use super::{sst::SstSearcher, style::StyleLoader, utils::parse_cell, vertex::VertexLoader};

pub struct SheetLoader {
    book_name: String,
    style_loader: StyleLoader,
    vertex_loader: VertexLoader,
    text_id_manager: TextIdManager,
    func_id_manager: FuncIdManager,
    sheet_id_manager: SheetIdManager,
    sheet_pos_manager: SheetPosManager,
    name_id_manager: NameIdManager,
    navigator: Navigator,
    container: DataContainer,
    comments: CtrlComments,
    merge_cells: MergeCells,
    sst_searcher: SstSearcher,
    ext_book_recorder: std::collections::HashMap<usize, ExtBookId>,
    settings_loader: SettingsLoader,
}

impl SheetLoader {
    pub fn new(
        book_name: String,
        style_sheet_part: StyleSheetPart,
        sheet_id_manager: SheetIdManager,
        sheet_pos_manager: SheetPosManager,
        name_id_manager: NameIdManager,
        sst_part: SstPart,
        ext_book_recorder: std::collections::HashMap<usize, ExtBookId>,
        settings_loader: SettingsLoader,
    ) -> Self {
        SheetLoader {
            book_name,
            style_loader: StyleLoader::new(style_sheet_part),
            text_id_manager: TextIdManager::new(0),
            func_id_manager: FuncIdManager::new(0),
            name_id_manager,
            sheet_id_manager,
            sheet_pos_manager,
            vertex_loader: VertexLoader::default(),
            navigator: Navigator::default(),
            container: DataContainer::default(),
            comments: CtrlComments::default(),
            merge_cells: MergeCells::default(),
            sst_searcher: SstSearcher::from(sst_part),
            ext_book_recorder,
            settings_loader,
        }
    }

    pub fn load_cols(&mut self, sheet_idx: usize, cols: Vec<Cols>) -> Option<()> {
        let sheet_id = self.get_sheet_id_by_idx(sheet_idx)?;
        cols.into_iter().for_each(|col| {
            col.col.into_iter().for_each(|col| {
                let min = col.min - 1;
                let max = col.max - 1;
                let col_style_id = self.style_loader.convert(col.style as usize).unwrap_or(0);
                (min..max + 1).into_iter().for_each(|col_idx| {
                    let col_id = self
                        .navigator
                        .fetch_col_id(sheet_id, col_idx as usize)
                        .unwrap_or(0);
                    let col_info = ColInfo {
                        best_fit: col.best_fit,
                        collapsed: col.collapsed,
                        custom_width: col.custom_width,
                        hidden: col.hidden,
                        outline_level: col.outline_level as u8,
                        style: col_style_id,
                        width: col.width,
                    };
                    self.container.set_col_info(sheet_id, col_id, col_info);
                });
            })
        });
        Some(())
    }

    pub fn load_sheet_format_pr(&mut self, sheet_idx: usize, pr: SheetFormatPr) -> Option<()> {
        let sheet_id = self.get_sheet_id_by_idx(sheet_idx)?;
        self.settings_loader.load_sheet_format_pr(sheet_id, pr);
        Some(())
    }

    pub fn load_sheet_data(&mut self, sheet_idx: usize, sheet_data: SheetData) -> Option<()> {
        let sheet_id = self.get_sheet_id_by_idx(sheet_idx)?;
        sheet_data.row.into_iter().for_each(|r| {
            let row_style_id = self.style_loader.convert(r.s as usize).unwrap_or(0);
            let row_info = RowInfo {
                collapsed: r.collapsed,
                custom_format: r.custom_format,
                hidden: r.hidden,
                ht: r.ht,
                outline_level: r.outline_level as u8,
                style: row_style_id,
            };
            let row_idx = r.r.unwrap_or(1) as usize - 1;
            let row_id = self.navigator.fetch_row_id(sheet_id, row_idx).unwrap_or(0);
            self.container.set_row_info(sheet_id, row_id, row_info);
            r.c.into_iter().for_each(|c| {
                if c.r.is_none() {
                    return;
                }
                let f = |idx: usize| {
                    self.sst_searcher
                        .get_text_id(idx, &mut self.text_id_manager)
                        .unwrap()
                };
                let value = CellValue::from_cell(&c, f);
                let reference = c.r.unwrap();
                let parse_result = parse_cell(&reference);
                if parse_result.is_none() {
                    log!("{}", &reference);
                    return;
                }
                let (row_idx, col_idx) = parse_result.unwrap();
                let cell_id = self
                    .navigator
                    .fetch_cell_id(sheet_id, row_idx, col_idx)
                    .unwrap();
                let style_id = self.style_loader.convert(c.s as usize).unwrap_or(0);
                let cell = Cell {
                    value,
                    style: style_id,
                };
                self.container.add_cell(sheet_id, cell_id, cell);
                if let Some(cf) = c.f {
                    self.load_cell_formula(sheet_id, cf, row_idx, col_idx);
                }
            });
        });
        Some(())
    }

    fn load_cell_formula(
        &mut self,
        sheet_id: SheetId,
        cf: CellFormula,
        row_idx: usize,
        col_idx: usize,
    ) -> Option<()> {
        let f = cf.f?;
        if let Some(reference) = cf.reference {
            if let Some(((row_start, col_start), (row_end, col_end))) = parse_range(&reference) {
                self.add_shared_formulas(
                    sheet_id, row_idx, col_idx, row_start, col_start, row_end, col_end, &f,
                );
            } else {
                self.add_formula(sheet_id, row_idx, col_idx, &f)
            }
        } else {
            self.add_formula(sheet_id, row_idx, col_idx, &f);
        }
        Some(())
    }

    pub fn load_comments(&mut self, sheet_idx: usize, comments: Comments) {
        let sheet_id = self.sheet_pos_manager.get_sheet_id(sheet_idx);
        if sheet_id.is_none() {
            return;
        }
        let sheet_id = sheet_id.unwrap();
        let authors = comments
            .authors
            .author
            .into_iter()
            .map(|plain_text| plain_text.value)
            .collect::<Vec<_>>();
        let list = comments.comment_list.comment;
        let mut sheet_comments = SheetComments {
            comments: HashMap::new(),
        };
        list.into_iter().for_each(|c| {
            let text = rst_to_plain_text(c.text);
            let author = authors.get(c.author_id).unwrap();
            let author_id = self.comments.authors.get_id(author);
            match parse_cell(&c.reference) {
                Some((row_idx, col_idx)) => {
                    if let Some(cell_id) = self.navigator.fetch_cell_id(sheet_id, row_idx, col_idx)
                    {
                        let ctrl_comment = CtrlComment {
                            author: author_id,
                            text,
                        };
                        sheet_comments.comments.insert(cell_id, ctrl_comment);
                    }
                }
                None => {}
            }
        });
        self.comments.data.insert(sheet_id, sheet_comments);
    }

    pub fn load_merge_cells(
        &mut self,
        sheet_idx: usize,
        cells: xlrs_workbook::worksheet::MergeCells,
    ) {
        let sheet_id = self.sheet_pos_manager.get_sheet_id(sheet_idx);
        if sheet_id.is_none() {
            return;
        }
        let sheet_id = sheet_id.unwrap();
        cells.merge_cell.into_iter().for_each(|mc| {
            let r = mc.reference;
            if let Some(((start_row, start_col), (end_row, end_col))) = parse_range(&r) {
                let start_id = self.navigator.fetch_cell_id(sheet_id, start_row, start_col);
                let end_id = self.navigator.fetch_cell_id(sheet_id, end_row, end_col);
                match (start_id, end_id) {
                    (Some(start), Some(end)) => match (start, end) {
                        (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                            self.merge_cells =
                                self.merge_cells.clone().add_merge_cell(sheet_id, s, e);
                        }
                        _ => {}
                    },
                    _ => {}
                }
            }
        });
    }

    pub fn finish(self) -> SheetLoaderResult {
        SheetLoaderResult {
            navigator: self.navigator,
            vertex_manager: self.vertex_loader.finish(),
            container: self.container,
            sheet_id_manager: self.sheet_id_manager,
            func_id_manager: self.func_id_manager,
            text_id_manager: self.text_id_manager,
            name_id_manager: self.name_id_manager,
            style_manager: self.style_loader.finish(),
            sheet_pos_manager: self.sheet_pos_manager,
            comments: self.comments,
            book_name: self.book_name,
            merge_cells: self.merge_cells,
            settings_loader: self.settings_loader,
        }
    }

    fn get_sheet_id_by_idx(&mut self, idx: usize) -> Option<SheetId> {
        self.sheet_pos_manager.get_sheet_id(idx)
    }

    fn add_formula(&mut self, sheet_id: SheetId, row_idx: usize, col_idx: usize, f: &str) {
        let mut id_fetcher = IdFetcher {
            sheet_id_manager: &mut self.sheet_id_manager,
            text_id_manager: &mut self.text_id_manager,
            func_id_manager: &mut self.func_id_manager,
            name_id_manager: &mut self.name_id_manager,
            navigator: &mut self.navigator,
            recorder: &self.ext_book_recorder,
        };
        self.vertex_loader
            .load_formula(sheet_id, row_idx, col_idx, f, &mut id_fetcher);
    }

    fn add_shared_formulas(
        &mut self,
        sheet_id: SheetId,
        master_row: usize,
        master_col: usize,
        row_start: usize,
        col_start: usize,
        row_end: usize,
        col_end: usize,
        master_formula: &str,
    ) {
        let mut navigator_clone = self.navigator.clone();
        let mut idx_fetcher = IndexFetcher {
            navigator: &mut navigator_clone,
            sheet_pos_manager: &mut self.sheet_pos_manager,
        };
        let mut id_fetcher = IdFetcher {
            sheet_id_manager: &mut self.sheet_id_manager,
            text_id_manager: &mut self.text_id_manager,
            func_id_manager: &mut self.func_id_manager,
            name_id_manager: &mut self.name_id_manager,
            navigator: &mut self.navigator,
            recorder: &self.ext_book_recorder,
        };
        self.vertex_loader.load_shared_formulas(
            sheet_id,
            master_row,
            master_col,
            row_start,
            col_start,
            row_end,
            col_end,
            master_formula,
            &mut id_fetcher,
            &mut idx_fetcher,
        )
    }
}

pub struct SheetLoaderResult {
    pub book_name: String,
    pub navigator: Navigator,
    pub vertex_manager: VertexManager,
    pub container: DataContainer,
    pub sheet_id_manager: SheetIdManager,
    pub func_id_manager: FuncIdManager,
    pub text_id_manager: TextIdManager,
    pub name_id_manager: NameIdManager,
    pub style_manager: StyleManager,
    pub sheet_pos_manager: SheetPosManager,
    pub comments: CtrlComments,
    pub merge_cells: MergeCells,
    pub settings_loader: SettingsLoader,
}

pub fn load_sheet_tab(sheets: Sheets) -> (SheetIdManager, SheetPosManager) {
    let mut id_manager = SheetIdManager::new(0);
    let (ids, hiddens) = sheets.sheet.into_iter().fold(
        (Vector::<SheetId>::new(), HashSet::<SheetId>::new()),
        |(mut ids, hiddens), s| {
            let name = s.name;
            let id = id_manager.registry(name);
            ids.push_back(id);
            if !matches!(s.state, StSheetState::Type::Visible) {
                (ids, hiddens.update(id))
            } else {
                (ids, hiddens)
            }
        },
    );
    (id_manager, SheetPosManager { pos: ids, hiddens })
}

fn rst_to_plain_text(rst: Rst) -> String {
    match rst.t {
        Some(p) => p.value,
        None => {
            let mut result = String::from("");
            rst.r.into_iter().for_each(|relt| {
                let s = relt.t.value;
                result.push_str(s.as_str());
            });
            result
        }
    }
}
