#[macro_use]
extern crate logiutils;
#[macro_use]
extern crate derives;

use std::io::BufRead;

pub trait XmlSerialize {}

pub trait XmlDeserialize {
    fn deserialize<B: BufRead>(
        tag: &[u8],
        reader: &mut quick_xml::Reader<B>,
        attrs: quick_xml::events::attributes::Attributes,
    ) -> Self;
}

/// Keep reading event until meeting the Start Event named `root` and start to deserialize.
pub fn xml_deserialize<T>(
    root: &[u8],
    xml_str: &str) -> Result<T, String>
where
    T: Default + XmlDeserialize
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

macro_rules! xml_serde_enum {
    (
        $name:ident {
            $($f:ident => $s:literal,)*
        }
    ) => {
        #[warn(dead_code)]
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

#[cfg(test)]
mod tests {
    use derives::XmlDeserialize;
    use super::{XmlValue, xml_deserialize};

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
        #[derive(XmlDeserialize, Default)]
        pub struct Aa {
            #[xmlserde(name=b"f", ty="child", vec_size = "cnt")]
            pub f: Vec<Child>,
            #[xmlserde(name=b"cnt", ty="attr")]
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
}
