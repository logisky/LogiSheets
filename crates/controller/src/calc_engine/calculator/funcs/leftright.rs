use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;
use unicode_segmentation::UnicodeSegmentation;

/// MID(text, start_num, num_chars) — `num_chars` graphemes of `text` starting at
/// 1-based `start_num`. start_num < 1 or num_chars < 0 is #VALUE!; a start past
/// the end yields an empty string.
pub fn calc_mid<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(s, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(start, second);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(count, third);
    assert_or_return!(start >= 1., ast::Error::Value);
    assert_or_return!(count >= 0., ast::Error::Value);
    let skip = start.trunc() as usize - 1;
    let take = count.trunc() as usize;
    let res: String = s.graphemes(true).skip(skip).take(take).collect();
    CalcVertex::from_string(res)
}

pub fn calc_left<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |s: String, n: usize| -> String {
        s.graphemes(true)
            .take(n)
            .fold(String::from(""), |mut prev, g| {
                prev.push_str(g);
                prev
            })
    };
    calc(args, fetcher, func)
}

pub fn calc_right<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |s: String, n: usize| -> String {
        let graphemes = s.graphemes(true);
        graphemes.rev().take(n).fold(String::from(""), |prev, g| {
            let mut curr = g.to_string();
            curr = curr + prev.as_str();
            curr
        })
    };
    calc(args, fetcher, func)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(String, usize) -> String,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(s, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(n, second);
    // Negative num_chars is #VALUE!; otherwise take that many graphemes
    // (capping past the string length is handled by `take`).
    assert_or_return!(n >= 0., ast::Error::Value);
    let res = func(s, n.trunc() as usize);
    CalcVertex::from_string(res)
}
