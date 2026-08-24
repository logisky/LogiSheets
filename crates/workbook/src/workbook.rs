use crate::logisheets::LogiSheetsData;
use crate::ooxml::comments::Comments;
use crate::ooxml::doc_props::{DocPropApp, DocPropCore, DocPropCustom};
use crate::ooxml::drawing_part::{CtMarker, CtOneCellAnchor, CtPositiveSize2D, CtTwoCellAnchor, CtWsDr};
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
use crate::rtypes::{CHART, IMAGE};
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
    /// Workbook-scoped pivot caches (`xl/pivotCache/*`). The workbook part's
    /// `<pivotCaches>` element links each cache's `cacheId` to the `rel_id`
    /// here (see [`PivotCache`]).
    pub pivot_caches: Vec<PivotCache>,
}

/// A pivot cache: a `pivotCacheDefinition` plus its (optional) `pivotCacheRecords`.
#[derive(Debug, Clone)]
pub struct PivotCache {
    /// Relationship id in `workbook.xml.rels` (and the `r:id` of the matching
    /// `<pivotCache>` element in the workbook part), e.g. `rId7`.
    pub rel_id: Id,
    pub definition: crate::ooxml::pivot_cache_definition::PivotCacheDefinition,
    /// The records part and the relationship id linking to it from the
    /// definition's own `.rels` (usually `rId1`).
    pub records: Option<(Id, crate::ooxml::pivot_cache_records::PivotCacheRecords)>,
}

/// A pivot table on a worksheet: a `pivotTableDefinition` plus the relationship
/// ids wiring it into the package.
#[derive(Debug, Clone)]
pub struct PivotTablePart {
    /// Relationship id in the owning `sheetN.xml.rels`, e.g. `rId1`.
    pub rel_id: Id,
    pub definition: crate::ooxml::pivot_table::PivotTableDefinition,
    /// Relationship id in this pivot table's own `.rels` pointing at the cache
    /// definition (usually `rId1`). The cache it resolves to is determined by
    /// `definition.cache_id` matching a workbook `<pivotCache cacheId=…>`.
    pub cache_rel_id: Id,
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
    /// Pivot tables anchored on this worksheet (`xl/pivotTables/*`).
    pub pivot_tables: Vec<PivotTablePart>,
    /// Structured tables (`ListObject`s) on this worksheet (`xl/tables/*`).
    pub tables: Vec<TablePart>,
}

/// A structured table on a worksheet: the `CT_Table` plus the relationship id
/// wiring it into the sheet (the same `r:id` appears in the worksheet's
/// `<tableParts>`).
#[derive(Debug, Clone)]
pub struct TablePart {
    /// Relationship id in the owning `sheetN.xml.rels`, e.g. `rId2`.
    pub rel_id: Id,
    pub table: crate::ooxml::table::Table,
}

/// An OOXML part preserved verbatim for lossless round-trip. Currently used for
/// the chart part tree reached from a drawing (`xl/charts/chartN.xml` and its
/// `styleN.xml` / `colorsN.xml` satellites): LogiSheets does not yet author
/// these, so the raw bytes are kept and re-emitted unchanged. Structured
/// parsing for *rendering* happens elsewhere and need not be lossless.
#[derive(Debug, Clone)]
pub struct PassthroughPart {
    /// Zip-relative path, preserved so relationship targets keep resolving,
    /// e.g. `xl/charts/chart1.xml`.
    pub path: String,
    pub data: Vec<u8>,
    /// Relationship type of this part — drives its `[Content_Types].xml`
    /// override on write (see `writer::get_content_type`).
    pub rtype: crate::rtypes::RType<'static>,
    /// The part's own relationships (may be empty), written to
    /// `<dir>/_rels/<file>.rels`.
    pub rels: Vec<CtRelationship>,
}

/// A worksheet drawing part together with its relationships, which map the
/// picture `r:embed` ids to media files under `xl/media/`.
#[derive(Debug)]
pub struct WorksheetDrawing {
    pub content: CtWsDr,
    /// `embed rId` -> target such as `../media/image1.png`.
    pub rels: Vec<CtRelationship>,
    /// Chart parts (and their style/color satellites) referenced by this
    /// drawing's `graphicFrame` anchors, preserved verbatim for round-trip.
    pub chart_parts: Vec<PassthroughPart>,
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
                one_cell_anchors: Vec::new(),
            },
            rels,
            chart_parts: Vec::new(),
        }
    }

    /// Build a drawing part from cell images AND charts. Images and chart
    /// `graphicFrame` anchors share the drawing's relationship-id namespace, so
    /// ids are allocated across both here to avoid collisions. `chart_parts`
    /// are the chart XML + style/color satellites to emit alongside.
    pub fn build(
        images: &[(i32, i32, String)],
        charts: Vec<ChartAnchor>,
        chart_parts: Vec<PassthroughPart>,
    ) -> Self {
        let mut anchors = Vec::with_capacity(images.len() + charts.len());
        let mut one_cell_anchors = Vec::<CtOneCellAnchor>::new();
        let mut rels = Vec::with_capacity(images.len() + charts.len());
        let mut rid = 1u32;
        let mut nv_id = 2u32; // cNvPr ids; Excel reserves 1 for the sheet.

        for (col, row, media_name) in images {
            let embed = format!("rId{}", rid);
            rid += 1;
            anchors.push(CtTwoCellAnchor::new_cell_image(
                *col,
                *row,
                nv_id,
                format!("Image {}", nv_id),
                embed.clone(),
            ));
            nv_id += 1;
            rels.push(CtRelationship {
                id: embed,
                ty: IMAGE.0.to_string(),
                target: format!("../media/{}", media_name),
                target_mode: StTargetMode::Internal,
            });
        }

        for ca in charts {
            let embed = format!("rId{}", rid);
            rid += 1;
            // The chart part path is workbook-absolute (e.g.
            // `xl/charts/chart1.xml`); the drawing lives under `xl/drawings/`,
            // so the relationship target is `../charts/chart1.xml`.
            let target = match ca.chart_path.strip_prefix("xl/") {
                Some(rest) => format!("../{}", rest),
                None => ca.chart_path.clone(),
            };
            let from =
                CtMarker::with_offset(ca.from_col, ca.from_row, ca.from_col_off, ca.from_row_off);
            match ca.extent {
                ChartAnchorExtent::ToCell {
                    col,
                    row,
                    col_off,
                    row_off,
                } => anchors.push(CtTwoCellAnchor::new_chart_anchor(
                    from,
                    CtMarker::with_offset(col, row, col_off, row_off),
                    nv_id,
                    ca.name,
                    embed.clone(),
                )),
                ChartAnchorExtent::Size { cx, cy } => {
                    one_cell_anchors.push(CtOneCellAnchor::new_chart_anchor(
                        from,
                        CtPositiveSize2D { cx, cy },
                        nv_id,
                        ca.name,
                        embed.clone(),
                    ))
                }
            }
            nv_id += 1;
            rels.push(CtRelationship {
                id: embed,
                ty: CHART.0.to_string(),
                target,
                target_mode: StTargetMode::Internal,
            });
        }

        WorksheetDrawing {
            content: CtWsDr {
                two_cell_anchors: anchors,
                one_cell_anchors,
            },
            rels,
            chart_parts,
        }
    }
}

/// A chart's placement for [`WorksheetDrawing::build`]: the from/to anchor cells
/// (col/row + EMU offsets) plus the chart part it references.
#[derive(Debug, Clone)]
pub struct ChartAnchor {
    pub from_col: i32,
    pub from_row: i32,
    pub from_col_off: i64,
    pub from_row_off: i64,
    /// How far the frame reaches: to a second cell, or an explicit size. The two
    /// are different anchor elements in the file and a chart keeps the one it
    /// arrived with.
    pub extent: ChartAnchorExtent,
    /// Workbook-absolute path of the chart part, e.g. `xl/charts/chart1.xml`.
    pub chart_path: String,
    /// Human-readable frame name (e.g. `Chart 1`).
    pub name: String,
}

/// The two ways a drawing anchor states an object's extent.
#[derive(Debug, Clone)]
pub enum ChartAnchorExtent {
    /// `<xdr:twoCellAnchor>`: a second corner cell, with EMU offsets into it.
    ToCell {
        col: i32,
        row: i32,
        col_off: i64,
        row_off: i64,
    },
    /// `<xdr:oneCellAnchor>`: a size in EMUs, with no second cell.
    Size { cx: i64, cy: i64 },
}

#[derive(Debug)]
pub struct ExternalLink {
    pub external_link_part: ExternalLinkPart,
    // In the standard of OOXML, target points to the location of the exact files.
    // Though it is not supported to reference a external workbook in LogiSheets directly,
    // it's available to read the existed references.
    pub target: String,
}

#[derive(Debug, Default, Clone)]
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
