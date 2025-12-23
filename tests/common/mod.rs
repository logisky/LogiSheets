use super::test_script;

#[test]
fn test_lower_case() {
    test_script("tests/common/lower_case.script");
}

#[test]
fn test_deps1() {
    test_script("tests/common/deps1.script");
}

#[test]
fn test_deps2() {
    test_script("tests/common/deps2.script");
}
