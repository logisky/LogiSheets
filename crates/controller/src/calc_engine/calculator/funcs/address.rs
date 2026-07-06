use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_base::index_to_column_label;
use logisheets_parser::ast;

/// ADDRESS(row_num, col_num, [abs_num], [a1], [sheet_text]) — build a reference
/// as text. `abs_num` 1=$A$1, 2=A$1, 3=$A1, 4=A1 (default 1). `a1` TRUE gives A1
/// style, FALSE gives R1C1. `sheet_text` is prefixed as `Sheet!` (quoted when
/// it contains spaces/specials).
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 2 && args.len() <= 5, ast::Error::Unspecified);
    let mut it = args.into_iter();
    let row_v = fetcher.get_calc_value(it.next().unwrap());
    assert_f64_from_calc_value!(row, row_v);
    let col_v = fetcher.get_calc_value(it.next().unwrap());
    assert_f64_from_calc_value!(col, col_v);
    let abs_num = if let Some(a) = it.next() {
        let v = fetcher.get_calc_value(a);
        assert_f64_from_calc_value!(n, v);
        n.trunc() as i64
    } else {
        1
    };
    let a1 = if let Some(a) = it.next() {
        assert_bool_from_calc_value!(b, fetcher.get_calc_value(a));
        b
    } else {
        true
    };
    let sheet = if let Some(a) = it.next() {
        assert_text_from_calc_value!(s, fetcher.get_calc_value(a));
        s
    } else {
        String::new()
    };

    assert_or_return!(row >= 1., ast::Error::Value);
    assert_or_return!(col >= 1., ast::Error::Value);
    assert_or_return!((1..=4).contains(&abs_num), ast::Error::Value);
    let r = row.trunc() as i64;
    let c = col.trunc() as i64;
    let abs_row = abs_num == 1 || abs_num == 2;
    let abs_col = abs_num == 1 || abs_num == 3;

    let core = if a1 {
        let label = index_to_column_label((c - 1) as usize);
        format!(
            "{}{}{}{}",
            if abs_col { "$" } else { "" },
            label,
            if abs_row { "$" } else { "" },
            r
        )
    } else {
        let rp = if abs_row {
            format!("R{}", r)
        } else {
            format!("R[{}]", r)
        };
        let cp = if abs_col {
            format!("C{}", c)
        } else {
            format!("C[{}]", c)
        };
        format!("{}{}", rp, cp)
    };

    let result = if sheet.is_empty() {
        core
    } else {
        format!("{}!{}", quote_sheet(&sheet), core)
    };
    CalcVertex::from_string(result)
}

/// Wrap a sheet name in single quotes (doubling any internal quote) when it
/// isn't a plain identifier — mirrors Excel's reference quoting.
fn quote_sheet(name: &str) -> String {
    let plain = !name.is_empty()
        && !name.chars().next().unwrap().is_ascii_digit()
        && name
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '.');
    if plain {
        name.to_string()
    } else {
        format!("'{}'", name.replace('\'', "''"))
    }
}
