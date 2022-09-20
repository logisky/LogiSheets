use std::fs;

use glob::glob;
use logiscript::execute_script;

#[test]
fn test_funcs() {
    let scripts = glob("tests/funcs/*.script").expect("");
    scripts.into_iter().for_each(|p| {
        let path = p.unwrap();
        println!("testing script: {:?}", path.display());
        let script = fs::read_to_string(path).unwrap();
        match execute_script(&script) {
            Some(error) => panic!("{:?}", error.to_string()),
            None => (),
        };
    });
}
