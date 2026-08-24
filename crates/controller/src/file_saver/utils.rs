use std::{collections::HashMap, hash::Hash};

use itertools::Itertools;
use logisheets_base::index_to_column_label;
use logisheets_workbook::prelude::PlainTextString;

// (0, 0) => A1
pub fn unparse_cell(row: usize, col: usize) -> String {
    let col_str = index_to_column_label(col);
    format!("{col_str}{}", row + 1)
}

/// Wrap a string as an XML text element, marking it `xml:space="preserve"` when
/// it has whitespace at either end.
///
/// That attribute is the ONLY thing that makes leading or trailing whitespace
/// significant in XML — without it a conforming reader is free to drop it, and
/// Excel does. What stood here before both deleted the whitespace it was trying
/// to protect (it wrote `trim_start`'s output as the value) and set the attribute
/// to `"".repeat(n)`, which is the empty string for every n, so the marker said
/// nothing. A string with a leading space did not survive being saved.
pub fn convert_string_to_plain_text_string(raw_string: String) -> PlainTextString {
    let needs_preserve = raw_string.starts_with(char::is_whitespace)
        || raw_string.ends_with(char::is_whitespace);
    PlainTextString {
        space: needs_preserve.then(|| String::from("preserve")),
        value: raw_string,
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
