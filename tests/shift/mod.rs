use super::test_script;

#[test]
fn test_insert_row() {
    test_script("tests/shift/insert_row.script");
}

#[test]
fn test_delete_row() {
    test_script("tests/shift/delete_row.script");
}

#[test]
fn test_insert_col() {
    test_script("tests/shift/insert_col.script");
}

#[test]
fn test_delete_col() {
    test_script("tests/shift/delete_col.script");
}
