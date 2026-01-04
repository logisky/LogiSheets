use super::test_script;

#[test]
fn test_create_block() {
    test_script("tests/block/create_block.script");
}

#[test]
fn test_move_block() {
    test_script("tests/block/move_block.script");
}

#[test]
fn test_resize_block() {
    test_script("tests/block/resize_block.script");
}

#[test]
fn test_convert_block() {
    test_script("tests/block/convert_block.script");
}
