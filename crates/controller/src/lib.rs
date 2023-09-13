#[macro_use]
extern crate lazy_static;

mod async_func_manager;
mod calc_engine;
mod cell;
mod cell_attachments;
mod connectors;
mod container;
pub mod controller;
mod cube_manager;
mod data_executor;
mod errors;
mod ext_book_manager;
mod ext_ref_manager;
mod file_loader2;
mod file_saver;
mod formula_manager;
mod id_manager;
mod navigator;
mod payloads;
mod range_manager;
mod settings;
mod style_manager;
mod theme_manager;
mod workbook;

use crate::errors::Result;
use connectors::NameFetcher;
pub use controller::{
    display::{Comment, MergeCell, Value},
    style::{Border, BorderPr, Fill, Font, Style},
    Controller,
};
use controller::{edit_action::EditAction, style::StyleConverter};
use errors::Error;
use logisheets_base::errors::BasicError;
use logisheets_parser::unparse;
pub use logisheets_workbook::prelude::SerdeErr;

pub use logisheets_base::async_func::AsyncCalcResult;
pub use logisheets_base::async_func::AsyncErr;
pub use logisheets_base::async_func::Task;
pub use logisheets_base::BlockId;
pub use logisheets_base::CellId;
pub use logisheets_base::SheetId;

// Has SKIPPED the '='
pub fn lex_success(f: &str) -> bool {
    let toks = logisheets_lexer::lex(f);
    match toks {
        Some(_) => true,
        None => false,
    }
}

pub struct Workbook {
    controller: Controller,
}

impl Default for Workbook {
    fn default() -> Self {
        Self {
            controller: Default::default(),
        }
    }
}

impl Workbook {
    pub fn handle_action(&mut self, action: EditAction) {
        self.controller.handle_action(action);
    }

    pub fn from_file(buf: &[u8], book_name: String) -> Result<Self> {
        let controller = Controller::from_file(book_name, buf)?;
        Ok(Workbook { controller })
    }

    pub fn save(&self) -> Result<Vec<u8>> {
        self.controller.save()
    }

    pub fn get_sheet_by_name(&mut self, name: &str) -> Result<Worksheet> {
        match self.controller.get_sheet_id_by_name(name) {
            Some(sheet_id) => Ok(Worksheet {
                sheet_id,
                controller: &mut self.controller,
            }),
            None => Err(BasicError::SheetNameNotFound(name.to_string()).into()),
        }
    }

    pub fn get_sheet_idx_by_name(&mut self, name: &str) -> Result<usize> {
        let sheet_id = self.controller.get_sheet_id_by_name(name);
        if let Some(id) = sheet_id {
            if let Some(idx) = self.controller.status.sheet_pos_manager.get_sheet_idx(&id) {
                Ok(idx)
            } else {
                Err(BasicError::SheetNameNotFound(name.to_string()).into())
            }
        } else {
            Err(BasicError::SheetNameNotFound(name.to_string()).into())
        }
    }

    pub fn get_sheet_by_idx(&mut self, idx: usize) -> Result<Worksheet> {
        match self.controller.get_sheet_id_by_idx(idx) {
            Some(sheet_id) => Ok(Worksheet {
                sheet_id,
                controller: &mut self.controller,
            }),
            None => Err(Error::UnavailableSheetIdx(idx)),
        }
    }
}

pub struct Worksheet<'a> {
    sheet_id: SheetId,
    controller: &'a mut Controller,
}

impl<'a> Worksheet<'a> {
    pub fn get_value(&mut self, row: usize, col: usize) -> Result<Value> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        if let Some(cell) = self
            .controller
            .status
            .container
            .get_cell(self.sheet_id, &cell_id)
        {
            let value = &cell.value;
            let v = match value {
                logisheets_base::CellValue::Blank => Value::Empty,
                logisheets_base::CellValue::Boolean(b) => Value::Bool(*b),
                logisheets_base::CellValue::Error(e) => Value::Error(e.to_string()),
                logisheets_base::CellValue::String(s) => {
                    let text = self.controller.status.text_id_manager.get_string(s);
                    match text {
                        Some(r) => Value::Str(r),
                        None => Value::Str(String::from("")),
                    }
                }
                logisheets_base::CellValue::Number(n) => Value::Number(*n),
                logisheets_base::CellValue::InlineStr(_) => Value::Empty,
                logisheets_base::CellValue::FormulaStr(s) => Value::Str(s.to_string()),
            };
            Ok(v)
        } else {
            Ok(Value::Empty)
        }
    }

    pub fn get_formula(&mut self, row: usize, col: usize) -> Result<String> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        if let Some(node) = self
            .controller
            .status
            .formula_manager
            .formulas
            .get(&(self.sheet_id, cell_id))
        {
            let mut name_fetcher = NameFetcher {
                func_manager: &mut self.controller.status.func_id_manager,
                sheet_id_manager: &mut self.controller.status.sheet_id_manager,
                external_links_manager: &mut self.controller.status.external_links_manager,
                text_id_manager: &mut self.controller.status.text_id_manager,
                name_id_manager: &mut self.controller.status.name_id_manager,
                navigator: &mut self.controller.status.navigator,
                formula_manager: &self.controller.status.formula_manager,
            };
            let f = unparse::unparse(node, &mut name_fetcher, self.sheet_id)?;
            Ok(f)
        } else {
            Ok(String::from(""))
        }
    }

    pub fn get_style(&mut self, row: usize, col: usize) -> Result<Style> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        let style_id = if let Some(cell) = self
            .controller
            .status
            .container
            .get_cell(self.sheet_id, &cell_id)
        {
            cell.style
        } else {
            let row_id = self
                .controller
                .status
                .navigator
                .fetch_row_id(&self.sheet_id, row)
                .unwrap();
            if let Some(row_info) = self
                .controller
                .status
                .container
                .get_row_info(self.sheet_id, row_id)
            {
                row_info.style
            } else {
                let col_id = self
                    .controller
                    .status
                    .navigator
                    .fetch_row_id(&self.sheet_id, col)
                    .unwrap();
                match self
                    .controller
                    .status
                    .container
                    .get_col_info(self.sheet_id, col_id)
                {
                    Some(col_info) => col_info.style,
                    None => 0,
                }
            }
        };
        let raw_style = self
            .controller
            .status
            .style_manager
            .get_cell_style(style_id);
        let style_converter = StyleConverter {
            theme_manager: &self.controller.settings.theme,
        };
        Ok(style_converter.convert_style(raw_style))
    }

    pub fn get_merge_cells(&mut self) -> Vec<MergeCell> {
        let merges = self
            .controller
            .status
            .cell_attachment_manager
            .merge_cells
            .data
            .get(&self.sheet_id);
        if let Some(merges) = merges {
            merges
                .clone()
                .iter()
                .fold(vec![], |mut prev, (start, end)| {
                    let s = self
                        .controller
                        .status
                        .navigator
                        .fetch_normal_cell_idx(&self.sheet_id, start);
                    let e = self
                        .controller
                        .status
                        .navigator
                        .fetch_normal_cell_idx(&self.sheet_id, end);
                    match (s, e) {
                        (Ok((row_start, col_start)), Ok((row_end, col_end))) => {
                            let m = MergeCell {
                                row_start,
                                col_start,
                                row_end,
                                col_end,
                            };
                            prev.push(m);
                            prev
                        }
                        _ => prev,
                    }
                })
        } else {
            vec![]
        }
    }

    pub fn get_comments(&mut self) -> Vec<Comment> {
        let comments = self
            .controller
            .status
            .cell_attachment_manager
            .comments
            .data
            .get(&self.sheet_id);
        if let Some(comments) = comments {
            comments
                .comments
                .clone()
                .iter()
                .fold(vec![], |mut prev, (id, c)| {
                    if let Ok((row, col)) = self
                        .controller
                        .status
                        .navigator
                        .fetch_cell_idx(&self.sheet_id, id)
                    {
                        let author_id = c.author;
                        let author = self
                            .controller
                            .status
                            .cell_attachment_manager
                            .comments
                            .get_author_name(&author_id)
                            .unwrap();
                        let content = c.text.to_string();
                        let comment = Comment {
                            row,
                            col,
                            author,
                            content,
                        };
                        prev.push(comment);
                        prev
                    } else {
                        prev
                    }
                })
        } else {
            vec![]
        }
    }

    /// Get the dimension of the sheet.
    pub fn get_sheet_dimension(&mut self) -> (usize, usize) {
        let sheet_container = self
            .controller
            .status
            .container
            .get_sheet_container_mut(self.sheet_id);
        sheet_container
            .cells
            .clone()
            .iter()
            .fold((0, 0), |(r, c), (id, _)| {
                let cell_idx = self
                    .controller
                    .status
                    .navigator
                    .fetch_cell_idx(&self.sheet_id, id);
                match cell_idx {
                    Ok((row, col)) => {
                        let r = if r > row { r } else { row };
                        let c = if c > col { c } else { col };
                        (r, c)
                    }
                    Err(_) => (r, c),
                }
            })
    }
}
