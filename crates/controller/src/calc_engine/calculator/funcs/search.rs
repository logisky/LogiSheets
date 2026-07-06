use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// SEARCH(find_text, within_text, [start_num]) — 1-based position of `find_text`
/// inside `within_text` from `start_num` (default 1), case-INsensitively.
/// (Wildcards are not yet supported.)
pub fn calc_search<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    find_impl(args, fetcher, false)
}

/// FIND(find_text, within_text, [start_num]) — like SEARCH but case-SENSITIVE
/// and without wildcards.
pub fn calc_find<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    find_impl(args, fetcher, true)
}

fn find_impl<C>(args: Vec<CalcVertex>, fetcher: &mut C, case_sensitive: bool) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2 || args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let a = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(find, a);
    let b = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(within, b);
    let start = if let Some(x) = args_iter.next() {
        let v = fetcher.get_calc_value(x);
        assert_f64_from_calc_value!(s, v);
        s
    } else {
        1.
    };
    assert_or_return!(start >= 1., ast::Error::Value);

    let fold = |s: &str| -> String {
        if case_sensitive {
            s.to_string()
        } else {
            s.to_lowercase()
        }
    };
    let hay: Vec<char> = fold(&within).chars().collect();
    let start_idx = start.trunc() as usize - 1;
    if start_idx > hay.len() {
        return CalcVertex::from_error(ast::Error::Value);
    }
    let needle: Vec<char> = fold(&find).chars().collect();
    // An empty find_text matches at the start position (Excel behavior).
    if needle.is_empty() {
        return CalcVertex::from_number((start_idx + 1) as f64);
    }
    let mut i = start_idx;
    while i + needle.len() <= hay.len() {
        if hay[i..i + needle.len()] == needle[..] {
            return CalcVertex::from_number((i + 1) as f64);
        }
        i += 1;
    }
    CalcVertex::from_error(ast::Error::Value)
}
