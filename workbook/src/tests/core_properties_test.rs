use crate::core_properties::*;

#[test]
fn core_properties() {
    serde_test!("../../examples/core_properties.xml", CoreProperties);
}
