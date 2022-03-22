use std::collections::HashMap;
use xmlserde::comments::Comments;
use xmlserde::external_links::*;
use xmlserde::sst::SstPart;
use xmlserde::style_sheet::StylesheetPart;
use xmlserde::workbook::WorkbookPart;
use xmlserde::worksheet::WorksheetPart;

type Id = String;

#[derive(Debug)]
pub struct Workbook {
    pub workbook_part: WorkbookPart,
    pub styles: Option<StylesheetPart>,
    pub sst: Option<SstPart>,
    pub worksheets: HashMap<Id, Worksheet>,
    pub external_links: HashMap<Id, ExternalLink>,
}

#[derive(Debug)]
pub struct Worksheet {
    pub worksheet_part: WorksheetPart,
    pub comments: Option<Comments>,
}

#[derive(Debug)]
pub struct ExternalLink {
    pub external_link_part: ExternalLinkPart,
    pub target: String,
}

impl Workbook {
    pub fn get_sheet_by_name(&self, name: &str) -> Option<&Worksheet> {
        let sheet = self.workbook_part
            .sheets
            .sheets
            .iter()
            .find(|s| s.name == name)?;
        let id = &sheet.id;
        self.worksheets.get(id)
    }

    pub fn get_sheet_by_index(&self, idx: usize) -> Option<&Worksheet> {
        let sheet = self.workbook_part
            .sheets
            .sheets
            .get(idx)?;
        let id = &sheet.id;
        self.worksheets.get(id)
    }
}
