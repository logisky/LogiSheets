macro_rules! serde_test {
    ($path:literal, $serde_obj:ident) => {
        use crate::xml_element::*;
        use regex::Regex;
        let s = include_str!($path);
        let regex = Regex::new(r">\s+<").unwrap();
        let actual = regex.replace_all(s, r"><");
        let obj = $serde_obj::from_xml_str(s).unwrap();
        let xml = obj.to_xml_string().unwrap();
        let quote = Regex::new(r#"&quot;"#).unwrap();
        let single_quote = Regex::new(r#"'"#).unwrap();
        let actual = quote.replace_all(actual.as_ref(), r#"""#);
        let actual = single_quote.replace_all(actual.as_ref(), r#"""#);
        let xml = quote.replace_all(xml.as_ref(), r#"""#);
        assert_eq!(actual, xml);
    };
}
