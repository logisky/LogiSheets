//! `write_num` — render a number against a numeric format run. Ported from
//! `ssf`'s `write_num` IIFE (`write_num_flt`, `write_num_int`, and helpers).

use regex::Regex;
use std::sync::OnceLock;

use crate::helpers::{commaify, fill, hashq, pad0, pad0_i, pad0r, pad_, rpad_, strrev};
use crate::jsnum::{self, Precision};

fn re(cell: &'static OnceLock<Regex>, pat: &str) -> &'static Regex {
    cell.get_or_init(|| Regex::new(pat).unwrap())
}

macro_rules! lazy_re {
    ($name:ident, $pat:literal) => {
        fn $name() -> &'static Regex {
            static C: OnceLock<Regex> = OnceLock::new();
            re(&C, $pat)
        }
    };
}

lazy_re!(re_closeparen, r"\).*[0#]");
lazy_re!(re_lparen_sp, r"\( *");
lazy_re!(re_sp_rparen, r" \)");
lazy_re!(re_00plus, r"^00+$");
lazy_re!(re_hashqonly, r"^[#?]+$");
lazy_re!(re_frac1, r"# (\?+)( ?)/( ?)(\d+)");
lazy_re!(re_hash0, r"^#+0+$");
lazy_re!(re_dec1, r"^#*0*\.([0#]+)");
lazy_re!(re_leadhash, r"^#+([0.])");
lazy_re!(re_0star_dot, r"^(0*)\.(#*)$");
lazy_re!(re_comma0, r"^#{1,3},##0(\.?)$");
lazy_re!(re_comma0dec, r"^#,##0\.([#0]*0)$");
lazy_re!(re_multicomma, r"^#,#*,#0");
lazy_re!(re_multicomma_strip, r"^#,#*,");
lazy_re!(re_dash, r"^([0#]+)(\\?-([0#]+))+$");
lazy_re!(re_dashchars, r"[\\-]");
lazy_re!(re_phone, r"\(###\) ###\\?-####");
lazy_re!(re_frac_gen, r"^([#0?]+)( ?)/( ?)([#0?]+)");
lazy_re!(re_frac_mixed, r"^# ([#0?]+)( ?)/( ?)([#0?]+)");
lazy_re!(re_hashq0, r"^[#0?]+$");
lazy_re!(re_numdotnum_flt, r"^([#0?]+)\.([#0]+)$");
lazy_re!(re_numdotnum_int, r"^([#0]+)\.([#0]+)$");
lazy_re!(re_00000dec, r"^00,000\.([#0]*0)$");
lazy_re!(re_strip_trail, r"\.(\d*[1-9])0*$");
lazy_re!(re_trail_after_nonzero, r"([^0])0+$");
lazy_re!(re_exp_special, r"^#+0.0E\+0$");
lazy_re!(re_eplus00, r"E\+00$");
lazy_re!(re_e_single, r"e[+-]\d$");
lazy_re!(re_eminus, r"E-");
lazy_re!(re_eplus, r"e\+");
lazy_re!(re_d_comma_d3, r"^\d,\d{3}$");
lazy_re!(re_alldigits, r"^\d*$");
lazy_re!(re_lead0dot, r"^0\.");
lazy_re!(re_dot_tail, r"\.[0#?]*$");

fn s(x: f64) -> String {
    jsnum::to_string_js(x)
}

/// chars-based substr(start,len), clamping like JS `String.prototype.substr`.
fn js_substr(src: &str, start: i32, len: i32) -> String {
    let chars: Vec<char> = src.chars().collect();
    let n = chars.len() as i32;
    let st = if start < 0 { (n + start).max(0) } else { start.min(n) };
    let l = if len < 0 { 0 } else { len.min(n - st) };
    chars[st as usize..(st + l) as usize].iter().collect()
}

fn js_substr_from(src: &str, start: i32) -> String {
    let chars: Vec<char> = src.chars().collect();
    let n = chars.len() as i32;
    let st = if start < 0 { (n + start).max(0) } else { start.min(n) };
    chars[st as usize..].iter().collect()
}

fn log10_floor(v: f64) -> i32 {
    (v.abs().ln() * std::f64::consts::LOG10_E).floor() as i32
}

/// `ssf.rnd(val, d)` — the value rounded to `d` decimal places, as a bare
/// number string (no padding; callers widen it to the format's own shape).
///
/// Upstream is `Math.round(val * 10^d) / 10^d`, which is wrong for a
/// spreadsheet twice over. It decides the halfway case on the scaled binary
/// product, so `0.00` rendered 1.005 as "1.00" and 4.935 as "4.93" where Excel
/// shows "1.01" and "4.94" — Excel keeps 15 significant decimal digits, and
/// both of those are ties in that form. And the scaling multiply adds error of
/// its own: `2.1 * 100` is 209.99999999999997, so an exact value could drop a
/// place. Rounding the decimal expansion removes both.
fn rnd(val: f64, d: i32) -> String {
    // Past 1e15 there is no fractional tie to settle, and `to_fixed` would
    // spell out the double's exact integer digits where every other numeric
    // format shows the shortest ones. Keep the original route so they agree.
    if !val.is_finite() || val.abs() >= 1e15 {
        let dd = 10f64.powi(d);
        return s(jsnum::round(val * dd) / dd);
    }
    // Both call sites pass a count of format placeholders, so `d` is never
    // negative; clamp anyway to stay inside `to_fixed`'s domain.
    let fixed = jsnum::to_fixed_with(val, d.clamp(0, 100) as usize, Precision::Excel15);
    strip_trailing_frac_zeros(&fixed)
}

/// Trailing fractional zeros, and a bare trailing point, are not part of a
/// number's string form — `rnd` has to look like `s()` did.
fn strip_trailing_frac_zeros(x: &str) -> String {
    if !x.contains('.') {
        return x.to_string();
    }
    let trimmed = x.trim_end_matches('0').trim_end_matches('.');
    // `-0.00` trims to `-0`, and `0.00` to `0`; upstream produced "0" for both.
    if trimmed.is_empty() || trimmed == "-" {
        return "0".to_string();
    }
    trimmed.to_string()
}

/// The `d` fractional digits of `val` and whether rounding them carried into
/// the integer part, both read off ONE Excel-precision rendering.
///
/// The pair has to agree — `#,##0.00` builds its output from
/// `s(floor + carry)` and `dec` separately, so a carry that only one of them
/// saw would print 9.999 as "10.00" or "9.00" instead of "10.00". Sharing the
/// rendering makes that impossible.
///
/// Returns `(carry, frac_digits)`.
fn rounded_parts(val: f64, d: i32) -> (i64, i64) {
    let places = d.clamp(0, 100) as usize;
    let fixed = jsnum::to_fixed_with(val, places, Precision::Excel15);
    let (int_str, frac_str) = match fixed.split_once('.') {
        Some((i, f)) => (i, f),
        None => (fixed.as_str(), ""),
    };
    // Compared as strings: the integer part can exceed `i64` and `s()` renders
    // it the same way `to_fixed` does below 1e21.
    let carry = i64::from(int_str != s(val.floor()));
    let frac = frac_str.parse::<i64>().unwrap_or(0);
    (carry, frac)
}

/// `ssf.dec(val, d)` — the fractional digits, at Excel's precision.
///
/// Upstream rounds `(val - floor(val)) * 10^d` as a double, which is how
/// `#,##0.00` came to render 2.675 as "2.67" and 1.005 as "1.00" while the
/// plain `0.00` format got them right.
fn dec(val: f64, d: i32) -> i64 {
    if !val.is_finite() || val.abs() >= 1e15 {
        return dec_legacy(val, d);
    }
    rounded_parts(val, d).1
}

/// `ssf.carry(val, d)` — whether rounding the fraction carries into the
/// integer part. Shares [`rounded_parts`] with [`dec`] so the two cannot
/// disagree about it.
fn carry(val: f64, d: i32) -> i64 {
    if !val.is_finite() || val.abs() >= 1e15 {
        return carry_legacy(val, d);
    }
    rounded_parts(val, d).0
}

/// The upstream `dec`, kept for magnitudes where there is no fraction left to
/// round and the decimal path would only change how integer digits print.
fn dec_legacy(val: f64, d: i32) -> i64 {
    let frac = val - val.floor();
    let dd = 10f64.powi(d);
    let rr = jsnum::round(frac * dd);
    if (d as usize) < s(rr).len() {
        0
    } else {
        rr as i64
    }
}

/// The upstream `carry`, paired with [`dec_legacy`].
fn carry_legacy(val: f64, d: i32) -> i64 {
    let dd = 10f64.powi(d);
    let rr = jsnum::round((val - val.floor()) * dd);
    if (d as usize) < s(rr).len() {
        1
    } else {
        0
    }
}

/// `ssf.flr(val)`.
fn flr(val: f64) -> String {
    if val < 2147483647.0 && val > -2147483648.0 {
        if val >= 0.0 {
            s((val as i32) as f64)
        } else {
            s(((val - 1.0) as i32) as f64)
        }
    } else {
        s(val.floor())
    }
}

/// `ssf.frac(x, D, mixed)` -> `(whole, numerator, denominator)`.
fn frac(x: f64, big_d: f64, mixed: bool) -> (f64, f64, f64) {
    let sgn = if x < 0.0 { -1.0 } else { 1.0 };
    let mut b = x * sgn;
    let (mut p_2, mut p_1, mut p) = (0.0f64, 1.0f64, 0.0f64);
    let (mut q_2, mut q_1, mut q) = (1.0f64, 0.0f64, 0.0f64);
    let mut a;
    while q_1 < big_d {
        a = b.floor();
        p = a * p_1 + p_2;
        q = a * q_1 + q_2;
        if (b - a) < 0.00000005 {
            break;
        }
        b = 1.0 / (b - a);
        p_2 = p_1;
        p_1 = p;
        q_2 = q_1;
        q_1 = q;
    }
    if q > big_d {
        if q_1 > big_d {
            q = q_2;
            p = p_2;
        } else {
            q = q_1;
            p = p_1;
        }
    }
    if !mixed {
        return (0.0, sgn * p, q);
    }
    let qq = (sgn * p / q).floor();
    (qq, sgn * p - qq * q, q)
}

fn write_num_pct(t: &str, fmt: &str, val: f64) -> Result<String, String> {
    let sfmt = fmt.replace('%', "");
    let mul = fmt.len() - sfmt.len();
    Ok(format!(
        "{}{}",
        write_num(t, &sfmt, val * 10f64.powi(2 * mul as i32))?,
        fill('%', mul)
    ))
}

fn write_num_cm(t: &str, fmt: &str, val: f64) -> Result<String, String> {
    let b = fmt.as_bytes();
    let mut idx = b.len() - 1;
    while idx >= 1 && b[idx - 1] == b',' {
        idx -= 1;
    }
    let cnt = b.len() - idx;
    write_num(t, &fmt[..idx], val / 10f64.powi(3 * cnt as i32))
}

/// `ssf.write_num_exp` (and `write_num_exp2` when `v2` is true).
fn write_num_exp(fmt: &str, val: f64, v2: bool) -> String {
    let e_pos = fmt.find('E').unwrap() as i32;
    let dot_pos = fmt.find('.').map(|x| x as i32).unwrap_or(-1);
    let idx = e_pos - dot_pos - 1;
    let mut o: String;

    if re_exp_special().is_match(fmt) {
        if val == 0.0 {
            return "0.0E+0".to_string();
        } else if val < 0.0 {
            return format!("-{}", write_num_exp(fmt, -val, v2));
        }
        let period = if dot_pos == -1 { e_pos } else { dot_pos };
        let mut ee = log10_floor(val) % period;
        if ee < 0 {
            ee += period;
        }
        let prec = (idx + 1 + (period + ee) % period).max(0) as usize;
        o = jsnum::to_precision_with(val / 10f64.powi(ee), prec.max(1), Precision::Excel15);

        let no_exp = if v2 {
            !o.contains('e') && !o.contains('E')
        } else {
            !o.contains('e')
        };
        if no_exp {
            let fakee = log10_floor(val);
            if !o.contains('.') {
                o = format!(
                    "{}.{}E+{}",
                    js_substr(&o, 0, 1),
                    js_substr_from(&o, 1),
                    fakee - o.chars().count() as i32 + ee
                );
            } else {
                o = format!("{}E+{}", o, fakee - ee);
            }
            if !v2 {
                while js_substr(&o, 0, 2) == "0." {
                    o = format!(
                        "{}{}.{}",
                        js_substr(&o, 0, 1),
                        js_substr(&o, 2, period),
                        js_substr_from(&o, 2 + period)
                    );
                    // .replace(/^0+([1-9])/,"$1").replace(/^0+\./,"0.")
                    o = strip_leading_zeros(&o);
                }
            }
            o = o.replacen("+-", "-", 1);
        }
        // .replace(/^([+-]?)(\d*)\.(\d*)[Ee]/, cb)
        o = replace_exp_mantissa(&o, period, ee);
    } else {
        o = jsnum::to_exponential_with(val, idx.max(0) as usize, Precision::Excel15);
    }

    if re_eplus00().is_match(fmt) && re_e_single().is_match(&o) {
        let n = o.len();
        o = format!("{}0{}", &o[..n - 1], &o[n - 1..]);
    }
    if re_eminus().is_match(fmt) && re_eplus().is_match(&o) {
        o = re_eplus().replace(&o, "e").to_string();
    }
    o.replacen('e', "E", 1)
}

/// `/^0+([1-9])/,"$1"` then `/^0+\./,"0."`.
fn strip_leading_zeros(o: &str) -> String {
    // strip leading zeros before a [1-9]
    let bytes = o.as_bytes();
    let mut i = 0;
    while i < bytes.len() && bytes[i] == b'0' {
        i += 1;
    }
    if i > 0 && i < bytes.len() && (b'1'..=b'9').contains(&bytes[i]) {
        return o[i..].to_string();
    }
    // else /^0+\./ -> "0."
    if i > 0 && i < bytes.len() && bytes[i] == b'.' {
        return format!("0{}", &o[i..]);
    }
    o.to_string()
}

/// `.replace(/^([+-]?)(\d*)\.(\d*)[Ee]/, function($$,$1,$2,$3){ return $1+$2+$3.substr(0,k)+"."+$3.substr(ee)+"E"; })`
fn replace_exp_mantissa(o: &str, period: i32, ee: i32) -> String {
    static C: OnceLock<Regex> = OnceLock::new();
    let rgx = re(&C, r"^([+-]?)(\d*)\.(\d*)[Ee]");
    if let Some(cap) = rgx.captures(o) {
        let whole = cap.get(0).unwrap();
        let g1 = cap.get(1).map(|m| m.as_str()).unwrap_or("");
        let g2 = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        let g3 = cap.get(3).map(|m| m.as_str()).unwrap_or("");
        let k = (period + ee) % period;
        let replaced = format!(
            "{}{}{}.{}E",
            g1,
            g2,
            js_substr(g3, 0, k),
            js_substr_from(g3, ee)
        );
        format!("{}{}", replaced, &o[whole.end()..])
    } else {
        o.to_string()
    }
}

/// `sign + rnd(val, r1.len())` with the dec1 callback replacements (shared by
/// the flt/int paths via the `base` argument).
fn build_dec(base: String, r1: &str) -> String {
    let hq = hashq(r1);
    let mut o = base;
    if !o.contains('.') {
        o = format!("{}.{}", o, hq);
    } else if o.ends_with('.') {
        o.push_str(&hq);
    }
    if let Some(dot) = o.rfind('.') {
        let frac = o[dot + 1..].to_string();
        if frac.len() < hq.len() {
            let padded = format!("{}{}", frac, "0".repeat(hq.len() - frac.len()));
            o = format!("{}.{}", &o[..dot], padded);
        }
    }
    o
}

/// The `^(0*)\.(#*)$` callback chain, shared by flt/int via `base`.
fn build_0star_dot(base: String, r1_len: usize) -> String {
    let mut o = re_strip_trail().replace(&base, ".$1").to_string();
    if !o.contains('.') {
        o.push('.');
    }
    if o.starts_with("0.") {
        o = if r1_len > 0 {
            o
        } else {
            format!(".{}", &o[2..])
        };
    }
    o
}

fn strip0dot(o: &str) -> String {
    re_lead0dot().replace(o, ".").to_string()
}

fn write_num_f1(r1: &str, r2: &str, r3: &str, r4: &str, aval: f64, sign: &str) -> String {
    let den: i64 = r4.parse().unwrap();
    let rr = jsnum::round(aval * den as f64) as i64;
    let base = (rr as f64 / den as f64).floor() as i64;
    let myn = rr - base * den;
    let myd = den;
    let basestr = if base == 0 { String::new() } else { base.to_string() };
    let fracstr = if myn == 0 {
        fill(' ', r1.len() + 1 + r4.len())
    } else {
        format!(
            "{}{}/{}{}",
            pad_(&myn.to_string(), r1.len()),
            r2,
            r3,
            pad0_i(myd, r4.len())
        )
    };
    format!("{}{} {}", sign, basestr, fracstr)
}

fn write_num_f2(r1: &str, r4: &str, aval: f64, sign: &str) -> String {
    let avalstr = if aval == 0.0 { String::new() } else { s(aval) };
    format!("{}{}{}", sign, avalstr, fill(' ', r1.len() + 2 + r4.len()))
}

/// Shared fraction-with-placeholders branch (`^([#0?]+) / ([#0?]+)`).
fn write_num_frac_gen(fmt: &str, aval: f64, sign: &str) -> Result<String, String> {
    let cap = re_frac_gen().captures(fmt).unwrap();
    let r1 = cap.get(1).unwrap().as_str();
    let r2 = cap.get(2).map(|m| m.as_str()).unwrap_or("");
    let r3 = cap.get(3).map(|m| m.as_str()).unwrap_or("");
    let r4 = cap.get(4).unwrap().as_str();
    let ri = r4.len().min(7);
    let ff = frac(aval, 10f64.powi(ri as i32) - 1.0, false);
    let mut o = sign.to_string();
    let mut oa = write_num("n", r1, ff.1)?;
    if oa.ends_with(' ') {
        oa = format!("{}0", &oa[..oa.len() - 1]);
    }
    o.push_str(&oa);
    o.push_str(r2);
    o.push('/');
    o.push_str(r3);
    let mut oa2 = rpad_(&s(ff.2), ri);
    if oa2.len() < r4.len() {
        oa2 = format!("{}{}", hashq(&js_substr_from(r4, (r4.len() - oa2.len()) as i32)), oa2);
    }
    o.push_str(&oa2);
    Ok(o)
}

fn write_num_frac_mixed(fmt: &str, aval: f64, sign: &str) -> String {
    let cap = re_frac_mixed().captures(fmt).unwrap();
    let r1 = cap.get(1).unwrap().as_str();
    let r2 = cap.get(2).map(|m| m.as_str()).unwrap_or("");
    let r3 = cap.get(3).map(|m| m.as_str()).unwrap_or("");
    let r4 = cap.get(4).unwrap().as_str();
    let ri = (r1.len().max(r4.len())).min(7);
    let ff = frac(aval, 10f64.powi(ri as i32) - 1.0, true);
    let whole = if ff.0 != 0.0 {
        s(ff.0)
    } else if ff.1 != 0.0 {
        String::new()
    } else {
        "0".to_string()
    };
    let fracpart = if ff.1 != 0.0 {
        format!(
            "{}{}/{}{}",
            pad_(&s(ff.1), ri),
            r2,
            r3,
            rpad_(&s(ff.2), ri)
        )
    } else {
        fill(' ', 2 * ri + 1 + r2.len() + r3.len())
    };
    format!("{}{} {}", sign, whole, fracpart)
}

/// `write_num_flt(type, fmt, val)`.
fn write_num_flt(t: &str, fmt: &str, val: f64) -> Result<String, String> {
    if t.starts_with('(') && !re_closeparen().is_match(fmt) {
        let ffmt = re_lparen_sp().replace(fmt, "");
        let ffmt = re_sp_rparen().replace(&ffmt, "");
        let ffmt = ffmt.replacen(')', "", 1);
        if val >= 0.0 {
            return write_num_flt("n", &ffmt, val);
        }
        return Ok(format!("({})", write_num_flt("n", &ffmt, -val)?));
    }
    if fmt.ends_with(',') {
        return write_num_cm(t, fmt, val);
    }
    if fmt.contains('%') {
        return write_num_pct(t, fmt, val);
    }
    if fmt.contains('E') {
        return Ok(write_num_exp(fmt, val, false));
    }
    if fmt.starts_with('$') {
        let skip = if fmt.as_bytes().get(1) == Some(&b' ') { 2 } else { 1 };
        return Ok(format!("${}", write_num_flt(t, &fmt[skip..], val)?));
    }
    let aval = val.abs();
    let sign = if val < 0.0 { "-" } else { "" };

    if re_00plus().is_match(fmt) {
        return Ok(format!("{}{}", sign, pad0r(aval, fmt.len())));
    }
    if re_hashqonly().is_match(fmt) {
        let mut o = pad0r(val, 0);
        if o == "0" {
            o = String::new();
        }
        return Ok(if o.len() > fmt.len() {
            o
        } else {
            format!("{}{}", hashq(&fmt[..fmt.len() - o.len()]), o)
        });
    }
    if let Some(cap) = re_frac1().captures(fmt) {
        return Ok(write_num_f1(
            cap.get(1).unwrap().as_str(),
            cap.get(2).map(|m| m.as_str()).unwrap_or(""),
            cap.get(3).map(|m| m.as_str()).unwrap_or(""),
            cap.get(4).unwrap().as_str(),
            aval,
            sign,
        ));
    }
    if re_hash0().is_match(fmt) {
        let z = fmt.find('0').unwrap();
        return Ok(format!("{}{}", sign, pad0r(aval, fmt.len() - z)));
    }
    if let Some(cap) = re_dec1().captures(fmt) {
        let r1 = cap.get(1).unwrap().as_str();
        let o = build_dec(rnd(val, r1.len() as i32), r1);
        return Ok(if fmt.contains("0.") { o } else { strip0dot(&o) });
    }
    let fmt_owned = re_leadhash().replace(fmt, "$1").to_string();
    let fmt = fmt_owned.as_str();

    if let Some(cap) = re_0star_dot().captures(fmt) {
        let r1len = cap.get(1).unwrap().as_str().len();
        let r2len = cap.get(2).unwrap().as_str().len();
        return Ok(format!("{}{}", sign, build_0star_dot(rnd(aval, r2len as i32), r1len)));
    }
    if re_comma0().is_match(fmt) {
        return Ok(format!("{}{}", sign, commaify(&pad0r(aval, 0))));
    }
    if let Some(cap) = re_comma0dec().captures(fmt) {
        let r1 = cap.get(1).unwrap().as_str();
        if val < 0.0 {
            return Ok(format!("-{}", write_num_flt(t, fmt, -val)?));
        }
        let intpart = s(val.floor() + carry(val, r1.len() as i32) as f64);
        let d = dec(val, r1.len() as i32);
        return Ok(format!("{}.{}", commaify(&intpart), pad0_i(d, r1.len())));
    }
    if re_multicomma().is_match(fmt) {
        let f2 = re_multicomma_strip().replace(fmt, "").to_string();
        return write_num_flt(t, &f2, val);
    }
    if re_dash().is_match(fmt) {
        return write_num_dash(t, fmt, val, false);
    }
    if re_phone().is_match(fmt) {
        let o = write_num_flt(t, "##########", val)?;
        return Ok(format!(
            "({}) {}-{}",
            js_substr(&o, 0, 3),
            js_substr(&o, 3, 3),
            js_substr_from(&o, 6)
        ));
    }
    if re_frac_gen().is_match(fmt) {
        return write_num_frac_gen(fmt, aval, sign);
    }
    if re_frac_mixed().is_match(fmt) {
        return Ok(write_num_frac_mixed(fmt, aval, sign));
    }
    if re_hashq0().is_match(fmt) {
        let o = pad0r(val, 0);
        return Ok(if fmt.len() <= o.len() {
            o
        } else {
            format!("{}{}", hashq(&fmt[..fmt.len() - o.len()]), o)
        });
    }
    if let Some(cap) = re_numdotnum_flt().captures(fmt) {
        let r2 = cap.get(2).unwrap().as_str();
        // Excel's precision, not JavaScript's: a spreadsheet showing `0.00`
        // renders 1.005 as "1.01", because the only thing it keeps of the
        // double is 15 significant digits and that form is a tie. `toFixed`
        // would say "1.00" — right about ECMAScript, wrong about Excel.
        let mut o = jsnum::to_fixed_with(val, r2.len().min(10), Precision::Excel15);
        o = re_trail_after_nonzero().replace(&o, "$1").to_string();
        let ri = o.find('.').map(|x| x as i32).unwrap_or(-1);
        let lres = fmt.find('.').unwrap() as i32 - ri;
        let rres = fmt.len() as i32 - o.len() as i32 - lres;
        let part1 = js_substr(fmt, 0, lres);
        let part3 = js_substr_from(fmt, fmt.len() as i32 - rres);
        return Ok(hashq(&format!("{}{}{}", part1, o, part3)));
    }
    if let Some(cap) = re_00000dec().captures(fmt) {
        let r1 = cap.get(1).unwrap().as_str();
        if val < 0.0 {
            return Ok(format!("-{}", write_num_flt(t, fmt, -val)?));
        }
        let ri = dec(val, r1.len() as i32);
        let mut x = commaify(&flr(val));
        x = re_d_comma_d3().replace(&x, "0$0").to_string();
        if re_alldigits().is_match(&x) {
            let pad = if x.len() < 3 {
                "0".repeat(3 - x.len())
            } else {
                String::new()
            };
            x = format!("00,{}{}", pad, x);
        }
        return Ok(format!("{}.{}", x, pad0_i(ri, r1.len())));
    }
    match fmt {
        "###,##0.00" => write_num_flt(t, "#,##0.00", val),
        "###,###" | "##,###" | "#,###" => {
            let x = commaify(&pad0r(aval, 0));
            Ok(if x != "0" { format!("{}{}", sign, x) } else { String::new() })
        }
        "###,###.00" => Ok(strip0dot(&write_num_flt(t, "###,##0.00", val)?)),
        "#,###.00" => Ok(strip0dot(&write_num_flt(t, "#,##0.00", val)?)),
        _ => Err(format!("unsupported format |{}|", fmt)),
    }
}

/// The `^([0#]+)(\\?-([0#]+))+$` "digits with dashes" branch (SSN/phone-like),
/// shared by flt/int.
fn write_num_dash(t: &str, fmt: &str, val: f64, is_int: bool) -> Result<String, String> {
    let stripped_fmt = re_dashchars().replace_all(fmt, "").to_string();
    let inner = if is_int {
        write_num_int(t, &stripped_fmt, val)?
    } else {
        write_num_flt(t, &stripped_fmt, val)?
    };
    let o: Vec<char> = strrev(&inner).chars().collect();
    let mut ri = 0usize;
    let fmt_noslash = fmt.replace('\\', "");
    let rev = strrev(&fmt_noslash);
    let mut built = String::new();
    for ch in rev.chars() {
        if ch == '0' || ch == '#' {
            if ri < o.len() {
                built.push(o[ri]);
                ri += 1;
            } else if ch == '0' {
                built.push('0');
            }
        } else {
            built.push(ch);
        }
    }
    Ok(strrev(&built))
}

/// `write_num_int(type, fmt, val)`.
fn write_num_int(t: &str, fmt: &str, val: f64) -> Result<String, String> {
    if t.starts_with('(') && !re_closeparen().is_match(fmt) {
        let ffmt = re_lparen_sp().replace(fmt, "");
        let ffmt = re_sp_rparen().replace(&ffmt, "");
        let ffmt = ffmt.replacen(')', "", 1);
        if val >= 0.0 {
            return write_num_int("n", &ffmt, val);
        }
        return Ok(format!("({})", write_num_int("n", &ffmt, -val)?));
    }
    if fmt.ends_with(',') {
        return write_num_cm(t, fmt, val);
    }
    if fmt.contains('%') {
        return write_num_pct(t, fmt, val);
    }
    if fmt.contains('E') {
        return Ok(write_num_exp(fmt, val, true));
    }
    if fmt.starts_with('$') {
        let skip = if fmt.as_bytes().get(1) == Some(&b' ') { 2 } else { 1 };
        return Ok(format!("${}", write_num_int(t, &fmt[skip..], val)?));
    }
    let aval = val.abs();
    let sign = if val < 0.0 { "-" } else { "" };

    if re_00plus().is_match(fmt) {
        return Ok(format!("{}{}", sign, pad0(&s(aval), fmt.len())));
    }
    if re_hashqonly().is_match(fmt) {
        let mut o = s(val);
        if val == 0.0 {
            o = String::new();
        }
        return Ok(if o.len() > fmt.len() {
            o
        } else {
            format!("{}{}", hashq(&fmt[..fmt.len() - o.len()]), o)
        });
    }
    if let Some(cap) = re_frac1().captures(fmt) {
        return Ok(write_num_f2(
            cap.get(1).unwrap().as_str(),
            cap.get(4).unwrap().as_str(),
            aval,
            sign,
        ));
    }
    if re_hash0().is_match(fmt) {
        let z = fmt.find('0').unwrap();
        return Ok(format!("{}{}", sign, pad0(&s(aval), fmt.len() - z)));
    }
    if let Some(cap) = re_dec1().captures(fmt) {
        let r1 = cap.get(1).unwrap().as_str();
        let o = build_dec(s(val), r1);
        return Ok(if fmt.contains("0.") { o } else { strip0dot(&o) });
    }
    let fmt_owned = re_leadhash().replace(fmt, "$1").to_string();
    let fmt = fmt_owned.as_str();

    if let Some(cap) = re_0star_dot().captures(fmt) {
        let r1len = cap.get(1).unwrap().as_str().len();
        return Ok(format!("{}{}", sign, build_0star_dot(s(aval), r1len)));
    }
    if re_comma0().is_match(fmt) {
        return Ok(format!("{}{}", sign, commaify(&s(aval))));
    }
    if let Some(cap) = re_comma0dec().captures(fmt) {
        let r1 = cap.get(1).unwrap().as_str();
        if val < 0.0 {
            return Ok(format!("-{}", write_num_int(t, fmt, -val)?));
        }
        return Ok(format!("{}.{}", commaify(&s(val)), fill('0', r1.len())));
    }
    if re_multicomma().is_match(fmt) {
        let f2 = re_multicomma_strip().replace(fmt, "").to_string();
        return write_num_int(t, &f2, val);
    }
    if re_dash().is_match(fmt) {
        return write_num_dash(t, fmt, val, true);
    }
    if re_phone().is_match(fmt) {
        let o = write_num_int(t, "##########", val)?;
        return Ok(format!(
            "({}) {}-{}",
            js_substr(&o, 0, 3),
            js_substr(&o, 3, 3),
            js_substr_from(&o, 6)
        ));
    }
    if re_frac_gen().is_match(fmt) {
        return write_num_frac_gen(fmt, aval, sign);
    }
    if re_frac_mixed().is_match(fmt) {
        return Ok(write_num_frac_mixed(fmt, aval, sign));
    }
    if re_hashq0().is_match(fmt) {
        let o = s(val);
        return Ok(if fmt.len() <= o.len() {
            o
        } else {
            format!("{}{}", hashq(&fmt[..fmt.len() - o.len()]), o)
        });
    }
    if let Some(cap) = re_numdotnum_int().captures(fmt) {
        let r2 = cap.get(2).unwrap().as_str();
        // Excel's precision, not JavaScript's: a spreadsheet showing `0.00`
        // renders 1.005 as "1.01", because the only thing it keeps of the
        // double is 15 significant digits and that form is a tie. `toFixed`
        // would say "1.00" — right about ECMAScript, wrong about Excel.
        let mut o = jsnum::to_fixed_with(val, r2.len().min(10), Precision::Excel15);
        o = re_trail_after_nonzero().replace(&o, "$1").to_string();
        let ri = o.find('.').map(|x| x as i32).unwrap_or(-1);
        let lres = fmt.find('.').unwrap() as i32 - ri;
        let rres = fmt.len() as i32 - o.len() as i32 - lres;
        let part1 = js_substr(fmt, 0, lres);
        let part3 = js_substr_from(fmt, fmt.len() as i32 - rres);
        return Ok(hashq(&format!("{}{}{}", part1, o, part3)));
    }
    if let Some(cap) = re_00000dec().captures(fmt) {
        let r1 = cap.get(1).unwrap().as_str();
        if val < 0.0 {
            return Ok(format!("-{}", write_num_int(t, fmt, -val)?));
        }
        let mut x = commaify(&s(val));
        x = re_d_comma_d3().replace(&x, "0$0").to_string();
        if re_alldigits().is_match(&x) {
            let pad = if x.len() < 3 {
                "0".repeat(3 - x.len())
            } else {
                String::new()
            };
            x = format!("00,{}{}", pad, x);
        }
        return Ok(format!("{}.{}", x, pad0(&"0".to_string(), r1.len())));
    }
    match fmt {
        "###,###" | "##,###" | "#,###" => {
            let x = commaify(&s(aval));
            Ok(if x != "0" { format!("{}{}", sign, x) } else { String::new() })
        }
        _ => {
            if re_dot_tail().is_match(fmt) {
                let dotpos = fmt.rfind('.').unwrap();
                let head = write_num_int(t, &fmt[..dotpos], val)?;
                return Ok(format!("{}{}", head, hashq(&fmt[dotpos..])));
            }
            Err(format!("unsupported format |{}|", fmt))
        }
    }
}

/// `write_num(type, fmt, val)` — dispatch to the int or float writer.
pub fn write_num(t: &str, fmt: &str, val: f64) -> Result<String, String> {
    let is_int32 = val.fract() == 0.0 && (-2147483648.0..=2147483647.0).contains(&val);
    if is_int32 {
        write_num_int(t, fmt, val)
    } else {
        write_num_flt(t, fmt, val)
    }
}
