use crate::ooxml::comments::Comments;
use crate::ooxml::doc_props::{DocPropApp, DocPropCore, DocPropCustom};
use crate::ooxml::external_links::*;
use crate::ooxml::sst::SstPart;
use crate::ooxml::style_sheet::StylesheetPart;
use crate::ooxml::theme::ThemePart;
use crate::ooxml::workbook::WorkbookPart;
use crate::ooxml::worksheet::WorksheetPart;
use std::collections::HashMap;

use crate::SerdeErr;

pub type Id = String;

#[derive(Debug)]
pub struct Workbook {
    pub xl: Xl,
    pub doc_props: DocProps,
}

#[derive(Debug)]
pub struct Xl {
    pub workbook_part: WorkbookPart,
    pub styles: (Id, StylesheetPart),
    pub sst: Option<(Id, SstPart)>,
    pub worksheets: HashMap<Id, Worksheet>,
    pub external_links: HashMap<Id, ExternalLink>,
    pub theme: Option<(Id, ThemePart)>,
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

#[derive(Debug, Default)]
pub struct DocProps {
    pub app: Option<DocPropApp>,
    pub core: Option<DocPropCore>,
    pub custom: Option<DocPropCustom>,
}

impl DocProps {
    pub fn is_empty(&self) -> bool {
        self.app.is_none() && self.core.is_none() && self.custom.is_none()
    }
}

impl Workbook {
    pub fn get_sheet_by_name(&self, name: &str) -> Option<&Worksheet> {
        let sheet = self
            .xl
            .workbook_part
            .sheets
            .sheets
            .iter()
            .find(|s| s.name == name)?;
        let id = &sheet.id;
        self.xl.worksheets.get(id)
    }

    pub fn get_sheet_by_index(&self, idx: usize) -> Option<&Worksheet> {
        let sheet = self.xl.workbook_part.sheets.sheets.get(idx)?;
        let id = &sheet.id;
        self.xl.worksheets.get(id)
    }

    pub fn from_file(buf: &[u8]) -> Result<Self, SerdeErr> {
        crate::reader::read(buf)
    }
}
