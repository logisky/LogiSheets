use crate::chartsheet::*;

#[test]
fn charsheet() {
    serde_test!("../../examples/chartsheet.xml", ChartsheetPart);
}
