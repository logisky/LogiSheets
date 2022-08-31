use crate::xml_data::{Decl, KeyValue, Object, Value, XmlData};

#[derive(Debug, PartialEq)]
pub struct Element {
    pub tag: String,
    pub positon: usize,
}

impl From<KeyValue> for Element {
    fn from(kv: KeyValue) -> Self {
        Element {
            tag: kv.key,
            positon: kv.position,
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum Diff {
    Delete(Element),
    Create(Element),
    Update(Element),
}

pub fn diff_xml_data(xml1: XmlData, xml2: XmlData) -> Vec<Diff> {
    let mut result = compare_object(xml1.object, xml2.object);
    result.extend(compare_decl(xml1.decl, xml2.decl));
    result
}

fn compare_decl(decl1: Option<Decl>, decl2: Option<Decl>) -> Vec<Diff> {
    let element = Element {
        tag: String::from("Decl"),
        positon: 0,
    };
    match (decl1, decl2) {
        (None, None) => vec![],
        (None, Some(_)) => vec![Diff::Create(element)],
        (Some(_), None) => vec![Diff::Delete(element)],
        (Some(decl1), Some(decl2)) => {
            if decl1.encoding == decl2.encoding
                && decl1.standalone == decl2.standalone
                && decl1.version == decl2.version
            {
                vec![]
            } else {
                vec![Diff::Update(element)]
            }
        }
    }
}

// XmlData assures there is no duplicate key in Object.
pub fn compare_object(obj1: Object, obj2: Object) -> Vec<Diff> {
    let mut kvs1 = obj1.key_values;
    let mut kvs2 = obj2.key_values;
    kvs1.sort_by(|kv1, kv2| kv1.key.cmp(&kv2.key));
    kvs2.sort_by(|kv1, kv2| kv1.key.cmp(&kv2.key));

    let mut result = Vec::<Diff>::new();
    let mut kvs1 = kvs1.into_iter().peekable();
    let mut kvs2 = kvs2.into_iter().peekable();

    loop {
        let kv1 = kvs1.next();
        let kv2 = kvs2.next();
        match (kv1, kv2) {
            (None, None) => break,
            (None, Some(kv)) => result.push(Diff::Create(kv.into())),
            (Some(kv), None) => result.push(Diff::Delete(kv.into())),
            (Some(mut kv1), Some(mut kv2)) => loop {
                if kv1.key < kv2.key {
                    result.push(Diff::Delete(kv1.into()));
                    if let Some(v) = kvs1.next() {
                        kv1 = v;
                    } else {
                        result.push(Diff::Create(kv2.into()));
                        break;
                    }
                } else if kv1.key > kv2.key {
                    result.push(Diff::Create(kv2.into()));
                    if let Some(v) = kvs2.next() {
                        kv2 = v;
                    } else {
                        result.push(Diff::Delete(kv1.into()));
                        break;
                    }
                } else {
                    let v1 = *kv1.value;
                    let v2 = *kv2.value;
                    result.extend(compare_value(kv1.key, kv1.position, v1, v2));
                    break;
                }
            },
        }
    }
    return result;
}

fn compare_value(tag: String, pos1: usize, v1: Value, v2: Value) -> Vec<Diff> {
    match (v1, v2) {
        (Value::Element(obj1), Value::Element(obj2)) => compare_object(obj1, obj2),
        (Value::AttrOrText(v1), Value::AttrOrText(v2)) => {
            if v1 == v2 {
                vec![]
            } else {
                vec![Diff::Update(Element { tag, positon: pos1 })]
            }
        }
        (Value::Array(arr1), Value::Array(arr2)) => {
            if arr1.len() != arr2.len() {
                vec![Diff::Update(Element { tag, positon: pos1 })]
            } else {
                // FIXME: check the element of the array.
                vec![]
            }
        }
        _ => vec![Diff::Update(Element { tag, positon: pos1 })],
    }
}
