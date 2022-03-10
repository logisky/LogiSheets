#[macro_use]
extern crate logiutils;
#[macro_use]
extern crate derives;

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

pub mod simple_types;
pub mod complex_types;
pub mod shared_string_table;

use std::io::{BufRead, Write};

pub trait XmlSerialize {
    fn serialize<W: Write>(
        &self,
        tag: &[u8],
        writer: &mut quick_xml::Writer<W>,
    );
}

impl<T: XmlSerialize> XmlSerialize for Option<T> {
    fn serialize<W: Write>(
        &self,
        tag: &[u8],
        writer: &mut quick_xml::Writer<W>,
    ) {
        match self {
            Some(t) => {
                t.serialize(tag, writer)
            },
            None => {},
        }
    }
}

impl<T:XmlSerialize> XmlSerialize for Vec<T> {
    fn serialize<W: Write>(
        &self,
        tag: &[u8],
        writer: &mut quick_xml::Writer<W>,
    ) {
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
    ) -> Self;
}

pub fn xml_serialize<T>(root: &[u8], obj: T) -> String
where
    T: XmlSerialize,
{
    let mut writer = quick_xml::Writer::new(Vec::new());
    obj.serialize(root, &mut writer);
    String::from_utf8(writer.into_inner()).unwrap()
}

/// Keep reading event until meeting the Start Event named `root` and start to deserialize.
pub fn xml_deserialize<T>(
    root: &[u8],
    xml_str: &str,
) -> Result<T, String>
where
    T: XmlDeserialize
{
    let mut reader = quick_xml::Reader::from_str(xml_str);
    reader.trim_text(false);
    let mut buf = Vec::<u8>::new();
    use quick_xml::events::Event;
    loop {
        match reader.read_event(&mut buf) {
            Ok(Event::Start(start)) => {
                if start.name() == root {
                    let result = T::deserialize(root, &mut reader, start.attributes());
                    return Ok(result);
                }
            },
            Ok(Event::Eof) => return Err(format!("Cannot find the element: {}", String::from_utf8(root.to_vec()).unwrap())),
            Err(e) => return Err(e.to_string()),
            _ => {},
        }
    }
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
                    Err(e) => {
                        Err(e.to_string())
                    },
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
    use derives::{XmlDeserialize, XmlSerialize};
    use super::{XmlValue, xml_deserialize, xml_serialize};

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
        struct Font {
            #[xmlserde(name = b"b", ty="sfc")]
            bold: bool,
            #[xmlserde(name = b"i", ty="sfc")]
            italic: bool,
            #[xmlserde(name = b"size", ty="attr")]
            size: f64,

        }
        let xml = r#"<font size="12.2">
            <b/>
            <i/>
        </font>"#;
        let result = xml_deserialize::<Font>(b"font", xml);
        match result {
            Ok(f) => {
                assert_eq!(f.bold, true);
                assert_eq!(f.italic, true);
                assert_eq!(f.size, 12.2);
            },
            Err(_) => panic!(),
        }
    }

    #[test]
    fn derive_deserialize_vec_with_init_size_from_attr() {
        #[derive(XmlDeserialize, Default)]
        pub struct Child {
            #[xmlserde(name = b"age", ty="attr")]
            pub age: u16,
            #[xmlserde(ty="text")]
            pub name: String,
        }
        fn default_zero() -> u32 {0}
        #[derive(XmlDeserialize, Default)]
        pub struct Aa {
            #[xmlserde(name=b"f", ty="child", vec_size = "cnt")]
            pub f: Vec<Child>,
            #[xmlserde(name=b"cnt", ty="attr", default="default_zero")]
            pub cnt: u32,
        }
        let xml = r#"<root cnt="2">
            <f age="15">Tom</f>
            <f age="9">Jerry</f>
        </root>"#;
        let result = xml_deserialize::<Aa>(b"root", xml);
        match result {
            Ok(result) => {
                assert_eq!(result.f.len(), 2);
                assert_eq!(result.cnt, 2);
                let mut child_iter= result.f.into_iter();
                let first = child_iter.next().unwrap();
                assert_eq!(first.age, 15);
                assert_eq!(first.name, String::from("Tom"));
                let second= child_iter.next().unwrap();
                assert_eq!(second.age, 9);
                assert_eq!(second.name, String::from("Jerry"));
            },
            Err(_) => panic!(),
        }
    }

    #[test]
    fn serialize_attr_and_text() {
        #[derive(XmlSerialize)]
        struct Person {
            #[xmlserde(name=b"age", ty="attr")]
            age: u16,
            #[xmlserde(name=b"male", ty="attr")]
            male: bool,
            #[xmlserde(name=b"name", ty="text")]
            name: String,
        }
        let result = xml_serialize(b"Person", Person {
            age: 12,
            male: true,
            name: String::from("Tom"),
        });
        assert_eq!(result, "<Person age=\"12\" male=\"1\">Tom</Person>");
    }

    #[test]
    fn serialize_attr_and_sfc() {
        #[derive(XmlSerialize)]
        struct Person {
            #[xmlserde(name=b"age", ty="attr")]
            age: u16,
            #[xmlserde(name=b"male", ty="sfc")]
            male: bool,
            #[xmlserde(name=b"lefty", ty="sfc")]
            lefty: bool,
        }
        let p1 = Person {
            age: 16,
            male: false,
            lefty: true,
        };
        let result = xml_serialize(b"Person", p1);
        assert_eq!(result, "<Person age=\"16\"><lefty/></Person>");
    }

    #[test]
    fn serialize_children() {
        #[derive(XmlSerialize)]
        struct Skills {
            #[xmlserde(name=b"eng", ty="attr")]
            english: bool,
            #[xmlserde(name=b"jap", ty="sfc")]
            japanese: bool,
        }
        #[derive(XmlSerialize)]
        struct Person {
            #[xmlserde(name=b"age", ty="attr")]
            age: u16,
            #[xmlserde(name=b"skills", ty="child")]
            skills: Skills,
        }

        let p = Person {
            age: 32,
            skills: Skills { english: false, japanese: true }
        };
        let result = xml_serialize(b"Person", p);
        assert_eq!(result, "<Person age=\"32\"><skills eng=\"0\"><jap/></skills></Person>");
    }

    #[test]
    fn serialize_opt_attr() {
        #[derive(XmlSerialize)]
        struct Person {
            #[xmlserde(name = b"age", ty ="attr")]
            age: Option<u16>,
        }
        let p = Person { age: Some(2) };
        let result = xml_serialize(b"Person", p);
        assert_eq!(result, "<Person age=\"2\"></Person>");
        let p = Person { age: None };
        let result = xml_serialize(b"Person", p);
        assert_eq!(result, "<Person></Person>");
    }

    #[test]
    fn deserialize_opt_attr() {
        #[derive(XmlDeserialize, Default)]
        struct Person {
            #[xmlserde(name = b"age", ty ="attr")]
            age: Option<u16>,
        }
        let xml = r#"<Person age="2"></Person>"#;
        let result = xml_deserialize::<Person>(b"Person", xml);
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
        struct Person {
            #[xmlserde(name=b"age", ty="attr", default="default_age")]
            age: u16,
            #[xmlserde(name=b"name", ty="text")]
            name: String,
        }
        let xml = r#"<Person>Tom</Person>"#;
        let result = xml_deserialize::<Person>(b"Person", xml);
        match result {
            Ok(p) => {
                assert_eq!(p.age, 12);
                assert_eq!(p.name, "Tom");
            },
            Err(_) => panic!(),
        }
    }

    #[test]
    fn serialize_skip_default() {
        fn default_age() -> u16 {
            12
        }
        #[derive(XmlSerialize)]
        struct Person {
            #[xmlserde(name=b"age", ty="attr", default="default_age")]
            age: u16,
            #[xmlserde(name=b"name", ty="text")]
            name: String,
        }

        let p = Person { age: 12, name: String::from("Tom")};
        let result = xml_serialize(b"Person", p);
        assert_eq!(result, "<Person>Tom</Person>")
    }
}
