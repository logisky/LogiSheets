use quick_xml::{events::*, Reader, Writer};
use regex::Regex;

pub fn in_one_line(xml: &str) -> String {
    let regex = Regex::new(r">\s+<").unwrap();
    let r = regex.replace_all(xml, r"><");
    r.to_string()
}

/// https://github.com/tafia/quick-xml/issues/372
pub fn to_tree(xml: &str) -> String {
    let mut reader = Reader::from_str(xml);
    let mut writer = Writer::new_with_indent(Vec::new(), 32, 4);
    loop {
        let mut buf = Vec::<u8>::new();
        match reader.read_event_into(&mut buf) {
            Ok(Event::Eof) => break,
            Ok(Event::Text(t)) if t.is_empty() => {}
            Ok(e) => {
                let _ = writer.write_event(e);
            }
            Err(_) => break,
        }
    }
    String::from_utf8(writer.into_inner()).unwrap()
}
