use std::fs;

use logiscript::execute_script;

fn test_script(path: &str) {
    println!("testing script: {:?}", path);
    let script = fs::read_to_string(path).unwrap();
    match execute_script(&script) {
        Some(error) => panic!("{:?}", error.to_string()),
        None => (),
    }
}

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
