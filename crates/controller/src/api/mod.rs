use logisheets_base::{errors::BasicError, CellId, ColId, RowId, SheetId};
use logisheets_parser::unparse;

use crate::{
    connectors::NameFetcher,
    controller::{display::get_default_col_width, style::StyleConverter},
    Controller,
};

pub use crate::{
    controller::display::{ColInfo, RowInfo},
    controller::edit_action::EditAction,
    errors::{Error, Result},
    Comment, MergeCell, Style, Value,
};
pub use logisheets_base::BlockId;

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
    controller: &'a Controller,
}

impl<'a> Worksheet<'a> {
    pub fn from(sheet_id: SheetId, controller: &'a Controller) -> Self {
        Worksheet {
            sheet_id,
            controller,
        }
    }

    pub(crate) fn get_value_by_id(&self, cell_id: CellId) -> Result<Value> {
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

    pub fn get_value(&self, row: usize, col: usize) -> Result<Value> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_value_by_id(cell_id)
    }

    pub(crate) fn get_formula_by_id(&self, cell_id: CellId) -> Result<String> {
        if let Some(node) = self
            .controller
            .status
            .formula_manager
            .formulas
            .get(&(self.sheet_id, cell_id))
        {
            let mut name_fetcher = NameFetcher {
                func_manager: &self.controller.status.func_id_manager,
                sheet_id_manager: &self.controller.status.sheet_id_manager,
                external_links_manager: &self.controller.status.external_links_manager,
                text_id_manager: &self.controller.status.text_id_manager,
                name_id_manager: &self.controller.status.name_id_manager,
                navigator: &self.controller.status.navigator,
                formula_manager: &self.controller.status.formula_manager,
            };
            let f = unparse::unparse(node, &mut name_fetcher, self.sheet_id)?;
            Ok(f)
        } else {
            Ok(String::from(""))
        }
    }

    pub fn get_formula(&self, row: usize, col: usize) -> Result<String> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_formula_by_id(cell_id)
    }

    pub(crate) fn get_style_by_id(&self, cell_id: CellId) -> Result<Style> {
        let style_id = if let Some(cell) = self
            .controller
            .status
            .container
            .get_cell(self.sheet_id, &cell_id)
        {
            cell.style
        } else if let CellId::NormalCell(normal_cell_id) = cell_id {
            let row_id = normal_cell_id.row;
            if let Some(row_info) = self
                .controller
                .status
                .container
                .get_row_info(self.sheet_id, row_id)
            {
                row_info.style
            } else {
                let col_id = normal_cell_id.col;
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
        } else {
            0
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

    pub fn get_style(&self, row: usize, col: usize) -> Result<Style> {
        let cell_id = self
            .controller
            .status
            .navigator
            .fetch_cell_id(&self.sheet_id, row, col)?;
        self.get_style_by_id(cell_id)
    }

    pub fn get_merge_cells(&self) -> Vec<MergeCell> {
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

    pub fn get_comments(&self) -> Vec<Comment> {
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
    pub fn get_sheet_dimension(&self) -> (usize, usize) {
        let sheet_container = self
            .controller
            .status
            .container
            .get_sheet_container(self.sheet_id);
        if sheet_container.is_none() {
            return (0, 0);
        }
        let sheet_container = sheet_container.unwrap();
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

    pub fn get_row_info(&self, row: usize) -> Option<RowInfo> {
        let row_id = self
            .controller
            .status
            .navigator
            .fetch_row_id(&self.sheet_id, row)
            .ok()?;
        self.get_row_info_by_id(row_id)
    }

    pub(crate) fn get_row_info_by_id(&self, row_id: RowId) -> Option<RowInfo> {
        let row_info = self
            .controller
            .status
            .container
            .data
            .get(&self.sheet_id)?
            .row_info
            .get_row_info(row_id)?;

        let row_height = if row_info.custom_height {
            row_info.ht.unwrap()
        } else {
            self.get_default_row_height()
        };

        let row_idx = self
            .controller
            .status
            .navigator
            .fetch_row_idx(&self.sheet_id, &row_id)
            .unwrap();

        let info = RowInfo {
            idx: row_idx,
            height: row_height,
            hidden: row_info.hidden,
        };
        Some(info)
    }

    pub fn get_col_info(&self, col: usize) -> Option<ColInfo> {
        let col_id = self
            .controller
            .status
            .navigator
            .fetch_col_id(&self.sheet_id, col)
            .ok()?;
        let col_info = self.get_col_info_by_id(col_id)?;
        Some(ColInfo {
            idx: col,
            width: col_info.width,
            hidden: col_info.hidden,
        })
    }

    pub(crate) fn get_col_info_by_id(&self, col_id: ColId) -> Option<ColInfo> {
        let col_info = self
            .controller
            .status
            .container
            .data
            .get(&self.sheet_id)?
            .col_info
            .get_col_info(col_id)?;

        let col_width = if col_info.custom_width {
            col_info.width.unwrap()
        } else {
            self.get_default_col_width()
        };

        let row_idx = self
            .controller
            .status
            .navigator
            .fetch_col_idx(&self.sheet_id, &col_id)
            .unwrap();

        let info = ColInfo {
            idx: row_idx,
            width: col_width,
            hidden: col_info.hidden,
        };
        Some(info)
    }

    pub(crate) fn get_cell_idx(&self, cell_id: CellId) -> Result<(usize, usize)> {
        self.controller
            .status
            .navigator
            .fetch_cell_idx(&self.sheet_id, &cell_id)
            .map_err(|e| e.into())
    }

    fn get_default_row_height(&self) -> f64 {
        self.controller
            .settings
            .sheet_format_pr
            .get(&self.sheet_id)
            .unwrap()
            .default_row_height
    }

    fn get_default_col_width(&self) -> f64 {
        self.controller
            .settings
            .sheet_format_pr
            .get(&self.sheet_id)
            .unwrap()
            .default_col_width
            .unwrap_or(get_default_col_width())
    }

    pub fn get_block_size(&self, block_id: BlockId) -> Result<(usize, usize)> {
        self.controller
            .status
            .navigator
            .get_block_size(self.sheet_id, block_id)
            .map_err(|e| e.into())
    }

    pub fn get_block_master_cell(&self, block_id: BlockId) -> Result<(usize, usize)> {
        let master_cell_id = self
            .controller
            .status
            .navigator
            .get_master_cell(self.sheet_id, block_id)?;
        let result = self
            .controller
            .status
            .navigator
            .fetch_cell_idx(&self.sheet_id, &master_cell_id)?;
        Ok(result)
    }
}
