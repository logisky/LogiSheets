use std::{collections::HashMap, hash::Hash};

use itertools::Itertools;
use logisheets_base::index_to_column_label;
use logisheets_workbook::prelude::PlainTextString;

// (0, 0) => A1
pub fn unparse_cell(row: usize, col: usize) -> String {
    let col_str = index_to_column_label(col);
    format!("{col_str}{}", row + 1)
}

pub fn convert_string_to_plain_text_string(raw_string: String) -> PlainTextString {
    let s = raw_string.trim_start();

    if s.len() == raw_string.len() {
        PlainTextString {
            value: raw_string,
            space: None,
        }
    } else {
        PlainTextString {
            value: s.to_string(),
            space: Some("".repeat(raw_string.len() - s.len()).to_string()),
        }
    }
}

pub struct SortedSet<V: Hash + Eq> {
    inner: HashMap<V, usize>,
}

impl<V: Hash + Eq> SortedSet<V> {
    pub fn new() -> Self {
        SortedSet {
            inner: HashMap::new(),
        }
    }
    pub fn insert(&mut self, v: V) -> usize {
        match self.inner.get(&v) {
            Some(r) => *r,
            None => {
                let l = self.inner.len();
                self.inner.insert(v, l);
                l
            }
        }
    }

    pub fn to_vec(self) -> Vec<V> {
        self.inner
            .into_iter()
            .sorted_by_key(|(_, v)| *v)
            .map(|(k, _)| k)
            .collect()
    }
}
