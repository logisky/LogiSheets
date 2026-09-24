//! A structural diff of two XML documents, used by `logisheets_workbook`'s
//! round-trip tests to check that a part written back matches the one read.
//!
//! It compares structure, not text: attribute order and the order of
//! differently-named siblings are ignored. Each element becomes a map from child tag (or
//! attribute name, or `__text__`) to value, and the maps are compared by key.
//!
//! Known blind spot: siblings sharing a tag are compared only by COUNT. Two
//! `<row>` lists of equal length pass even when every row differs, so a clean
//! diff is weaker evidence than it looks for repeated elements.

pub use diff::Diff;
use diff::diff_xml_data;
use xml_data::to_xml_data;

mod diff;
mod xml_data;

/// The differences between `xml1` and `xml2`; empty when they match (subject
/// to the blind spot above). Parsing stops quietly at the first XML error,
/// so malformed input compares as whatever parsed before it.
///
/// # Panics
///
/// On a closing tag that does not match its opening tag.
pub fn diff(xml1: &str, xml2: &str) -> Vec<Diff> {
    let data1 = to_xml_data(xml1);
    let data2 = to_xml_data(xml2);
    diff_xml_data(data1, data2)
}
