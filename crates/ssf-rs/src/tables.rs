//! The built-in Excel number-format table and the default-format maps, ported
//! from `ssf`'s `init_table`, `default_map`, and `default_str`.

use std::collections::HashMap;
use std::sync::OnceLock;

/// `ssf.init_table` / `table_fmt`: built-in format codes by id.
pub fn builtin_table() -> &'static HashMap<u16, &'static str> {
    static T: OnceLock<HashMap<u16, &'static str>> = OnceLock::new();
    T.get_or_init(|| {
        let mut t = HashMap::new();
        t.insert(0, "General");
        t.insert(1, "0");
        t.insert(2, "0.00");
        t.insert(3, "#,##0");
        t.insert(4, "#,##0.00");
        t.insert(9, "0%");
        t.insert(10, "0.00%");
        t.insert(11, "0.00E+00");
        t.insert(12, "# ?/?");
        t.insert(13, "# ??/??");
        t.insert(14, "m/d/yy");
        t.insert(15, "d-mmm-yy");
        t.insert(16, "d-mmm");
        t.insert(17, "mmm-yy");
        t.insert(18, "h:mm AM/PM");
        t.insert(19, "h:mm:ss AM/PM");
        t.insert(20, "h:mm");
        t.insert(21, "h:mm:ss");
        t.insert(22, "m/d/yy h:mm");
        t.insert(37, "#,##0 ;(#,##0)");
        t.insert(38, "#,##0 ;[Red](#,##0)");
        t.insert(39, "#,##0.00;(#,##0.00)");
        t.insert(40, "#,##0.00;[Red](#,##0.00)");
        t.insert(45, "mm:ss");
        t.insert(46, "[h]:mm:ss");
        t.insert(47, "mmss.0");
        t.insert(48, "##0.0E+0");
        t.insert(49, "@");
        t.insert(56, "\"上午/下午 \"hh\"時\"mm\"分\"ss\"秒 \"");
        t
    })
}

/// `ssf.default_map`: ids that default to another id's format.
fn default_map_arr() -> &'static Vec<Option<u16>> {
    static M: OnceLock<Vec<Option<u16>>> = OnceLock::new();
    M.get_or_init(|| {
        let mut m: Vec<Option<u16>> = vec![None; 0x188];
        // 5 -> 37 ... 8 -> 40
        for i in 5..=8 {
            m[i] = Some((32 + i) as u16);
        }
        // 23 -> 0 ... 26 -> 0
        for i in 23..=26 {
            m[i] = Some(0);
        }
        // 27 -> 14 ... 31 -> 14
        for i in 27..=31 {
            m[i] = Some(14);
        }
        // 50 -> 14 ... 58 -> 14
        for i in 50..=58 {
            m[i] = Some(14);
        }
        // 59 -> 1 ... 62 -> 4
        for i in 59..=62 {
            m[i] = Some((i - 58) as u16);
        }
        // 67 -> 9 ... 68 -> 10
        for i in 67..=68 {
            m[i] = Some((i - 58) as u16);
        }
        // 72 -> 14 ... 75 -> 17
        for i in 72..=75 {
            m[i] = Some((i - 58) as u16);
        }
        // 67 -> 10 ... 68 -> 11 (upstream re-assigns 67/68 here; last write wins)
        for i in 67..=68 {
            m[i] = Some((i - 57) as u16);
        }
        // 76 -> 20 ... 78 -> 22
        for i in 76..=78 {
            m[i] = Some((i - 56) as u16);
        }
        // 79 -> 45 ... 81 -> 47
        for i in 79..=81 {
            m[i] = Some((i - 34) as u16);
        }
        m
    })
}

fn default_map(id: u16) -> Option<u16> {
    default_map_arr().get(id as usize).copied().flatten()
}

/// `ssf.default_str`: ids that refer to currency/accounting formats.
fn default_str(id: u16) -> Option<&'static str> {
    match id {
        5 | 63 => Some(r##""$"#,##0_);\("$"#,##0\)"##),
        6 | 64 => Some(r##""$"#,##0_);[Red]\("$"#,##0\)"##),
        7 | 65 => Some(r##""$"#,##0.00_);\("$"#,##0.00\)"##),
        8 | 66 => Some(r##""$"#,##0.00_);[Red]\("$"#,##0.00\)"##),
        41 => Some(r##"_(* #,##0_);_(* \(#,##0\);_(* "-"_);_(@_)"##),
        42 => Some(r##"_("$"* #,##0_);_("$"* \(#,##0\);_("$"* "-"_);_(@_)"##),
        43 => Some(r##"_(* #,##0.00_);_(* \(#,##0.00\);_(* "-"??_);_(@_)"##),
        44 => Some(r##"_("$"* #,##0.00_);_("$"* \(#,##0.00\);_("$"* "-"??_);_(@_)"##),
        _ => None,
    }
}

/// Resolve a numeric format id to a format string, mirroring the `number`
/// branch of `ssf.format` (using only the built-in table).
pub fn resolve_id(id: u16) -> String {
    if let Some(s) = builtin_table().get(&id) {
        return s.to_string();
    }
    if let Some(dm) = default_map(id) {
        if let Some(s) = builtin_table().get(&dm) {
            return s.to_string();
        }
    }
    if let Some(s) = default_str(id) {
        return s.to_string();
    }
    "General".to_string()
}
