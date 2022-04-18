use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;
use unicode_segmentation::UnicodeSegmentation;

pub fn calc_left<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let func = |s: String, n: u8| -> String {
        s.graphemes(true)
            .take(n as usize)
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
    let func = |s: String, n: u8| -> String {
        let graphemes = s.graphemes(true);
        graphemes
            .rev()
            .take(n as usize)
            .fold(String::from(""), |prev, g| {
                let mut curr = g.to_string();
                curr = curr + &prev;
                curr
            })
    };
    calc(args, fetcher, func)
}

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, func: F) -> CalcVertex
where
    C: Connector,
    F: Fn(String, u8) -> String,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(s, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(n, second);
    let res = func(s, n as u8);
    CalcVertex::from_string(res)
}
