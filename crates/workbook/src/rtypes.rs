#[derive(PartialEq, Eq, Debug, Clone, Copy)]
pub struct RType<'a>(pub &'a str);

/// A relationship type this crate does not model. Parts reached through one are
/// carried as `UnknownPart`s, which keep their real type on the relationship
/// itself; this stands in where an `RType` is structurally required.
pub const UNMODELED: RType = RType("");

pub const WORKBOOK: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument");
pub const WORKSHEET: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet");
pub const SST: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings");
pub const EXT_LINK: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink");
pub const STYLE: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles");
pub const COMMENTS: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments");
pub const THEME: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme");
pub const DRAWING: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing");
pub const IMAGE: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
// A chart is anchored in a worksheet drawing via a `<xdr:graphicFrame>` whose
// `<c:chart r:id>` points at a chart part (`xl/charts/chartN.xml`) through the
// drawing's relationships.
pub const CHART: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart");
// Microsoft chart style / color-style satellites of a chart part
// (`xl/charts/styleN.xml`, `xl/charts/colorsN.xml`).
pub const CHART_STYLE: RType =
    RType("http://schemas.microsoft.com/office/2011/relationships/chartStyle");
pub const CHART_COLOR_STYLE: RType =
    RType("http://schemas.microsoft.com/office/2011/relationships/chartColorStyle");
pub const DOC_PROP_APP: RType = RType(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
);
pub const DOC_PROP_CORE: RType =
    RType("http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties");

pub const DOC_PROP_CUSTOM: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties");

pub const LOGISHEETS_APP_DATA: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/logisheets");

// Microsoft extensions for threaded comments (Excel 2018+). Threaded comments
// are worksheet-scoped; persons are workbook-scoped.
pub const THREADED_COMMENT: RType =
    RType("http://schemas.microsoft.com/office/2017/10/relationships/threadedComment");
pub const PERSON: RType = RType("http://schemas.microsoft.com/office/2017/10/relationships/person");

// Pivot tables. A pivot cache is workbook-scoped: `workbook.xml` links a
// `pivotCacheDefinition` (which links its `pivotCacheRecords`). A pivot table is
// worksheet-scoped: `sheetN.xml` links a `pivotTable`, which links back to the
// `pivotCacheDefinition` it draws from.
pub const PIVOT_CACHE_DEFINITION: RType = RType(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition",
);
pub const PIVOT_CACHE_RECORDS: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheRecords");
pub const PIVOT_TABLE: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable");

// An Excel structured table / ListObject part (`xl/tables/tableN.xml`),
// worksheet-scoped and also listed in the worksheet's `<tableParts>`.
pub const TABLE: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/table");

impl<'a> PartialEq<str> for RType<'a> {
    fn eq(&self, other: &str) -> bool {
        self.0 == other
    }
}
