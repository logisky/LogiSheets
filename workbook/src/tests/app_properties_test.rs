use crate::app_properties::*;

#[test]
fn app_properties() {
    serde_test!("../../examples/app_properties.xml", AppProperties);
}
