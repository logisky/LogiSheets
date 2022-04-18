use logisheets_xmlserde::comments::Comments;
use logisheets_xmlserde::external_links::*;
use logisheets_xmlserde::sst::SstPart;
use logisheets_xmlserde::style_sheet::StylesheetPart;
use logisheets_xmlserde::workbook::WorkbookPart;
use logisheets_xmlserde::worksheet::WorksheetPart;
use std::collections::HashMap;

type Id = String;

#[derive(Debug)]
pub struct Workbook {
    pub workbook_part: WorkbookPart,
    pub styles: StylesheetPart,
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
        let sheet = self
            .workbook_part
            .sheets
            .sheets
            .iter()
            .find(|s| s.name == name)?;
        let id = &sheet.id;
        self.worksheets.get(id)
    }

    pub fn get_sheet_by_index(&self, idx: usize) -> Option<&Worksheet> {
        let sheet = self.workbook_part.sheets.sheets.get(idx)?;
        let id = &sheet.id;
        self.worksheets.get(id)
    }
}
