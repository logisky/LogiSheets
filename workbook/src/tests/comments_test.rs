use crate::comments::*;

#[test]
fn comments() {
    serde_test!("../../examples/comments.xml", Comments);
}
