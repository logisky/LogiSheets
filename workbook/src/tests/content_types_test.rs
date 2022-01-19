use crate::content_types::*;

#[test]
fn content_types() {
    serde_test!("../../examples/[Content_Types].xml", ContentTypes);
}
