use std::collections::HashMap;

use quick_xml::{events::*, Reader};

#[derive(Debug)]
pub struct Error {}

#[derive(Debug)]
pub struct Object {
    pub key_values: Vec<KeyValue>,
}

#[derive(Debug)]
pub struct KeyValue {
    pub key: String,
    pub value: Box<Value>,
    pub position: usize,
}

#[derive(Debug)]
pub enum Value {
    Element(Object),
    AttrOrText(String),
    Array(Vec<Object>),
}

#[derive(Debug)]
pub struct Decl {
    pub version: Option<String>,
    pub encoding: Option<String>,
    pub standalone: Option<String>,
}

#[derive(Debug)]
pub struct XmlData {
    pub decl: Option<Decl>,
    pub object: Object,
}

pub fn to_xml_data(xml: &str) -> XmlData {
    let mut reader = Reader::from_str(xml);
    let mut key_values = Vec::<KeyValue>::new();
    let mut decl = Option::<Decl>::None;
    loop {
        match reader.read_event() {
            Ok(Event::Start(s)) => {
                let position = reader.buffer_position();
                let name = String::from_utf8(s.name().0.to_vec()).unwrap();
                let obj = get_object(&mut reader, &name, s).unwrap();
                key_values.push(KeyValue {
                    key: name,
                    value: Box::new(Value::Element(obj)),
                    position,
                });
            }
            Ok(Event::Empty(e)) => {
                let name = get_string(e.name().0);
                let mut res = Vec::<KeyValue>::new();
                let position = reader.buffer_position();
                // Elements like <b/> only have attributes.
                e.attributes().into_iter().for_each(|attr| match attr {
                    Ok(a) => {
                        let key = get_string(a.key.0);
                        let value = get_string(&a.value);
                        res.push(KeyValue {
                            key,
                            value: Box::new(Value::AttrOrText(value)),
                            position,
                        })
                    }
                    Err(_) => {}
                });
                key_values.push(KeyValue {
                    key: name,
                    value: Box::new(Value::Element(Object { key_values: res })),
                    position,
                });
            }
            Ok(Event::Decl(d)) => {
                decl = Some(Decl {
                    version: d
                        .version()
                        .map_or(None, |v| Some(String::from_utf8(v.to_vec()).unwrap())),
                    standalone: d.standalone().map_or(None, |v| match v {
                        Ok(s) => Some(String::from_utf8(s.to_vec()).unwrap()),
                        Err(_) => None,
                    }),
                    encoding: d.encoding().map_or(None, |v| match v {
                        Ok(s) => Some(String::from_utf8(s.to_vec()).unwrap()),
                        Err(_) => None,
                    }),
                });
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }
    XmlData {
        decl,
        object: Object { key_values },
    }
}

pub fn get_object(
    reader: &mut Reader<&[u8]>,
    name: &str,
    start_event: BytesStart,
) -> Result<Object, Error> {
    let mut key_values = Vec::<KeyValue>::new();
    let position = reader.buffer_position();
    start_event
        .attributes()
        .into_iter()
        .for_each(|attr| match attr {
            Ok(a) => {
                let key = get_string(a.key.0);
                let value = get_string(&a.value);
                key_values.push(KeyValue {
                    key,
                    value: Box::new(Value::AttrOrText(value)),
                    position,
                })
            }
            Err(_) => {}
        });
    loop {
        match reader.read_event() {
            Ok(Event::Start(s)) => {
                let position = reader.buffer_position();
                let name = get_string(s.name().0);
                let object = get_object(reader, &name, s).unwrap();
                key_values.push(KeyValue {
                    key: name,
                    value: Box::new(Value::Element(object)),
                    position,
                });
            }
            Ok(Event::Text(t)) => {
                let position = reader.buffer_position();
                let str = get_string(&t.into_inner());
                if str != "" {
                    key_values.push(KeyValue {
                        key: String::from("__text__"),
                        value: Box::new(Value::AttrOrText(str)),
                        position,
                    });
                }
            }
            Ok(Event::Empty(e)) => {
                let name = get_string(e.name().0);
                let mut res = Vec::<KeyValue>::new();
                let position = reader.buffer_position();
                // Elements like <b/> only have attributes.
                e.attributes().into_iter().for_each(|attr| match attr {
                    Ok(a) => {
                        let key = get_string(a.key.0);
                        let value = get_string(&a.value);
                        res.push(KeyValue {
                            key,
                            value: Box::new(Value::AttrOrText(value)),
                            position,
                        })
                    }
                    Err(_) => {}
                });
                key_values.push(KeyValue {
                    key: name,
                    value: Box::new(Value::Element(Object { key_values: res })),
                    position,
                });
            }
            Ok(Event::End(e)) => {
                let position = reader.buffer_position();
                let end_name = get_string(e.name().0);
                if end_name != name {
                    panic!("error in {}: unmatched open tag", position)
                }
                break;
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }
    Ok(Object {
        key_values: merge_key_values(key_values),
    })
}

fn get_string(s: &[u8]) -> String {
    String::from_utf8(s.to_vec()).unwrap()
}

// In the previous process, we do not care about Vector elements.
// In this process, we merge those have same key as a KeyValue.
fn merge_key_values(unmerged: Vec<KeyValue>) -> Vec<KeyValue> {
    let mut result = Vec::<KeyValue>::with_capacity(unmerged.len());
    let mut idx_map = HashMap::<String, Vec<KeyValue>>::with_capacity(unmerged.len());
    unmerged.into_iter().for_each(|v| {
        let k = v.key.clone();
        if let Some(list) = idx_map.get_mut(&k) {
            list.push(v);
        } else {
            idx_map.insert(k, vec![v]);
        }
    });
    idx_map.into_iter().for_each(|(key, values)| {
        if values.len() == 1 {
            result.push(values.into_iter().next().unwrap());
        } else {
            let position = values[0].position;
            let list = values.into_iter().fold(vec![], |mut prev, v| {
                match *v.value {
                    Value::Element(obj) => prev.push(obj),
                    _ => {}
                };
                prev
            });
            result.push(KeyValue {
                key,
                value: Box::new(Value::Array(list)),
                position,
            });
        }
    });
    result
}
