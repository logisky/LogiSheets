use diff::diff_xml_data;
pub use diff::Diff;
use xml_data::to_xml_data;

mod diff;
mod xml_data;

pub fn diff(xml1: &str, xml2: &str) -> Vec<Diff> {
    let data1 = to_xml_data(xml1);
    let data2 = to_xml_data(xml2);
    diff_xml_data(data1, data2)
}
