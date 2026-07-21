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
#[xmlserde(with_custom_ns(
    b"xdr",
    b"http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
))]
#[xmlserde(with_custom_ns(b"a", b"http://schemas.openxmlformats.org/drawingml/2006/main"))]
#[xmlserde(with_custom_ns(
    b"r",
    b"http://schemas.openxmlformats.org/officeDocument/2006/relationships"
))]
#[xmlserde(with_custom_ns(
    b"c",
    b"http://schemas.openxmlformats.org/drawingml/2006/chart"
))]
pub struct CtWsDr {
    #[xmlserde(name = b"xdr:twoCellAnchor", ty = "child")]
    pub two_cell_anchors: Vec<CtTwoCellAnchor>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTwoCellAnchor {
    #[xmlserde(name = b"editAs", ty = "attr", default = "default_edit_as")]
    pub edit_as: String,
    #[xmlserde(name = b"xdr:from", ty = "child")]
    pub from: CtMarker,
    #[xmlserde(name = b"xdr:to", ty = "child")]
    pub to: CtMarker,
    #[xmlserde(name = b"xdr:pic", ty = "child")]
    pub pic: Option<CtPic>,
    // A `twoCellAnchor` hosts exactly one object. `pic` (images we create) and
    // `graphicFrame` (charts — we both read their reference and re-emit them on
    // save) are modeled structurally. Shapes/groups/connectors are preserved
    // verbatim as `Unparsed` so drawings authored elsewhere (text boxes etc.)
    // round-trip. A chart's `graphicFrame` points at a chart part via the
    // drawing's relationships; the chart part itself is a `PassthroughPart`.
    #[xmlserde(name = b"xdr:sp", ty = "child")]
    pub sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:grpSp", ty = "child")]
    pub grp_sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:graphicFrame", ty = "child")]
    pub graphic_frame: Option<CtGraphicFrame>,
    #[xmlserde(name = b"xdr:cxnSp", ty = "child")]
    pub cxn_sp: Option<Unparsed>,
    #[xmlserde(name = b"xdr:contentPart", ty = "child")]
    pub content_part: Option<Unparsed>,
    #[xmlserde(name = b"xdr:clientData", ty = "child")]
    pub client_data: Option<CtAnchorClientData>,
}

/// A cell anchor marker: `<xdr:col>`, `<xdr:colOff>`, `<xdr:row>`, `<xdr:rowOff>`.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtMarker {
    #[xmlserde(name = b"xdr:col", ty = "child")]
    pub col: XdrI32,
    #[xmlserde(name = b"xdr:colOff", ty = "child")]
    pub col_off: XdrI64,
    #[xmlserde(name = b"xdr:row", ty = "child")]
    pub row: XdrI32,
    #[xmlserde(name = b"xdr:rowOff", ty = "child")]
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
    pub nv_pic_pr: Option<CtPictureNonVisual>,
    #[xmlserde(name = b"xdr:blipFill", ty = "child")]
    pub blip_fill: Option<CtBlipFillProperties>,
    #[xmlserde(name = b"xdr:spPr", ty = "child")]
    pub sp_pr: Option<CtPicShapeProperties>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPictureNonVisual {
    #[xmlserde(name = b"xdr:cNvPr", ty = "child")]
    pub c_nv_pr: Option<CtNvDrawingProps>,
    #[xmlserde(name = b"xdr:cNvPicPr", ty = "child")]
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
// anchor on save. `nvGraphicFramePr` and `graphic/graphicData/c:chart` are
// typed; `xfrm` is preserved opaquely (Excel recomputes it from the anchor's
// from/to on a twoCellAnchor). Non-chart graphicData (e.g. SmartArt) is not
// modeled and would not round-trip — charts are the supported case.
#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicFrame {
    #[xmlserde(name = b"xdr:nvGraphicFramePr", ty = "child")]
    pub nv_graphic_frame_pr: Option<CtGraphicFrameNonVisual>,
    #[xmlserde(name = b"xdr:xfrm", ty = "child")]
    pub xfrm: Option<Unparsed>,
    #[xmlserde(name = b"a:graphic", ty = "child")]
    pub graphic: Option<CtGraphicalObject>,
}

#[derive(Debug, Default, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicFrameNonVisual {
    #[xmlserde(name = b"xdr:cNvPr", ty = "child")]
    pub c_nv_pr: Option<CtNvDrawingProps>,
    #[xmlserde(name = b"xdr:cNvGraphicFramePr", ty = "child")]
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
}

impl Default for CtGraphicalObjectData {
    fn default() -> Self {
        CtGraphicalObjectData {
            uri: String::from("http://schemas.openxmlformats.org/drawingml/2006/chart"),
            chart: None,
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
            graphic_frame: Some(CtGraphicFrame {
                nv_graphic_frame_pr: Some(CtGraphicFrameNonVisual {
                    c_nv_pr: Some(CtNvDrawingProps {
                        id: frame_id,
                        name,
                        descr: String::new(),
                    }),
                    c_nv_graphic_frame_pr: Some(CtNvGraphicFrameProps::default()),
                }),
                xfrm: None,
                graphic: Some(CtGraphicalObject {
                    graphic_data: Some(CtGraphicalObjectData {
                        uri: String::from(
                            "http://schemas.openxmlformats.org/drawingml/2006/chart",
                        ),
                        chart: Some(CChart {
                            r_id: Some(chart_rid),
                        }),
                    }),
                }),
            }),
            cxn_sp: None,
            content_part: None,
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
