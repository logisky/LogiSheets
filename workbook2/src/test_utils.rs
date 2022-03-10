use regex::Regex;

pub fn in_one_line(xml: &str) -> String {
    let regex = Regex::new(r">\s+<").unwrap();
    let r = regex.replace_all(xml, r"><");
    r.to_string()
}
