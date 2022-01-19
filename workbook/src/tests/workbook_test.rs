use crate::workbook::*;
use crate::xml_element::*;

#[test]
fn serde() {
    let workbook = WorkbookPart::from_xml_file("examples/workbook.xml");
    println!("{:?}", workbook);
    let se = quick_xml::se::to_string(&workbook.unwrap()).unwrap();
    println!("{:?}", se);
}

#[test]
fn workbook() {
    serde_test!("../../examples/workbook.xml", WorkbookPart);
}
