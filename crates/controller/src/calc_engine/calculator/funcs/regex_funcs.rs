use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_base::matrix_value::MatrixValue;
use logisheets_parser::ast;
use regex::RegexBuilder;

// REGEXTEST(text, pattern, [case_sensitivity])
// Returns TRUE iff `pattern` matches anywhere in `text`.
//
// case_sensitivity:
//   0 / FALSE / omitted  → match is case-sensitive (default)
//   non-zero / TRUE      → match is case-insensitive
pub fn calc_regextest<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 2 || args.len() > 3 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let text_v = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(text, text_v);
    let pattern_v = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(pattern, pattern_v);
    let case_insensitive = match iter.next() {
        Some(arg) => match parse_case_insensitive(fetcher.get_calc_value(arg)) {
            Ok(v) => v,
            Err(e) => return CalcVertex::from_error(e),
        },
        None => false,
    };
    let re = match RegexBuilder::new(&pattern)
        .case_insensitive(case_insensitive)
        .build()
    {
        Ok(r) => r,
        Err(_) => return CalcVertex::from_error(ast::Error::Value),
    };
    CalcVertex::from_bool(re.is_match(&text))
}

// REGEXEXTRACT(text, pattern, [return_mode], [case_sensitivity])
// return_mode:
//   0 / omitted → first whole match, returned as a single string
//   1           → all matches, returned as a column array (one match per row)
//   2           → capture groups of the first match, returned as a row array
//                 (index 0 is the whole match, index 1+ are the groups; missing
//                 optional groups become blank)
pub fn calc_regexextract<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 2 || args.len() > 4 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let text_v = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(text, text_v);
    let pattern_v = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(pattern, pattern_v);
    let return_mode = match iter.next() {
        Some(arg) => match parse_int_arg(fetcher.get_calc_value(arg)) {
            Ok(v) => v,
            Err(e) => return CalcVertex::from_error(e),
        },
        None => 0,
    };
    let case_insensitive = match iter.next() {
        Some(arg) => match parse_case_insensitive(fetcher.get_calc_value(arg)) {
            Ok(v) => v,
            Err(e) => return CalcVertex::from_error(e),
        },
        None => false,
    };
    let re = match RegexBuilder::new(&pattern)
        .case_insensitive(case_insensitive)
        .build()
    {
        Ok(r) => r,
        Err(_) => return CalcVertex::from_error(ast::Error::Value),
    };
    match return_mode {
        0 => match re.find(&text) {
            Some(m) => CalcVertex::from_string(m.as_str().to_string()),
            None => CalcVertex::from_error(ast::Error::Na),
        },
        1 => {
            let rows: Vec<Vec<Value>> = re
                .find_iter(&text)
                .map(|m| vec![Value::Text(m.as_str().to_string())])
                .collect();
            if rows.is_empty() {
                return CalcVertex::from_error(ast::Error::Na);
            }
            CalcVertex::Value(CalcValue::Range(MatrixValue::from(rows)))
        }
        2 => match re.captures(&text) {
            Some(caps) => {
                let row: Vec<Value> = (0..caps.len())
                    .map(|i| {
                        caps.get(i)
                            .map(|m| Value::Text(m.as_str().to_string()))
                            .unwrap_or(Value::Blank)
                    })
                    .collect();
                CalcVertex::Value(CalcValue::Range(MatrixValue::from(vec![row])))
            }
            None => CalcVertex::from_error(ast::Error::Na),
        },
        _ => CalcVertex::from_error(ast::Error::Value),
    }
}

// REGEXREPLACE(text, pattern, replacement, [occurrence], [case_sensitivity])
// occurrence:
//   0 / omitted → replace every match
//   N (>= 1)    → replace only the Nth match (1-indexed); other matches kept
//   N (<= -1)   → not supported (Excel uses negatives for tail-counted matches;
//                 we return #VALUE! for now)
//
// `replacement` may include capture-group expansions: `$0` for the whole
// match and `$1`, `$2`, ... for individual groups (regex crate convention).
pub fn calc_regexreplace<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() < 3 || args.len() > 5 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut iter = args.into_iter();
    let text_v = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(text, text_v);
    let pattern_v = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(pattern, pattern_v);
    let replacement_v = fetcher.get_calc_value(iter.next().unwrap());
    assert_text_from_calc_value!(replacement, replacement_v);
    let occurrence = match iter.next() {
        Some(arg) => match parse_int_arg(fetcher.get_calc_value(arg)) {
            Ok(v) => v,
            Err(e) => return CalcVertex::from_error(e),
        },
        None => 0,
    };
    let case_insensitive = match iter.next() {
        Some(arg) => match parse_case_insensitive(fetcher.get_calc_value(arg)) {
            Ok(v) => v,
            Err(e) => return CalcVertex::from_error(e),
        },
        None => false,
    };
    let re = match RegexBuilder::new(&pattern)
        .case_insensitive(case_insensitive)
        .build()
    {
        Ok(r) => r,
        Err(_) => return CalcVertex::from_error(ast::Error::Value),
    };
    let result = if occurrence == 0 {
        re.replace_all(&text, replacement.as_str()).into_owned()
    } else if occurrence > 0 {
        let mut hit = 0i64;
        re.replace_all(&text, |caps: &regex::Captures| {
            hit += 1;
            if hit == occurrence {
                let mut buf = String::new();
                caps.expand(replacement.as_str(), &mut buf);
                buf
            } else {
                caps.get(0)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default()
            }
        })
        .into_owned()
    } else {
        return CalcVertex::from_error(ast::Error::Value);
    };
    CalcVertex::from_string(result)
}

// Excel's case_sensitivity flag: 0/FALSE → case-sensitive (default),
// non-zero / TRUE → case-insensitive. Returns whether matching should be
// performed CASE-INSENSITIVELY.
fn parse_case_insensitive(value: CalcValue) -> Result<bool, ast::Error> {
    match value {
        CalcValue::Scalar(Value::Number(n)) => Ok(n != 0.0),
        CalcValue::Scalar(Value::Boolean(b)) => Ok(b),
        CalcValue::Scalar(Value::Blank) => Ok(false),
        CalcValue::Scalar(Value::Error(e)) => Err(e),
        _ => Err(ast::Error::Value),
    }
}

fn parse_int_arg(value: CalcValue) -> Result<i64, ast::Error> {
    match value {
        CalcValue::Scalar(Value::Number(n)) => Ok(n as i64),
        CalcValue::Scalar(Value::Boolean(b)) => Ok(if b { 1 } else { 0 }),
        CalcValue::Scalar(Value::Blank) => Ok(0),
        CalcValue::Scalar(Value::Error(e)) => Err(e),
        _ => Err(ast::Error::Value),
    }
}
