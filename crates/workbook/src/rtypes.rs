#[derive(PartialEq, Eq)]
pub struct RType<'a>(pub &'a str);

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
pub const DOC_PROP_APP: RType = RType(
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
);
pub const DOC_PROP_CORE: RType =
    RType("http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties");

pub const DOC_PROP_CUSTOM: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties");

pub const LOGISHEETS_APP_DATA: RType =
    RType("http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-data");

impl<'a> PartialEq<str> for RType<'a> {
    fn eq(&self, other: &str) -> bool {
        self.0 == other
    }
}
