//! Section selection (`choose_fmt`) and the public `format` entry, ported from
//! `ssf`.

use regex::Regex;
use std::sync::OnceLock;

use crate::evalfmt::{eval_fmt, fmt_is_date, split_fmt, Value};
use crate::general::general_fmt_num_value;
use crate::helpers::isgeneral;
use crate::tables::resolve_id;

fn cfregex() -> &'static Regex {
    static C: OnceLock<Regex> = OnceLock::new();
    C.get_or_init(|| Regex::new(r"\[[=<>]").unwrap())
}
fn cfregex2() -> &'static Regex {
    static C: OnceLock<Regex> = OnceLock::new();
    C.get_or_init(|| Regex::new(r"\[(=|>=?|<[>=]?)(-?\d+(?:\.\d*)?)\]").unwrap())
}

fn parse_cond(fmt: &str) -> Option<(String, f64)> {
    cfregex2().captures(fmt).map(|c| {
        (
            c.get(1).unwrap().as_str().to_string(),
            c.get(2).unwrap().as_str().parse::<f64>().unwrap(),
        )
    })
}

fn chkcond(v: f64, rr: &Option<(String, f64)>) -> bool {
    match rr {
        None => false,
        Some((op, thresh)) => match op.as_str() {
            "=" => v == *thresh,
            ">" => v > *thresh,
            "<" => v < *thresh,
            "<>" => v != *thresh,
            ">=" => v >= *thresh,
            "<=" => v <= *thresh,
            _ => false,
        },
    }
}

/// `ssf.choose_fmt(f, v)` -> `(flen, chosen_format)`.
fn choose_fmt(f: &str, v: &Value) -> Result<(usize, String), String> {
    let mut fmt = split_fmt(f)?;
    let mut l = fmt.len();
    let lat = fmt[l - 1].contains('@');
    if l < 4 && lat {
        l -= 1;
    }
    if fmt.len() > 4 {
        return Err(format!("cannot find right format for |{}|", fmt.join("|")));
    }

    let vnum = match v {
        Value::Num(n) => *n,
        Value::Text(_) => {
            let chosen = if fmt.len() == 4 || lat {
                fmt[fmt.len() - 1].clone()
            } else {
                "@".to_string()
            };
            return Ok((4, chosen));
        }
    };

    fmt = match fmt.len() {
        1 => {
            if lat {
                vec!["General".into(), "General".into(), "General".into(), fmt[0].clone()]
            } else {
                vec![fmt[0].clone(), fmt[0].clone(), fmt[0].clone(), "@".into()]
            }
        }
        2 => {
            if lat {
                vec![fmt[0].clone(), fmt[0].clone(), fmt[0].clone(), fmt[1].clone()]
            } else {
                vec![fmt[0].clone(), fmt[1].clone(), fmt[0].clone(), "@".into()]
            }
        }
        3 => {
            if lat {
                vec![fmt[0].clone(), fmt[1].clone(), fmt[0].clone(), fmt[2].clone()]
            } else {
                vec![fmt[0].clone(), fmt[1].clone(), fmt[2].clone(), "@".into()]
            }
        }
        _ => fmt,
    };

    let ff = if vnum > 0.0 {
        fmt[0].clone()
    } else if vnum < 0.0 {
        fmt[1].clone()
    } else {
        fmt[2].clone()
    };

    if !fmt[0].contains('[') && !fmt[1].contains('[') {
        return Ok((l, ff));
    }
    if cfregex().is_match(&fmt[0]) || cfregex().is_match(&fmt[1]) {
        let m1 = parse_cond(&fmt[0]);
        let m2 = parse_cond(&fmt[1]);
        if chkcond(vnum, &m1) {
            return Ok((l, fmt[0].clone()));
        }
        if chkcond(vnum, &m2) {
            return Ok((l, fmt[1].clone()));
        }
        let idx = if m1.is_some() && m2.is_some() { 2 } else { 1 };
        return Ok((l, fmt[idx].clone()));
    }
    Ok((l, ff))
}

/// `ssf.format(fmt, v, opts)` for a string format code.
pub fn format(fmt: &str, v: &Value, date1904: bool) -> Result<String, String> {
    let sfmt = fmt;
    if isgeneral(sfmt, 0) {
        return Ok(general_of(v));
    }
    let f = choose_fmt(sfmt, v)?;
    if isgeneral(&f.1, 0) {
        return Ok(general_of(v));
    }
    if let Value::Text(t) = v {
        if t.is_empty() {
            return Ok(String::new());
        }
    }
    eval_fmt(&f.1, v, date1904, f.0)
}

/// `ssf.format` for a numeric format id.
pub fn format_id(id: u16, v: &Value, date1904: bool) -> Result<String, String> {
    let sfmt = resolve_id(id);
    format(&sfmt, v, date1904)
}

fn general_of(v: &Value) -> String {
    match v {
        Value::Num(n) => general_fmt_num_value(*n),
        Value::Text(t) => t.clone(),
    }
}

/// Silence unused-import warning; `fmt_is_date` is part of the public surface.
#[allow(dead_code)]
fn _uses_is_date(s: &str) -> bool {
    fmt_is_date(s)
}
