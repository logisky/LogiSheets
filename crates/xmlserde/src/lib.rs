#[macro_export]
macro_rules! xml_serde_enum {
    (
         $(#[$outer:meta])*
        $name:ident {
            $($f:ident => $s:literal,)*
        }
    ) => {
        #[warn(dead_code)]
        $(#[$outer])*
        pub enum $name {
            $($f,)*
        }

        impl crate::XmlValue for $name {
            fn serialize(&self) -> String {
                match &self {
                    $(Self::$f => String::from($s),)*
                }
            }
            fn deserialize(s: &str) -> Result<Self, String> {
                match s {
                    $($s => Ok(Self::$f),)*
                    _ => Err(String::from("")),
                }
            }
        }
    };
}

use std::io::{BufRead, Write};

use quick_xml::events::Event;

pub trait XmlSerialize {
    fn serialize<W: Write>(&self, tag: &[u8], writer: &mut quick_xml::Writer<W>);
    fn ser_root() -> Option<&'static [u8]> {
        None
    }
}

impl<T: XmlSerialize> XmlSerialize for Option<T> {
    fn serialize<W: Write>(&self, tag: &[u8], writer: &mut quick_xml::Writer<W>) {
        match self {
            Some(t) => t.serialize(tag, writer),
            None => {}
        }
    }
}

impl<T: XmlSerialize> XmlSerialize for Vec<T> {
    fn serialize<W: Write>(&self, tag: &[u8], writer: &mut quick_xml::Writer<W>) {
        self.iter().for_each(|c| {
            let _ = c.serialize(tag, writer);
        });
    }
}

pub trait XmlDeserialize {
    fn deserialize<B: BufRead>(
        tag: &[u8],
        reader: &mut quick_xml::Reader<B>,
        attrs: quick_xml::events::attributes::Attributes,
        is_empty: bool,
    ) -> Self;

    fn de_root() -> Option<&'static [u8]> {
        None
    }

    // Used when ty = `untag`.
    fn __get_children_tags() -> Vec<&'static [u8]> {
        vec![]
    }
}

///
/// Some structs are difficult to parse using xmlserde. Fortunately, those structs
/// have little affect to us. We just need to read and write them. We use `Unparsed`
/// to keep them.
#[derive(Debug)]
pub struct Unparsed {
    data: Vec<Event<'static>>,
    attrs: Vec<(String, String)>,
}

impl XmlSerialize for Unparsed {
    fn serialize<W: Write>(&self, tag: &[u8], writer: &mut quick_xml::Writer<W>) {
        use quick_xml::events::*;
        let mut start = BytesStart::borrowed_name(tag);
        self.attrs.iter().for_each(|(k, v)| {
            let k = k as &str;
            let v = v as &str;
            start.push_attribute((k, v));
        });
        if self.data.len() > 0 {
            let _ = writer.write_event(Event::Start(start));
            self.data.iter().for_each(|e| {
                let _ = writer.write_event(e);
            });
            let _ = writer.write_event(Event::End(BytesEnd::borrowed(tag)));
        } else {
            let _ = writer.write_event(Event::Empty(start));
        }
    }
}

impl XmlDeserialize for Unparsed {
    fn deserialize<B: BufRead>(
        tag: &[u8],
        reader: &mut quick_xml::Reader<B>,
        attrs: quick_xml::events::attributes::Attributes,
        is_empty: bool,
    ) -> Self {
        use quick_xml::events::*;
        let mut attrs_vec = Vec::<(String, String)>::new();
        let mut data = Vec::<Event<'static>>::new();
        let mut buf = Vec::<u8>::new();
        attrs.into_iter().for_each(|a| {
            if let Ok(attr) = a {
                let key = String::from_utf8(attr.key.to_vec()).unwrap_or(String::from(""));
                let value = String::from_utf8(attr.value.to_vec()).unwrap_or(String::from(""));
                attrs_vec.push((key, value))
            }
        });
        if is_empty {
            return Unparsed {
                data,
                attrs: attrs_vec,
            };
        }
        loop {
            match reader.read_event(&mut buf) {
                Ok(Event::End(e)) if e.name() == tag => break,
                Ok(Event::Eof) => break,
                Err(_) => break,
                Ok(e) => data.push(e.into_owned()),
            }
        }
        Unparsed {
            data,
            attrs: attrs_vec,
        }
    }
}

pub fn xml_serialize_with_decl<T>(obj: T) -> String
where
    T: XmlSerialize,
{
    use quick_xml::events::BytesDecl;
    let mut writer = quick_xml::Writer::new(Vec::new());
    let decl = BytesDecl::new(
        b"1.0".as_ref(),
        Some(b"UTF-8".as_ref()),
        Some(b"yes".as_ref()),
    );
    let _ = writer.write_event(Event::Decl(decl));
    obj.serialize(
        T::ser_root().expect(r#"Expect a root element to serialize: #[xmlserde(root=b"tag")]"#),
        &mut writer,
    );
    String::from_utf8(writer.into_inner()).unwrap()
}

pub fn xml_serialize<T>(obj: T) -> String
where
    T: XmlSerialize,
{
    let mut writer = quick_xml::Writer::new(Vec::new());
    obj.serialize(T::ser_root().expect("Expect root"), &mut writer);
    String::from_utf8(writer.into_inner()).unwrap()
}

pub fn xml_deserialize_from_reader<T, R>(reader: R) -> Result<T, String>
where
    T: XmlDeserialize,
    R: BufRead,
{
    let mut reader = quick_xml::Reader::from_reader(reader);
    reader.trim_text(false);
    let mut buf = Vec::<u8>::new();
    let root = T::de_root().expect(r#"#[xmlserde(root = b"tag")]"#);
    loop {
        match reader.read_event(&mut buf) {
            Ok(Event::Start(start)) => {
                if start.name() == root {
                    let result = T::deserialize(root, &mut reader, start.attributes(), false);
                    return Ok(result);
                }
            }
            Ok(Event::Empty(start)) => {
                if start.name() == root {
                    let result = T::deserialize(root, &mut reader, start.attributes(), true);
                    return Ok(result);
                }
            }
            Ok(Event::Eof) => {
                return Err(format!(
                    "Cannot find the element: {}",
                    String::from_utf8(root.to_vec()).unwrap()
                ))
            }
            Err(e) => return Err(e.to_string()),
            _ => {}
        }
    }
}

/// Keep reading event until meeting the Start Event named `root` and start to deserialize.
pub fn xml_deserialize_from_str<T>(xml_str: &str) -> Result<T, String>
where
    T: XmlDeserialize,
{
    xml_deserialize_from_reader(xml_str.as_bytes())
}

pub trait XmlValue: Sized {
    fn serialize(&self) -> String;
    fn deserialize(s: &str) -> Result<Self, String>;
}

impl XmlValue for bool {
    fn serialize(&self) -> String {
        if *self {
            String::from("1")
        } else {
            String::from("0")
        }
    }

    fn deserialize(s: &str) -> Result<Self, String> {
        if s == "1" || s == "true" {
            Ok(true)
        } else if s == "0" || s == "false" {
            Ok(false)
        } else {
            Err(format!("Cannot parse {} into a boolean", s))
        }
    }
}

impl XmlValue for String {
    fn serialize(&self) -> String {
        self.to_owned()
    }

    fn deserialize(s: &str) -> Result<Self, String> {
        Ok(s.to_owned())
    }
}

macro_rules! impl_xml_value_for_num {
    ($num:ty) => {
        impl XmlValue for $num {
            fn serialize(&self) -> String {
                self.to_string()
            }

            fn deserialize(s: &str) -> Result<Self, String> {
                let r = s.parse::<$num>();
                match r {
                    Ok(f) => Ok(f),
                    Err(e) => Err(e.to_string()),
                }
            }
        }
    };
}

impl_xml_value_for_num!(u8);
impl_xml_value_for_num!(u16);
impl_xml_value_for_num!(u32);
impl_xml_value_for_num!(f64);
impl_xml_value_for_num!(i32);
impl_xml_value_for_num!(i64);

#[cfg(test)]
mod tests {
    use crate::Unparsed;

    use super::{xml_deserialize_from_str, xml_serialize, XmlValue};
    use logisheets_derives::{XmlDeserialize, XmlSerialize};

    #[test]
    fn xml_serde_enum_test() {
        xml_serde_enum! {
            T {
                A => "a",
                B => "b",
                C => "c",
            }
        }

        assert!(matches!(T::deserialize("c"), Ok(T::C)));
        assert!(matches!(T::deserialize("b"), Ok(T::B)));
        assert_eq!((T::A).serialize(), "a");
    }

    #[test]
    fn self_closed_boolean_child() {
        #[derive(XmlDeserialize, Default)]
        #[xmlserde(root = b"font")]
        struct Font {
            #[xmlserde(name = b"b", ty = "sfc")]
            bold: bool,
            #[xmlserde(name = b"i", ty = "sfc")]
            italic: bool,
            #[xmlserde(name = b"size", ty = "attr")]
            size: f64,
        }
        let xml = r#"<font size="12.2">
            <b/>
            <i/>
        </font>"#;
        let result = xml_deserialize_from_str::<Font>(xml);
        match result {
            Ok(f) => {
                assert_eq!(f.bold, true);
                assert_eq!(f.italic, true);
                assert_eq!(f.size, 12.2);
            }
            Err(_) => panic!(),
        }
    }

    #[test]
    fn derive_deserialize_vec_with_init_size_from_attr() {
        #[derive(XmlDeserialize, Default)]
        pub struct Child {
            #[xmlserde(name = b"age", ty = "attr")]
            pub age: u16,
            #[xmlserde(ty = "text")]
            pub name: String,
        }
        fn default_zero() -> u32 {
            0
        }
        #[derive(XmlDeserialize, Default)]
        #[xmlserde(root = b"root")]
        pub struct Aa {
            #[xmlserde(name = b"f", ty = "child", vec_size = "cnt")]
            pub f: Vec<Child>,
            #[xmlserde(name = b"cnt", ty = "attr", default = "default_zero")]
            pub cnt: u32,
        }
        let xml = r#"<root cnt="2">
            <f age="15">Tom</f>
            <f age="9">Jerry</f>
        </root>"#;
        let result = xml_deserialize_from_str::<Aa>(xml);
        match result {
            Ok(result) => {
                assert_eq!(result.f.len(), 2);
                assert_eq!(result.cnt, 2);
                let mut child_iter = result.f.into_iter();
                let first = child_iter.next().unwrap();
                assert_eq!(first.age, 15);
                assert_eq!(first.name, String::from("Tom"));
                let second = child_iter.next().unwrap();
                assert_eq!(second.age, 9);
                assert_eq!(second.name, String::from("Jerry"));
            }
            Err(_) => panic!(),
        }
    }

    #[test]
    fn serialize_attr_and_text() {
        #[derive(XmlSerialize)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr")]
            age: u16,
            #[xmlserde(name = b"male", ty = "attr")]
            male: bool,
            #[xmlserde(name = b"name", ty = "text")]
            name: String,
        }
        let result = xml_serialize(Person {
            age: 12,
            male: true,
            name: String::from("Tom"),
        });
        assert_eq!(result, "<Person age=\"12\" male=\"1\">Tom</Person>");
    }

    #[test]
    fn serialize_attr_and_sfc() {
        #[derive(XmlSerialize)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr")]
            age: u16,
            #[xmlserde(name = b"male", ty = "sfc")]
            male: bool,
            #[xmlserde(name = b"lefty", ty = "sfc")]
            lefty: bool,
        }
        let p1 = Person {
            age: 16,
            male: false,
            lefty: true,
        };
        let result = xml_serialize(p1);
        assert_eq!(result, "<Person age=\"16\"><lefty/></Person>");
    }

    #[test]
    fn serialize_children() {
        #[derive(XmlSerialize)]
        struct Skills {
            #[xmlserde(name = b"eng", ty = "attr")]
            english: bool,
            #[xmlserde(name = b"jap", ty = "sfc")]
            japanese: bool,
        }
        #[derive(XmlSerialize)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr")]
            age: u16,
            #[xmlserde(name = b"skills", ty = "child")]
            skills: Skills,
        }

        let p = Person {
            age: 32,
            skills: Skills {
                english: false,
                japanese: true,
            },
        };
        let result = xml_serialize(p);
        assert_eq!(
            result,
            "<Person age=\"32\"><skills eng=\"0\"><jap/></skills></Person>"
        );
    }

    #[test]
    fn serialize_opt_attr() {
        #[derive(XmlSerialize)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr")]
            age: Option<u16>,
        }
        let p = Person { age: Some(2) };
        let result = xml_serialize(p);
        assert_eq!(result, "<Person age=\"2\"/>");
        let p = Person { age: None };
        let result = xml_serialize(p);
        assert_eq!(result, "<Person/>");
    }

    #[test]
    fn deserialize_opt_attr() {
        #[derive(XmlDeserialize, Default)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr")]
            age: Option<u16>,
        }
        let xml = r#"<Person age="2"></Person>"#;
        let result = xml_deserialize_from_str::<Person>(xml);
        match result {
            Ok(p) => assert_eq!(p.age, Some(2)),
            Err(_) => panic!(),
        }
    }

    #[test]
    fn deserialize_default() {
        fn default_age() -> u16 {
            12
        }
        #[derive(XmlDeserialize)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr", default = "default_age")]
            age: u16,
            #[xmlserde(name = b"name", ty = "text")]
            name: String,
        }
        let xml = r#"<Person>Tom</Person>"#;
        let result = xml_deserialize_from_str::<Person>(xml);
        match result {
            Ok(p) => {
                assert_eq!(p.age, 12);
                assert_eq!(p.name, "Tom");
            }
            Err(_) => panic!(),
        }
    }

    #[test]
    fn serialize_skip_default() {
        fn default_age() -> u16 {
            12
        }
        #[derive(XmlSerialize)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr", default = "default_age")]
            age: u16,
            #[xmlserde(name = b"name", ty = "text")]
            name: String,
        }

        let p = Person {
            age: 12,
            name: String::from("Tom"),
        };
        let result = xml_serialize(p);
        assert_eq!(result, "<Person>Tom</Person>")
    }

    #[test]
    fn serialize_with_ns() {
        #[derive(XmlSerialize)]
        #[xmlserde(root = b"Person")]
        #[xmlserde(with_ns = b"namespace")]
        struct Person {
            #[xmlserde(name = b"age", ty = "attr")]
            age: u16,
            #[xmlserde(name = b"name", ty = "text")]
            name: String,
        }
        let p = Person {
            age: 12,
            name: String::from("Tom"),
        };
        let result = xml_serialize(p);
        assert_eq!(
            result,
            "<Person xmlns=\"namespace\" age=\"12\">Tom</Person>"
        );
    }

    #[test]
    fn scf_and_child_test() {
        #[derive(XmlDeserialize, XmlSerialize)]
        struct Child {
            #[xmlserde(name = b"age", ty = "attr")]
            age: u16,
        }

        #[derive(XmlDeserialize, XmlSerialize)]
        #[xmlserde(root = b"Person")]
        struct Person {
            #[xmlserde(name = b"lefty", ty = "sfc")]
            lefty: bool,
            #[xmlserde(name = b"c", ty = "child")]
            c: Child,
        }

        let xml = r#"<Person><lefty/><c age="12"/></Person>"#;
        let p = xml_deserialize_from_str::<Person>(xml).unwrap();
        let result = xml_serialize(p);
        assert_eq!(xml, result);
    }

    #[test]
    fn custom_ns_test() {
        #[derive(XmlDeserialize, XmlSerialize)]
        #[xmlserde(root = b"Child")]
        #[xmlserde(with_custom_ns(b"a", b"c"))]
        struct Child {
            #[xmlserde(name = b"age", ty = "attr")]
            age: u16,
        }
        let c = Child { age: 12 };
        let p = xml_serialize(c);
        assert_eq!(p, "<Child xmlns:a=\"c\" age=\"12\"/>");
    }

    #[test]
    fn enum_serialize_test() {
        #[derive(XmlDeserialize, XmlSerialize)]
        struct TestA {
            #[xmlserde(name = b"age", ty = "attr")]
            pub age: u16,
        }

        #[derive(XmlDeserialize, XmlSerialize)]
        struct TestB {
            #[xmlserde(name = b"name", ty = "attr")]
            pub name: String,
        }

        #[derive(XmlSerialize, XmlDeserialize)]
        enum TestEnum {
            #[xmlserde(name = b"testA")]
            TestA(TestA),
            #[xmlserde(name = b"testB")]
            TestB(TestB),
        }

        #[derive(XmlSerialize, XmlDeserialize)]
        #[xmlserde(root = b"Child")]
        struct Child {
            #[xmlserde(name = b"dummy", ty = "child")]
            pub c: TestEnum,
        }

        let obj = Child {
            c: TestEnum::TestA(TestA { age: 23 }),
        };
        let xml = xml_serialize(obj);
        let p = xml_deserialize_from_str::<Child>(&xml).unwrap();
        match p.c {
            TestEnum::TestA(a) => assert_eq!(a.age, 23),
            TestEnum::TestB(_) => panic!(),
        }
    }

    #[test]
    fn unparsed_serde_test() {
        #[derive(XmlSerialize, XmlDeserialize)]
        #[xmlserde(root = b"TestA")]
        pub struct TestA {
            #[xmlserde(name = b"others", ty = "child")]
            pub others: Unparsed,
        }

        let xml = r#"<TestA><others age="16" name="Tom"><gf/><parent><f/><m name="Lisa">1999</m></parent></others></TestA>"#;
        let p = xml_deserialize_from_str::<TestA>(&xml).unwrap();
        let ser = xml_serialize(p);
        assert_eq!(xml, ser);
    }

    #[test]
    fn untag_serde_test() {
        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        #[xmlserde(root = b"Root")]
        pub struct Root {
            #[xmlserde(ty = "untag")]
            pub dummy: EnumA,
        }

        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        pub enum EnumA {
            #[xmlserde(name = b"a")]
            A1(Astruct),
            #[xmlserde(name = b"b")]
            B1(Bstruct),
        }
        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        pub struct Astruct {
            #[xmlserde(name = b"aAttr", ty = "attr")]
            pub a_attr1: u32,
        }
        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        pub struct Bstruct {
            #[xmlserde(name = b"bAttr", ty = "attr")]
            pub b_attr1: u32,
        }

        let xml = r#"<Root><a aAttr="3"/></Root>"#;
        let p = xml_deserialize_from_str::<Root>(&xml).unwrap();
        match p.dummy {
            EnumA::A1(ref a) => assert_eq!(a.a_attr1, 3),
            EnumA::B1(_) => panic!(),
        }
        let ser = xml_serialize(p);
        assert_eq!(xml, &ser);
    }

    #[test]
    fn option_untag_serde_test() {
        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        #[xmlserde(root = b"Root")]
        pub struct Root {
            #[xmlserde(ty = "untag")]
            pub dummy: Option<EnumA>,
        }
        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        pub enum EnumA {
            #[xmlserde(name = b"a")]
            A1(Astruct),
        }
        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        pub struct Astruct {
            #[xmlserde(name = b"aAttr", ty = "attr")]
            pub a_attr1: u32,
        }
        #[derive(Debug, XmlSerialize, XmlDeserialize)]
        pub struct Bstruct {
            #[xmlserde(name = b"bAttr", ty = "attr")]
            pub b_attr1: u32,
        }

        let xml = r#"<Root/>"#;
        let p = xml_deserialize_from_str::<Root>(&xml).unwrap();
        assert!(matches!(p.dummy, None));
        let xml = r#"<Root><a aAttr="3"/></Root>"#;
        let p = xml_deserialize_from_str::<Root>(&xml).unwrap();
        match p.dummy {
            Some(EnumA::A1(ref a)) => assert_eq!(a.a_attr1, 3),
            None => panic!(),
        }
        let ser = xml_serialize(p);
        assert_eq!(xml, &ser);
    }
}

pub use logisheets_derives::{XmlDeserialize, XmlSerialize};
