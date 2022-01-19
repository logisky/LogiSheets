use crate::custom::*;

#[test]
fn custom_properties() {
    serde_test!("../../examples/custom.xml", Properties);
}
