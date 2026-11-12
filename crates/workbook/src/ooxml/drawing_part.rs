//! Minimal SpreadsheetDrawingML support for cell images.
//!
//! Root of `xl/drawings/drawingN.xml` is `xdr:wsDr`. We model just what is
//! needed to store pictures anchored to a single cell (a `twoCellAnchor`
//! spanning one cell so the image fills it and resizes with the cell). Other
//! anchor kinds (`oneCellAnchor`, `absoluteAnchor`) and richer shape/geometry
//! properties are not modeled and are dropped on read — LogiSheets is the
//! source of truth for the images it creates.

use xmlserde::Unparsed;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

fn default_edit_as() -> String {
    String::from("twoCell")
}

fn default_prst_rect() -> String {
    String::from("rect")
}

/// Root element of a worksheet drawing part (`xdr:wsDr`).
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
#[xmlserde(root = b"xdr:wsDr")]
#[xmlserde(alias(b"wsDr"))]
#[xmlserde(with_custom_ns(
    b"xdr",
    b"http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
))]
#[xmlserde(with_custom_ns(b"a", b"http://schemas.openxmlformats.org/drawingml/2006/main"))]
#[xmlserde(with_custom_ns(
    b"r",
    b"http://schemas.openxmlformats.org/officeDocument/2006/relationships"
))]
#[xmlserde(with_custom_ns(b"c", b"http://schemas.openxmlformats.org/drawingml/2006/chart"))]
pub struct CtWsDr {
    #[xmlserde(name = b"xdr:twoCellAnchor", ty = "child")]
    #[xmlserde(alias(b"twoCellAnchor"))]
    pub two_cell_anchors: Vec<CtTwoCellAnchor>,
    /// The other anchor kind: one corner plus an explicit size, rather than two
    /// corners. Excel writes it for an object the user has not resized by
    /// dragging, and it is what openpyxl writes by default — so a chart
    /// arriving from a generator is usually anchored this way.
    #[xmlserde(name = b"xdr:oneCellAnchor", ty = "child")]
    #[xmlserde(alias(b"oneCellAnchor"))]
    pub one_cell_anchors: Vec<CtOneCellAnchor>,
}

/// `<xdr:oneCellAnchor>` — anchored at `from`, sized by `ext`. There is no
/// second cell, which is why it is a separate type rather than a
/// `twoCellAnchor` with a guessed `to`: inventing one would be a lie that also
/// moves when rows are inserted.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtOneCellAnchor {
    #[xmlserde(name = b"xdr:from", ty = "child")]
    #[xmlserde(alias(b"from"))]
    pub from: CtMarker,
    #[xmlserde(name = b"xdr:ext", ty = "child")]
    #[xmlserde(alias(b"ext"))]
    pub ext: CtPositiveSize2D,
    #[xmlserde(name = b"xdr:pic", ty = "child")]
    #[xmlserde(alias(b"pic"))]
    pub pic: Option<CtPic>,
    #[xmlserde(name = b"xdr:sp", ty = "child")]
    #[xmlserde(alias(b"sp"))]
    pub sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:grpSp", ty = "child")]
    #[xmlserde(alias(b"grpSp"))]
    pub grp_sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:graphicFrame", ty = "child")]
    #[xmlserde(alias(b"graphicFrame"))]
    pub graphic_frame: Option<CtGraphicFrame>,
    #[xmlserde(name = b"xdr:cxnSp", ty = "child")]
    #[xmlserde(alias(b"cxnSp"))]
    pub cxn_sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:contentPart", ty = "child")]
    #[xmlserde(alias(b"contentPart"))]
    pub content_part: Option<Unparsed>,
    /// How Excel anchors an object older readers may not know — a chartEx
    /// chart, chiefly. See [`CtAlternateContent`].
    #[xmlserde(name = b"mc:AlternateContent", ty = "child")]
    #[xmlserde(alias(b"AlternateContent"))]
    pub alternate_content: Option<CtAlternateContent>,
    #[xmlserde(name = b"xdr:clientData", ty = "child")]
    #[xmlserde(alias(b"clientData"))]
    pub client_data: Option<CtAnchorClientData>,
}

/// `<xdr:ext cx="…" cy="…">` — a size in EMUs.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPositiveSize2D {
    #[xmlserde(name = b"cx", ty = "attr")]
    pub cx: i64,
    #[xmlserde(name = b"cy", ty = "attr")]
    pub cy: i64,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTwoCellAnchor {
    #[xmlserde(name = b"editAs", ty = "attr", default = "default_edit_as")]
    pub edit_as: String,
    #[xmlserde(name = b"xdr:from", ty = "child")]
    #[xmlserde(alias(b"from"))]
    pub from: CtMarker,
    #[xmlserde(name = b"xdr:to", ty = "child")]
    #[xmlserde(alias(b"to"))]
    pub to: CtMarker,
    #[xmlserde(name = b"xdr:pic", ty = "child")]
    #[xmlserde(alias(b"pic"))]
    pub pic: Option<CtPic>,
    // A `twoCellAnchor` hosts exactly one object. `pic` (images we create) and
    // `graphicFrame` (charts — we both read their reference and re-emit them on
    // save) are modeled structurally. Shapes/groups/connectors are preserved
    // verbatim as `Unparsed` so drawings authored elsewhere (text boxes etc.)
    // round-trip. A chart's `graphicFrame` points at a chart part via the
    // drawing's relationships; the chart part itself is a `PassthroughPart`.
    #[xmlserde(name = b"xdr:sp", ty = "child")]
    #[xmlserde(alias(b"sp"))]
    pub sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:grpSp", ty = "child")]
    #[xmlserde(alias(b"grpSp"))]
    pub grp_sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:graphicFrame", ty = "child")]
    #[xmlserde(alias(b"graphicFrame"))]
    pub graphic_frame: Option<CtGraphicFrame>,
    #[xmlserde(name = b"xdr:cxnSp", ty = "child")]
    #[xmlserde(alias(b"cxnSp"))]
    pub cxn_sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:contentPart", ty = "child")]
    #[xmlserde(alias(b"contentPart"))]
    pub content_part: Option<Unparsed>,
    /// How Excel anchors an object older readers may not know — a chartEx
    /// chart, chiefly. See [`CtAlternateContent`].
    #[xmlserde(name = b"mc:AlternateContent", ty = "child")]
    #[xmlserde(alias(b"AlternateContent"))]
    pub alternate_content: Option<CtAlternateContent>,
    #[xmlserde(name = b"xdr:clientData", ty = "child")]
    #[xmlserde(alias(b"clientData"))]
    pub client_data: Option<CtAnchorClientData>,
}

/// A cell anchor marker: `<xdr:col>`, `<xdr:colOff>`, `<xdr:row>`, `<xdr:rowOff>`.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtMarker {
    #[xmlserde(name = b"xdr:col", ty = "child")]
    #[xmlserde(alias(b"col"))]
    pub col: XdrI32,
    #[xmlserde(name = b"xdr:colOff", ty = "child")]
    #[xmlserde(alias(b"colOff"))]
    pub col_off: XdrI64,
    #[xmlserde(name = b"xdr:row", ty = "child")]
    #[xmlserde(alias(b"row"))]
    pub row: XdrI32,
    #[xmlserde(name = b"xdr:rowOff", ty = "child")]
    #[xmlserde(alias(b"rowOff"))]
    pub row_off: XdrI64,
}

impl CtMarker {
    pub fn with_offset(col: i32, row: i32, col_off: i64, row_off: i64) -> Self {
        CtMarker {
            col: XdrI32 { v: col },
            col_off: XdrI64 { v: col_off },
            row: XdrI32 { v: row },
            row_off: XdrI64 { v: row_off },
        }
    }

    pub fn new(col: i32, row: i32) -> Self {
        CtMarker {
            col: XdrI32 { v: col },
            col_off: XdrI64 { v: 0 },
            row: XdrI32 { v: row },
            row_off: XdrI64 { v: 0 },
        }
    }
}

// NOTE: no `default` on these text fields — xmlserde omits values equal to
// their default, but Excel expects the offsets to be present explicitly.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct XdrI32 {
    #[xmlserde(ty = "text")]
    pub v: i32,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct XdrI64 {
    #[xmlserde(ty = "text")]
    pub v: i64,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtAnchorClientData {}

// Fields are `Option` so that pictures written by other producers (which vary
// in structure, element order, and namespace prefixes) deserialize without
// panicking. xmlserde panics on a missing *required* child/attr, and that
// panic is not catchable, so anything we might not find must be optional. We
// only need `from`/`to` and the blip's embed id to render an image.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPic {
    #[xmlserde(name = b"xdr:nvPicPr", ty = "child")]
    #[xmlserde(alias(b"nvPicPr"))]
    pub nv_pic_pr: Option<CtPictureNonVisual>,
    #[xmlserde(name = b"xdr:blipFill", ty = "child")]
    #[xmlserde(alias(b"blipFill"))]
    pub blip_fill: Option<CtBlipFillProperties>,
    #[xmlserde(name = b"xdr:spPr", ty = "child")]
    #[xmlserde(alias(b"spPr"))]
    pub sp_pr: Option<CtPicShapeProperties>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPictureNonVisual {
    #[xmlserde(name = b"xdr:cNvPr", ty = "child")]
    #[xmlserde(alias(b"cNvPr"))]
    pub c_nv_pr: Option<CtNvDrawingProps>,
    #[xmlserde(name = b"xdr:cNvPicPr", ty = "child")]
    #[xmlserde(alias(b"cNvPicPr"))]
    pub c_nv_pic_pr: Option<CtNvPicProps>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtNvDrawingProps {
    #[xmlserde(name = b"id", ty = "attr", default = "default_zero_u32")]
    pub id: u32,
    #[xmlserde(name = b"name", ty = "attr", default = "empty_string")]
    pub name: String,
    #[xmlserde(name = b"descr", ty = "attr", default = "empty_string")]
    pub descr: String,
}

fn empty_string() -> String {
    String::new()
}

fn default_zero_u32() -> u32 {
    0
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtNvPicProps {}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtBlipFillProperties {
    #[xmlserde(name = b"a:blip", ty = "child")]
    pub blip: Option<CtBlip>,
    #[xmlserde(name = b"a:stretch", ty = "child")]
    pub stretch: Option<CtStretchInfoProperties>,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtBlip {
    /// Relationship id (`r:embed`) pointing to the media part in the drawing's
    /// relationships file.
    #[xmlserde(name = b"r:embed", ty = "attr")]
    pub embed: Option<String>,
    #[xmlserde(name = b"r:link", ty = "attr")]
    pub link: Option<String>,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtStretchInfoProperties {
    #[xmlserde(name = b"a:fillRect", ty = "child")]
    pub fill_rect: Option<CtRelativeRect>,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtRelativeRect {}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtPicShapeProperties {
    #[xmlserde(name = b"a:prstGeom", ty = "child")]
    pub prst_geom: Option<CtPresetGeometry2D>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPresetGeometry2D {
    // `prst` is required by Excel; do not give it an xmlserde default or it
    // would be omitted when equal to "rect".
    #[xmlserde(name = b"prst", ty = "attr")]
    pub prst: String,
    #[xmlserde(name = b"a:avLst", ty = "child")]
    pub av_lst: Option<CtGeomGuideList>,
}

impl Default for CtPresetGeometry2D {
    fn default() -> Self {
        CtPresetGeometry2D {
            prst: default_prst_rect(),
            av_lst: Some(CtGeomGuideList::default()),
        }
    }
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtGeomGuideList {}

// --- graphicFrame (charts) -------------------------------------------------
//
// Modeled enough to (a) read a chart reference on load and (b) regenerate the
// anchor on save. `nvGraphicFramePr`, `xfrm` and `graphic/graphicData/c:chart`
// (or `cx:chart`, for a chartEx) are typed. Non-chart graphicData (e.g.
// SmartArt) is not modeled and would not round-trip — charts are the supported
// case.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicFrame {
    #[xmlserde(name = b"xdr:nvGraphicFramePr", ty = "child")]
    #[xmlserde(alias(b"nvGraphicFramePr"))]
    pub nv_graphic_frame_pr: Option<CtGraphicFrameNonVisual>,
    #[xmlserde(name = b"xdr:xfrm", ty = "child")]
    #[xmlserde(alias(b"xfrm"))]
    pub xfrm: Option<CtGraphicFrameXfrm>,
    #[xmlserde(name = b"a:graphic", ty = "child")]
    pub graphic: Option<CtGraphicalObject>,
}

/// `<xdr:xfrm>` on a graphicFrame — DrawingML's `a:CT_Transform2D`.
///
/// The schema requires it, and so does Excel: a graphicFrame without one makes
/// Excel repair the drawing part on open. Excel does recompute the geometry
/// from the anchor's from/to, so the element may be *empty* — real producers
/// write a bare `<xdr:xfrm/>` rather than omitting it, which is what
/// `tests/one_cell_anchor.xlsx` contains — but it has to be present.
///
/// Typed rather than kept opaque because a chart we generate has to emit one
/// and `xmlserde::Unparsed` cannot be constructed from outside that crate. The
/// three attributes and two children below are the whole of `CT_Transform2D`,
/// so nothing is dropped from a file that already had one.
///
/// Distinct from `drawings::CtTransform2D`, which names its children without
/// the `a:` prefix; this module writes every tag prefixed.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicFrameXfrm {
    #[xmlserde(name = b"rot", ty = "attr")]
    pub rot: Option<i64>,
    #[xmlserde(name = b"flipH", ty = "attr")]
    pub flip_h: Option<bool>,
    #[xmlserde(name = b"flipV", ty = "attr")]
    pub flip_v: Option<bool>,
    #[xmlserde(name = b"a:off", ty = "child")]
    #[xmlserde(alias(b"off"))]
    pub off: Option<CtPoint2D>,
    #[xmlserde(name = b"a:ext", ty = "child")]
    #[xmlserde(alias(b"ext"))]
    pub ext: Option<CtPositiveSize2D>,
}

/// `<a:off x="…" y="…">` — an offset in EMUs.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPoint2D {
    #[xmlserde(name = b"x", ty = "attr")]
    pub x: i64,
    #[xmlserde(name = b"y", ty = "attr")]
    pub y: i64,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicFrameNonVisual {
    #[xmlserde(name = b"xdr:cNvPr", ty = "child")]
    #[xmlserde(alias(b"cNvPr"))]
    pub c_nv_pr: Option<CtNvDrawingProps>,
    #[xmlserde(name = b"xdr:cNvGraphicFramePr", ty = "child")]
    #[xmlserde(alias(b"cNvGraphicFramePr"))]
    pub c_nv_graphic_frame_pr: Option<CtNvGraphicFrameProps>,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtNvGraphicFrameProps {}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicalObject {
    #[xmlserde(name = b"a:graphicData", ty = "child")]
    pub graphic_data: Option<CtGraphicalObjectData>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicalObjectData {
    #[xmlserde(name = b"uri", ty = "attr")]
    pub uri: String,
    #[xmlserde(name = b"c:chart", ty = "child")]
    pub chart: Option<CChart>,
    /// The chartEx counterpart of `chart`, under `uri` [`CHART_EX_URI`].
    #[xmlserde(name = b"cx:chart", ty = "child")]
    pub chart_ex: Option<CChartEx>,
}

impl Default for CtGraphicalObjectData {
    fn default() -> Self {
        CtGraphicalObjectData {
            uri: String::from("http://schemas.openxmlformats.org/drawingml/2006/chart"),
            chart: None,
            chart_ex: None,
        }
    }
}

/// `graphicData@uri` for a chartEx chart.
pub const CHART_EX_URI: &str = "http://schemas.microsoft.com/office/drawing/2014/chartex";
const CHART_EX_NS: &str = "http://schemas.microsoft.com/office/drawing/2014/chartex";
const R_NS: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const MC_NS: &str = "http://schemas.openxmlformats.org/markup-compatibility/2006";

/// `<cx:chart r:id="...">` — a drawing's reference to a chartEx part.
///
/// Carries its own namespace declarations, as Excel writes it, rather than
/// adding `cx` to the drawing root: a drawing with no chartEx then serializes
/// exactly as it did before this existed.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CChartEx {
    #[xmlserde(name = b"xmlns:cx", ty = "attr")]
    pub xmlns_cx: Option<String>,
    #[xmlserde(name = b"xmlns:r", ty = "attr")]
    pub xmlns_r: Option<String>,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub r_id: Option<String>,
}

/// `<mc:AlternateContent>` inside a drawing anchor: one `Choice` for readers
/// that understand what it `Requires`, and a `Fallback` for the rest.
///
/// Excel anchors every chartEx chart this way, with `Requires="cx1"` (or
/// `cx2`/`cx4` for the later kinds) and a text box saying the chart is not
/// available as the fallback. Before this was modeled the whole element was
/// skipped on read, so a chartEx chart did not survive a save.
///
/// Only a Choice holding a `graphicFrame` is typed. The Fallback is kept
/// verbatim: nothing here reads it, but an older Excel shows it.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtAlternateContent {
    #[xmlserde(name = b"xmlns:mc", ty = "attr")]
    pub xmlns_mc: Option<String>,
    #[xmlserde(name = b"mc:Choice", ty = "child")]
    #[xmlserde(alias(b"Choice"))]
    pub choice: Option<CtMcChoice>,
    #[xmlserde(name = b"mc:Fallback", ty = "child")]
    #[xmlserde(alias(b"Fallback"))]
    pub fallback: Option<Unparsed>,
}

/// `<mc:Choice Requires="cx1">`. `Requires` names namespace PREFIXES, so each
/// one it names has to be declared in scope — hence the explicit `xmlns:cxN`
/// attributes, one per chartEx revision Excel writes.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtMcChoice {
    #[xmlserde(name = b"xmlns:cx1", ty = "attr")]
    pub xmlns_cx1: Option<String>,
    #[xmlserde(name = b"xmlns:cx2", ty = "attr")]
    pub xmlns_cx2: Option<String>,
    #[xmlserde(name = b"xmlns:cx4", ty = "attr")]
    pub xmlns_cx4: Option<String>,
    #[xmlserde(name = b"Requires", ty = "attr")]
    pub requires: String,
    #[xmlserde(name = b"xdr:graphicFrame", ty = "child")]
    #[xmlserde(alias(b"graphicFrame"))]
    pub graphic_frame: Option<CtGraphicFrame>,
}

/// The namespace a chartEx `Requires` prefix stands for.
fn chart_ex_requires_ns(prefix: &str) -> Option<&'static str> {
    match prefix {
        "cx1" => Some("http://schemas.microsoft.com/office/drawing/2015/9/8/chartex"),
        "cx2" => Some("http://schemas.microsoft.com/office/drawing/2015/10/21/chartex"),
        "cx4" => Some("http://schemas.microsoft.com/office/drawing/2016/5/10/chartex"),
        _ => None,
    }
}

impl CtAlternateContent {
    /// The chartEx-part relationship id this element's Choice references.
    pub fn chart_ex_rid(&self) -> Option<&str> {
        self.choice
            .as_ref()?
            .graphic_frame
            .as_ref()?
            .graphic
            .as_ref()?
            .graphic_data
            .as_ref()?
            .chart_ex
            .as_ref()?
            .r_id
            .as_deref()
    }

    /// The `Requires` of the Choice, e.g. `cx1`.
    pub fn requires(&self) -> Option<&str> {
        self.choice.as_ref().map(|c| c.requires.as_str())
    }

    /// Wrap a chartEx frame the way Excel does.
    ///
    /// A `requires` this crate has no namespace for is written as `cx1`: an
    /// undeclared prefix makes a reader skip the Choice, which would hide the
    /// chart even from an Excel that can draw it.
    fn chart_ex(frame: CtGraphicFrame, requires: &str, fallback: Option<Unparsed>) -> Self {
        let (requires, ns) = match chart_ex_requires_ns(requires) {
            Some(ns) => (requires, ns),
            None => ("cx1", chart_ex_requires_ns("cx1").unwrap_or_default()),
        };
        let ns = Some(ns.to_string());
        CtAlternateContent {
            xmlns_mc: Some(MC_NS.to_string()),
            choice: Some(CtMcChoice {
                xmlns_cx1: if requires == "cx1" { ns.clone() } else { None },
                xmlns_cx2: if requires == "cx2" { ns.clone() } else { None },
                xmlns_cx4: if requires == "cx4" { ns } else { None },
                requires: requires.to_string(),
                graphic_frame: Some(frame),
            }),
            fallback,
        }
    }
}

/// `<c:chart r:id="...">` — the reference from a drawing to a chart part.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CChart {
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub r_id: Option<String>,
}

impl CtGraphicFrame {
    /// The chart-part relationship id this frame references, if any.
    pub fn chart_rid(&self) -> Option<&str> {
        self.graphic
            .as_ref()
            .and_then(|g| g.graphic_data.as_ref())
            .and_then(|d| d.chart.as_ref())
            .and_then(|c| c.r_id.as_deref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{xml_deserialize_from_str, xml_serialize_with_decl};

    #[test]
    fn cell_image_round_trip() {
        let anchor = CtTwoCellAnchor::new_cell_image(2, 3, 2, "Picture 1".into(), "rId1".into());
        let dr = CtWsDr {
            two_cell_anchors: vec![anchor],
            one_cell_anchors: vec![],
        };
        let xml = xml_serialize_with_decl(dr);
        // Sanity: the qualified names and the embed id survive serialization.
        assert!(xml.contains("xdr:wsDr"), "{}", xml);
        assert!(xml.contains("xdr:twoCellAnchor"), "{}", xml);
        assert!(xml.contains("<xdr:col>2</xdr:col>"), "{}", xml);
        assert!(xml.contains("<xdr:row>3</xdr:row>"), "{}", xml);
        assert!(xml.contains("r:embed=\"rId1\""), "{}", xml);
        assert!(xml.contains("prst=\"rect\""), "{}", xml);

        let parsed = xml_deserialize_from_str::<CtWsDr>(&xml).unwrap();
        assert_eq!(parsed.two_cell_anchors.len(), 1);
        let a = &parsed.two_cell_anchors[0];
        assert_eq!(a.anchor_cell(), (2, 3));
        assert_eq!(a.to.col.v, 3);
        assert_eq!(a.to.row.v, 4);
        assert_eq!(a.embed_rid(), Some("rId1"));
    }
}

impl CtTwoCellAnchor {
    /// Build a `twoCellAnchor` that makes an image fill a single cell
    /// `(col, row)` and resize with it. `embed_rid` is the relationship id of
    /// the media part in the drawing's `.rels`; `pic_id` is the drawing-local
    /// non-visual id; `name` is a human-readable picture name.
    pub fn new_cell_image(
        col: i32,
        row: i32,
        pic_id: u32,
        name: String,
        embed_rid: String,
    ) -> Self {
        CtTwoCellAnchor {
            edit_as: default_edit_as(),
            from: CtMarker::new(col, row),
            to: CtMarker::new(col + 1, row + 1),
            sp: None,
            grp_sp: None,
            graphic_frame: None,
            cxn_sp: None,
            content_part: None,
            alternate_content: None,
            pic: Some(CtPic {
                nv_pic_pr: Some(CtPictureNonVisual {
                    c_nv_pr: Some(CtNvDrawingProps {
                        id: pic_id,
                        name,
                        descr: String::new(),
                    }),
                    c_nv_pic_pr: Some(CtNvPicProps::default()),
                }),
                blip_fill: Some(CtBlipFillProperties {
                    blip: Some(CtBlip {
                        embed: Some(embed_rid),
                        link: None,
                    }),
                    stretch: Some(CtStretchInfoProperties {
                        fill_rect: Some(CtRelativeRect::default()),
                    }),
                }),
                sp_pr: Some(CtPicShapeProperties {
                    prst_geom: Some(CtPresetGeometry2D::default()),
                }),
            }),
            client_data: Some(CtAnchorClientData::default()),
        }
    }

    /// Build a chart anchor: a `twoCellAnchor` spanning `from`..`to` whose
    /// `graphicFrame` references a chart part via `chart_rid` (a relationship in
    /// the drawing's `.rels`). `frame_id` is the drawing-local non-visual id;
    /// `name` is a human-readable frame name.
    pub fn new_chart_anchor(
        from: CtMarker,
        to: CtMarker,
        frame_id: u32,
        name: String,
        chart_rid: String,
    ) -> Self {
        CtTwoCellAnchor {
            edit_as: default_edit_as(),
            from,
            to,
            pic: None,
            sp: None,
            grp_sp: None,
            graphic_frame: Some(chart_frame(frame_id, name, chart_rid, false)),
            cxn_sp: None,
            content_part: None,
            alternate_content: None,
            client_data: Some(CtAnchorClientData::default()),
        }
    }

    /// The `(col, row)` of the `from` marker, i.e. the anchored cell.
    pub fn anchor_cell(&self) -> (i32, i32) {
        (self.from.col.v, self.from.row.v)
    }

    /// The `r:embed` id referenced by this anchor's picture, if any.
    pub fn embed_rid(&self) -> Option<&str> {
        self.pic
            .as_ref()
            .and_then(|p| p.blip_fill.as_ref())
            .and_then(|b| b.blip.as_ref())
            .and_then(|b| b.embed.as_deref())
    }
}

impl CtOneCellAnchor {
    /// The `oneCellAnchor` counterpart of
    /// {@link CtTwoCellAnchor::new_chart_anchor}: same graphic frame, anchored
    /// at one cell with an explicit size instead of spanning to a second.
    pub fn new_chart_anchor(
        from: CtMarker,
        ext: CtPositiveSize2D,
        frame_id: u32,
        name: String,
        chart_rid: String,
    ) -> Self {
        CtOneCellAnchor {
            from,
            ext,
            pic: None,
            sp: None,
            grp_sp: None,
            graphic_frame: Some(chart_frame(frame_id, name, chart_rid, false)),
            cxn_sp: None,
            content_part: None,
            alternate_content: None,
            client_data: Some(CtAnchorClientData::default()),
        }
    }
}

/// A chart `graphicFrame` referencing the part at `chart_rid`. `ex` selects
/// a chartEx reference (`cx:chart`) over a classic one (`c:chart`).
fn chart_frame(frame_id: u32, name: String, chart_rid: String, ex: bool) -> CtGraphicFrame {
    let graphic_data = if ex {
        CtGraphicalObjectData {
            uri: CHART_EX_URI.to_string(),
            chart: None,
            chart_ex: Some(CChartEx {
                xmlns_cx: Some(CHART_EX_NS.to_string()),
                xmlns_r: Some(R_NS.to_string()),
                r_id: Some(chart_rid),
            }),
        }
    } else {
        CtGraphicalObjectData {
            uri: String::from("http://schemas.openxmlformats.org/drawingml/2006/chart"),
            chart: Some(CChart {
                r_id: Some(chart_rid),
            }),
            chart_ex: None,
        }
    };
    CtGraphicFrame {
        nv_graphic_frame_pr: Some(CtGraphicFrameNonVisual {
            c_nv_pr: Some(CtNvDrawingProps {
                id: frame_id,
                name,
                descr: String::new(),
            }),
            c_nv_graphic_frame_pr: Some(CtNvGraphicFrameProps::default()),
        }),
        // Empty, but present: Excel recomputes the geometry from the anchor
        // and repairs the part if the element is absent.
        xfrm: Some(CtGraphicFrameXfrm::default()),
        graphic: Some(CtGraphicalObject {
            graphic_data: Some(graphic_data),
        }),
    }
}

/// The parts of a chartEx anchor beyond its position: what the
/// `mc:Choice` requires and the fallback older readers show.
#[derive(Debug, Clone)]
pub struct ChartExFrame {
    pub requires: String,
    pub fallback: Option<Unparsed>,
}

impl CtTwoCellAnchor {
    /// {@link CtTwoCellAnchor::new_chart_anchor} for a chartEx chart: the
    /// same frame, referencing the part through `cx:chart` and wrapped in
    /// `mc:AlternateContent`.
    pub fn new_chart_ex_anchor(
        from: CtMarker,
        to: CtMarker,
        frame_id: u32,
        name: String,
        chart_rid: String,
        ex: ChartExFrame,
    ) -> Self {
        let mut anchor =
            Self::new_chart_anchor(from, to, frame_id, name.clone(), chart_rid.clone());
        anchor.graphic_frame = None;
        anchor.alternate_content = Some(CtAlternateContent::chart_ex(
            chart_frame(frame_id, name, chart_rid, true),
            &ex.requires,
            ex.fallback,
        ));
        anchor
    }
}

impl CtOneCellAnchor {
    /// The `oneCellAnchor` counterpart of
    /// {@link CtTwoCellAnchor::new_chart_ex_anchor}.
    pub fn new_chart_ex_anchor(
        from: CtMarker,
        ext: CtPositiveSize2D,
        frame_id: u32,
        name: String,
        chart_rid: String,
        ex: ChartExFrame,
    ) -> Self {
        let mut anchor =
            Self::new_chart_anchor(from, ext, frame_id, name.clone(), chart_rid.clone());
        anchor.graphic_frame = None;
        anchor.alternate_content = Some(CtAlternateContent::chart_ex(
            chart_frame(frame_id, name, chart_rid, true),
            &ex.requires,
            ex.fallback,
        ));
        anchor
    }
}
