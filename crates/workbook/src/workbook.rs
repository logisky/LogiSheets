use crate::logisheets::LogiSheetsData;
use crate::ooxml::comments::Comments;
use crate::ooxml::doc_props::{DocPropApp, DocPropCore, DocPropCustom};
use crate::ooxml::drawing_part::{CtTwoCellAnchor, CtWsDr};
use crate::ooxml::external_links::*;
use crate::ooxml::persons::Persons;
use crate::ooxml::relationships::CtRelationship;
use crate::ooxml::simple_types::StTargetMode;
use crate::ooxml::sst::SstPart;
use crate::ooxml::style_sheet::StylesheetPart;
use crate::ooxml::theme::ThemePart;
use crate::ooxml::threaded_comments::ThreadedComments;
use crate::ooxml::workbook::WorkbookPart;
use crate::ooxml::worksheet::WorksheetPart;
use crate::rtypes::IMAGE;
use std::collections::HashMap;

use crate::SerdeErr;

pub type Id = String;

#[derive(Debug)]
pub struct Wb {
    pub xl: Xl,
    pub doc_props: DocProps,
    pub logisheets: Option<LogiSheetsData>,
}

#[derive(Debug)]
pub struct Xl {
    pub workbook_part: WorkbookPart,
    pub styles: (Id, StylesheetPart),
    pub sst: Option<(Id, SstPart)>,
    pub worksheets: HashMap<Id, Worksheet>,
    pub external_links: HashMap<Id, ExternalLink>,
    pub theme: Option<(Id, ThemePart)>,
    /// Workbook-scoped person list backing threaded comments / `@mentions`
    /// (`xl/persons/person.xml`).
    pub persons: Option<Persons>,
    /// Binary media parts (`xl/media/*`), e.g. images embedded in cells.
    pub medias: Vec<Media>,
}

/// A binary media part stored under `xl/media/`.
#[derive(Debug, Clone)]
pub struct Media {
    /// File name under `xl/media/`, e.g. `image1.png`.
    pub name: String,
    pub data: Vec<u8>,
}

#[derive(Debug)]
pub struct Worksheet {
    pub worksheet_part: WorksheetPart,
    /// Legacy comments (`xl/commentsN.xml`), kept as a back-compat mirror.
    pub comments: Option<Comments>,
    /// Threaded comments (`xl/threadedComments/threadedCommentN.xml`) — the
    /// source of truth when present.
    pub threaded_comments: Option<ThreadedComments>,
    /// Worksheet drawing (`xl/drawings/drawingN.xml`) holding cell images.
    pub drawing: Option<WorksheetDrawing>,
}

/// A worksheet drawing part together with its relationships, which map the
/// picture `r:embed` ids to media files under `xl/media/`.
#[derive(Debug)]
pub struct WorksheetDrawing {
    pub content: CtWsDr,
    /// `embed rId` -> target such as `../media/image1.png`.
    pub rels: Vec<CtRelationship>,
}

impl WorksheetDrawing {
    /// Resolve an `r:embed` id to the media file name (e.g. `image1.png`).
    pub fn media_name_of(&self, embed_rid: &str) -> Option<String> {
        let rel = self.rels.iter().find(|r| r.id == embed_rid)?;
        rel.target.rsplit('/').next().map(|s| s.to_string())
    }

    /// Build a drawing part from cell images. Each item is
    /// `(col, row, media_name)` where `media_name` is the file under
    /// `xl/media/` (e.g. `image1.png`). The `r:embed` ids and image
    /// relationships are generated here.
    pub fn from_cell_images(images: &[(i32, i32, String)]) -> Self {
        let mut anchors = Vec::with_capacity(images.len());
        let mut rels = Vec::with_capacity(images.len());
        let mut i = 1u32;
        for (col, row, media_name) in images {
            let embed = format!("rId{}", i);
            anchors.push(CtTwoCellAnchor::new_cell_image(
                *col,
                *row,
                i + 1,
                format!("Image {}", i),
                embed.clone(),
            ));
            rels.push(CtRelationship {
                id: embed,
                ty: IMAGE.0.to_string(),
                target: format!("../media/{}", media_name),
                target_mode: StTargetMode::Internal,
            });
            i += 1;
        }
        WorksheetDrawing {
            content: CtWsDr {
                two_cell_anchors: anchors,
            },
            rels,
        }
    }
}

#[derive(Debug)]
pub struct ExternalLink {
    pub external_link_part: ExternalLinkPart,
    // In the standard of OOXML, target points to the location of the exact files.
    // Though it is not supported to reference a external workbook in LogiSheets directly,
    // it's available to read the existed references.
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

impl Wb {
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
