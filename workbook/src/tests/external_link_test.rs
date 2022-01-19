use crate::external_link::*;

#[test]
fn external_link() {
    serde_test!("../../examples/external_link.xml", ExternalLinkPart);
}
