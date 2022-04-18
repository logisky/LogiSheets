use im::hashmap::HashMap;
use serde::Serialize;

#[derive(Debug, Clone)]
struct KeyValue<K, V>
where
    K: Serialize + Clone,
    V: Clone,
{
    pub key: K,
    pub value: V,
}

#[derive(Debug, Clone, Default)]
pub struct OoxmlElementMap<K: Serialize, V>
where
    K: Serialize + Clone,
    V: Clone,
{
    core: HashMap<String, KeyValue<K, V>>,
}

impl<K: Serialize, V> OoxmlElementMap<K, V>
where
    K: Serialize + Clone,
    V: Clone,
{
    pub fn insert(&mut self, key: K, value: V) {
        let s = quick_xml::se::to_string(&key).unwrap();
        let key_value = KeyValue { key, value };
        self.core.insert(s, key_value);
    }

    pub fn get(&self, key: &K) -> Option<&V> {
        let s = quick_xml::se::to_string(&key).unwrap();
        let key_value = self.core.get(&s)?;
        Some(&key_value.value)
    }

    pub fn new() -> Self {
        OoxmlElementMap {
            core: HashMap::new(),
        }
    }
}

use logisheets_base::column_label_to_index;
use regex::Regex;

lazy_static! {
    static ref A1_ADDR_REGEX: Regex = Regex::new(r#"\$?([A-Za-z]+)\$?([0-9]+)"#).unwrap();
}
// A1 => (0, 0)
pub fn parse_cell(r: &str) -> Option<(usize, usize)> {
    let capture = A1_ADDR_REGEX.captures_iter(&r).next()?;
    let c = capture.get(1)?.as_str();
    let r = capture.get(2)?.as_str();
    let col_idx = column_label_to_index(c);
    match r.parse::<usize>() {
        Ok(row_idx) => Some((row_idx - 1, col_idx)),
        Err(_) => None,
    }
}

pub fn parse_range(r: &str) -> Option<((usize, usize), (usize, usize))> {
    let mut s = r.split(':');
    let start = s.next()?.trim();
    let end = s.next()?.trim();
    let start_addr = parse_cell(start)?;
    let end_addr = parse_cell(end)?;
    Some((start_addr, end_addr))
}

#[cfg(test)]
mod tests {
    use super::{parse_cell, parse_range};
    #[test]
    fn parse_cell_test() {
        let s = "$A$2";
        let r = parse_cell(s);
        assert!(matches!(r, Some((1, 0))));
        let s = "A$2";
        let r = parse_cell(s);
        assert!(matches!(r, Some((1, 0))));
        let s = "AA2";
        let r = parse_cell(s);
        assert!(matches!(r, Some((1, 26))));
        let s = "AA20";
        let r = parse_cell(s);
        assert!(matches!(r, Some((19, 26))));
        let s = "A9";
        let r = parse_cell(s);
        assert!(matches!(r, Some((8, 0))));
    }

    #[test]
    fn parse_range_test() {
        let s = "A2:B4";
        let r = parse_range(s);
        assert!(matches!(r, Some(((1, 0), (3, 1)))));
    }
}
