use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// CHAR(number) — the character for a code point in 1..=255.
pub fn calc_char<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let v = fetcher.get_calc_value(args.into_iter().next().unwrap());
    assert_f64_from_calc_value!(n, v);
    let code = n.trunc() as i64;
    if code < 1 || code > 255 {
        return CalcVertex::from_error(ast::Error::Value);
    }
    match char::from_u32(code as u32) {
        Some(c) => CalcVertex::from_string(c.to_string()),
        None => CalcVertex::from_error(ast::Error::Value),
    }
}

/// CODE(text) — the numeric code of the first character of `text`.
pub fn calc_code<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let v = fetcher.get_calc_value(args.into_iter().next().unwrap());
    assert_text_from_calc_value!(s, v);
    match s.chars().next() {
        Some(c) => CalcVertex::from_number(c as u32 as f64),
        None => CalcVertex::from_error(ast::Error::Value),
    }
}

/// VALUE(text) — parse text as a number. A single trailing `%` divides by 100.
/// Non-numeric text is #VALUE!.
pub fn calc_value<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let v = fetcher.get_calc_value(args.into_iter().next().unwrap());
    assert_text_from_calc_value!(s, v);
    let t = s.trim();
    let (body, scale) = if let Some(stripped) = t.strip_suffix('%') {
        (stripped.trim(), 0.01)
    } else {
        (t, 1.0)
    };
    match body.parse::<f64>() {
        Ok(n) => CalcVertex::from_number(n * scale),
        Err(_) => CalcVertex::from_error(ast::Error::Value),
    }
}

/// SUBSTITUTE(text, old_text, new_text, [instance_num]) — replace occurrences of
/// `old_text` with `new_text`. With `instance_num`, only that occurrence is
/// replaced. An empty `old_text` leaves the text unchanged.
pub fn calc_substitute<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3 || args.len() == 4, ast::Error::Unspecified);
    let mut it = args.into_iter();
    let a = fetcher.get_calc_value(it.next().unwrap());
    assert_text_from_calc_value!(text, a);
    let b = fetcher.get_calc_value(it.next().unwrap());
    assert_text_from_calc_value!(old, b);
    let c = fetcher.get_calc_value(it.next().unwrap());
    assert_text_from_calc_value!(new, c);
    let instance = if let Some(x) = it.next() {
        let v = fetcher.get_calc_value(x);
        assert_f64_from_calc_value!(inst, v);
        assert_or_return!(inst >= 1., ast::Error::Value);
        Some(inst.trunc() as usize)
    } else {
        None
    };

    if old.is_empty() {
        return CalcVertex::from_string(text);
    }
    let result = match instance {
        None => text.replace(&old, &new),
        Some(n) => substitute_nth(&text, &old, &new, n),
    };
    CalcVertex::from_string(result)
}

fn substitute_nth(text: &str, old: &str, new: &str, n: usize) -> String {
    let mut result = String::new();
    let mut rest = text;
    let mut count = 0usize;
    while let Some(pos) = rest.find(old) {
        count += 1;
        if count == n {
            result.push_str(&rest[..pos]);
            result.push_str(new);
            result.push_str(&rest[pos + old.len()..]);
            return result;
        }
        result.push_str(&rest[..pos + old.len()]);
        rest = &rest[pos + old.len()..];
    }
    result.push_str(rest);
    result
}

/// REPLACE(old_text, start_num, num_chars, new_text) — replace `num_chars`
/// characters of `old_text` starting at 1-based `start_num` with `new_text`.
pub fn calc_replace<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 4, ast::Error::Unspecified);
    let mut it = args.into_iter();
    let a = fetcher.get_calc_value(it.next().unwrap());
    assert_text_from_calc_value!(old, a);
    let b = fetcher.get_calc_value(it.next().unwrap());
    assert_f64_from_calc_value!(start, b);
    let c = fetcher.get_calc_value(it.next().unwrap());
    assert_f64_from_calc_value!(count, c);
    let d = fetcher.get_calc_value(it.next().unwrap());
    assert_text_from_calc_value!(new, d);
    assert_or_return!(start >= 1., ast::Error::Value);
    assert_or_return!(count >= 0., ast::Error::Value);

    let chars: Vec<char> = old.chars().collect();
    let s = (start.trunc() as usize - 1).min(chars.len());
    let e = (s + count.trunc() as usize).min(chars.len());
    let mut result: String = chars[..s].iter().collect();
    result.push_str(&new);
    result.extend(chars[e..].iter());
    CalcVertex::from_string(result)
}

/// CONCAT(text1, ...) — join all arguments (including ranges) into one string.
pub fn calc_concat<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let mut out = String::new();
    for arg in args {
        if let Err(e) = push_calc_value(fetcher.get_calc_value(arg), &mut out) {
            return CalcVertex::from_error(e);
        }
    }
    CalcVertex::from_string(out)
}

fn push_calc_value(value: CalcValue, out: &mut String) -> Result<(), ast::Error> {
    match value {
        CalcValue::Scalar(s) => push_value(s, out),
        CalcValue::Range(r) => {
            for v in r.into_iter() {
                push_value(v, out)?;
            }
            Ok(())
        }
        CalcValue::Cube(c) => {
            for v in c.into_iter() {
                push_value(v, out)?;
            }
            Ok(())
        }
        CalcValue::Union(u) => {
            for b in u.into_iter() {
                push_calc_value(*b, out)?;
            }
            Ok(())
        }
    }
}

fn push_value(v: Value, out: &mut String) -> Result<(), ast::Error> {
    match v {
        Value::Blank => Ok(()),
        Value::Number(n) => {
            out.push_str(&n.to_string());
            Ok(())
        }
        Value::Text(t) => {
            out.push_str(&t);
            Ok(())
        }
        Value::Boolean(b) => {
            out.push_str(if b { "TRUE" } else { "FALSE" });
            Ok(())
        }
        Value::Error(e) => Err(e),
    }
}

/// TEXTJOIN(delimiter, ignore_empty, text1, ...) — join all text (including
/// ranges) with `delimiter`; when `ignore_empty` is TRUE, empty values are
/// skipped so no double delimiters appear.
pub fn calc_textjoin<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 3, ast::Error::Unspecified);
    let mut it = args.into_iter();
    let d = fetcher.get_calc_value(it.next().unwrap());
    assert_text_from_calc_value!(delim, d);
    let ig = fetcher.get_calc_value(it.next().unwrap());
    assert_bool_from_calc_value!(ignore_empty, ig);

    let mut cells: Vec<String> = Vec::new();
    for arg in it {
        if let Err(e) = collect_cells(fetcher.get_calc_value(arg), &mut cells) {
            return CalcVertex::from_error(e);
        }
    }
    if ignore_empty {
        cells.retain(|s| !s.is_empty());
    }
    CalcVertex::from_string(cells.join(&delim))
}

fn collect_cells(value: CalcValue, out: &mut Vec<String>) -> Result<(), ast::Error> {
    match value {
        CalcValue::Scalar(s) => {
            out.push(value_to_string(s)?);
            Ok(())
        }
        CalcValue::Range(r) => {
            for v in r.into_iter() {
                out.push(value_to_string(v)?);
            }
            Ok(())
        }
        CalcValue::Cube(c) => {
            for v in c.into_iter() {
                out.push(value_to_string(v)?);
            }
            Ok(())
        }
        CalcValue::Union(u) => {
            for b in u.into_iter() {
                collect_cells(*b, out)?;
            }
            Ok(())
        }
    }
}

fn value_to_string(v: Value) -> Result<String, ast::Error> {
    match v {
        Value::Blank => Ok(String::new()),
        Value::Number(n) => Ok(n.to_string()),
        Value::Text(t) => Ok(t),
        Value::Boolean(b) => Ok(if b {
            "TRUE".to_string()
        } else {
            "FALSE".to_string()
        }),
        Value::Error(e) => Err(e),
    }
}
