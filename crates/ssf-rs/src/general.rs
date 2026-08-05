//! The "General" number format, ported from `ssf`'s `general_fmt_num` /
//! `general_fmt`.

use crate::jsnum;

/// `ssf.strip_decimal`: strip trailing zeros of a decimal fraction at the end of
/// the string (and the '.' if the whole fraction is stripped). Only acts when
/// the tail after the last '.' is all digits, so exponent strings are untouched.
fn strip_decimal(o: &str) -> String {
    if let Some(dot) = o.rfind('.') {
        let tail = &o[dot + 1..];
        if !tail.is_empty() && tail.bytes().all(|b| b.is_ascii_digit()) {
            let stripped = o.trim_end_matches('0');
            let stripped = stripped.strip_suffix('.').unwrap_or(stripped);
            return stripped.to_string();
        }
        if tail.is_empty() {
            // "12." -> "12"
            return o.strip_suffix('.').unwrap_or(o).to_string();
        }
    }
    o.to_string()
}

/// `ssf.normalize_exp`: trim mantissa trailing zeros before `E` and pad a
/// single-digit exponent to two digits.
fn normalize_exp(o: &str) -> String {
    if !o.contains('E') {
        return o.to_string();
    }
    let (mant, exp) = o.split_once('E').unwrap();
    let mant2 = strip_decimal(mant);
    // exp like "+5" / "-5" / "+05" / "+177"
    let exp2 = if exp.len() == 2 && (exp.starts_with('+') || exp.starts_with('-')) {
        format!("{}0{}", &exp[..1], &exp[1..])
    } else {
        exp.to_string()
    };
    format!("{mant2}E{exp2}")
}

fn small_exp(v: f64) -> String {
    let w = if v < 0.0 { 12 } else { 11 };
    let o = strip_decimal(&jsnum::to_fixed(v, 12));
    if o.len() <= w {
        return o;
    }
    let o = jsnum::to_precision(v, 10);
    if o.len() <= w {
        return o;
    }
    jsnum::to_exponential(v, 5)
}

fn large_exp(v: f64) -> String {
    let o = strip_decimal(&jsnum::to_fixed(v, 11));
    if o.len() > (if v < 0.0 { 12 } else { 11 }) || o == "0" || o == "-0" {
        jsnum::to_precision(v, 6)
    } else {
        o
    }
}

/// `ssf.general_fmt_num`: the General format for a non-integer number.
pub fn general_fmt_num(v: f64) -> String {
    // V = floor(log10(|v|)), computed as JS does (ln * LOG10E).
    let vv = (v.abs().ln() * std::f64::consts::LOG10_E).floor() as i32;
    let o = if vv >= -4 && vv <= -1 {
        jsnum::to_precision(v, (10 + vv) as usize)
    } else if vv.abs() <= 9 {
        small_exp(v)
    } else if vv == 10 {
        let s = jsnum::to_fixed(v, 10);
        // .substr(0, 12)
        s.chars().take(12).collect()
    } else {
        large_exp(v)
    };
    strip_decimal(&normalize_exp(&o.to_uppercase()))
}

/// `ssf.general_fmt` for a numeric value (the only case `TEXT`/`format` reach
/// with a General code and a number). Integers in the int32 range render via
/// `toString`, everything else via [`general_fmt_num`].
pub fn general_fmt_num_value(v: f64) -> String {
    let is_int32 = v.fract() == 0.0 && (-2147483648.0..=2147483647.0).contains(&v);
    if is_int32 {
        jsnum::to_string_js(v)
    } else {
        general_fmt_num(v)
    }
}
