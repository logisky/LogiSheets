// use crate::shared_string_table::*;

// Some plain text contains the spaces at the start or end. In this case, its parent
// should have an attribute like below indicating that these spaces should be preserved.
// xml:space = "preserve"
// https://github.com/tafia/quick-xml/issues/285

#[test]
fn sst() {
    // serde_test!("../../examples/sst.xml", SstPart);
}
