//! Faithful reimplementations of the JavaScript `Number` formatting primitives
//! that `ssf` relies on: `Math.round`, `Number.prototype.toFixed`,
//! `Number.prototype.toExponential`, and `Number.prototype.toPrecision`.
//!
//! These are ported to match ECMAScript / V8 semantics exactly, because `ssf`'s
//! output depends on their precise rounding behavior (ties round toward +∞, and
//! rounding is based on the *exact* binary value of the `f64`, e.g. `1.005`
//! formatted to 2 places is `"1.00"` because `1.005` is actually
//! `1.00499999999999989...`).
//!
//! The implementation works from the *exact* decimal expansion of the `f64`
//! (every finite `f64` is a dyadic rational with a finite, ≤1074-digit decimal
//! expansion), which makes correct rounding and tie detection unambiguous.

/// The exact decimal expansion of a non-negative finite `f64`, split into its
/// integer-part digits and fractional-part digits. Both are exact (no rounding).
struct Exact {
    int: String,
    frac: String,
}

/// Return the exact decimal expansion of `x.abs()` for a finite `x`.
///
/// 1074 fractional digits is the maximum any `f64` can have (the smallest
/// subnormal, `2^-1074`), so `{:.1074}` performs no rounding and yields the
/// exact value.
fn exact_nonneg(x: f64) -> Exact {
    debug_assert!(x.is_finite());
    let s = format!("{:.1074}", x.abs());
    match s.split_once('.') {
        Some((i, f)) => Exact {
            int: i.to_string(),
            frac: f.trim_end_matches('0').to_string(),
        },
        None => Exact {
            int: s,
            frac: String::new(),
        },
    }
}

/// Which decimal a formatter should treat a double as being.
///
/// JavaScript's `Number` methods round the *exact* binary value, so `1.005`
/// (really `1.00499999999999989…`) renders as `"1.00"`. Excel keeps only 15
/// significant decimal digits and rounds that, so it renders `"1.01"`. Both are
/// correct about their own spec, and this crate needs both: [`Exact`] to stay a
/// faithful port that can be diffed against Node, [`Excel15`] for what a
/// spreadsheet is supposed to show.
///
/// [`Exact`]: Precision::Exact
/// [`Excel15`]: Precision::Excel15
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum Precision {
    /// The exact binary value — JavaScript's rule.
    #[default]
    Exact,
    /// Rounded to 15 significant decimal digits first — Excel's rule.
    Excel15,
}

/// How many significant decimal digits Excel keeps.
const EXCEL_SIG_DIGITS: usize = 15;

/// The expansion a formatter should work from, under `precision`.
///
/// Collapsing to 15 significant digits is what turns a value sitting a hair
/// below a tie into the tie itself, which is the whole difference between the
/// two rules: `4.935` is exactly `4.93499999999999960920…`, and its 15-digit
/// form is `4.93500000000000` — so rounding to 2 places goes up, not down.
fn expansion(x: f64, precision: Precision) -> Exact {
    let e = exact_nonneg(x);
    match precision {
        Precision::Exact => e,
        // At 1e15 and above the 15-digit window closes before the decimal
        // point, so collapsing would rewrite the INTEGER digits rather than
        // settle a fractional tie. Excel does shorten those too, but it does
        // so on every numeric format at once; doing it here would only shift
        // the formats that happen to route through this function and leave
        // them disagreeing with the rest. Left alone, deliberately.
        Precision::Excel15 if x.abs() < 1e15 => {
            let (digits, exp) = round_sig(&e, EXCEL_SIG_DIGITS);
            from_sig_digits(&digits, exp)
        }
        Precision::Excel15 => e,
    }
}

/// Rebuild an [`Exact`] from a significant-digit string and the exponent of its
/// leading digit — the inverse of what [`round_sig`] takes apart.
fn from_sig_digits(digits: &str, exp: i32) -> Exact {
    if exp >= 0 {
        let intlen = (exp + 1) as usize;
        if digits.len() <= intlen {
            // More integer places than digits: pad with the zeros they stand for.
            Exact {
                int: format!("{}{}", digits, "0".repeat(intlen - digits.len())),
                frac: String::new(),
            }
        } else {
            Exact {
                int: digits[..intlen].to_string(),
                frac: digits[intlen..].trim_end_matches('0').to_string(),
            }
        }
    } else {
        // Value below 1: the leading digit sits `-exp - 1` zeros in.
        let zeros = (-exp - 1) as usize;
        Exact {
            int: "0".to_string(),
            frac: format!("{}{}", "0".repeat(zeros), digits)
                .trim_end_matches('0')
                .to_string(),
        }
    }
}

/// Increment a non-negative decimal digit string by 1 (e.g. `"199"` -> `"200"`,
/// `"999"` -> `"1000"`). Input/output have no decimal point.
fn inc_digits(s: &str) -> String {
    let mut bytes: Vec<u8> = s.bytes().collect();
    let mut i = bytes.len();
    loop {
        if i == 0 {
            let mut out = vec![b'1'];
            out.extend_from_slice(&bytes);
            return String::from_utf8(out).unwrap();
        }
        i -= 1;
        if bytes[i] == b'9' {
            bytes[i] = b'0';
        } else {
            bytes[i] += 1;
            return String::from_utf8(bytes).unwrap();
        }
    }
}

/// `true` if, when keeping `keep` leading characters of `digits`, the remainder
/// means we must round up under round-half-toward-+∞ (ties up). Because ties
/// round up, this is simply "the first dropped digit is >= 5".
fn round_up_at(digits: &[u8], keep: usize) -> bool {
    digits.get(keep).map(|&d| d >= b'5').unwrap_or(false)
}

/// JavaScript `Math.round`: round to nearest integer, ties toward +∞, based on
/// the exact value (so `Math.round(0.49999999999999994) === 0`).
pub fn round(x: f64) -> f64 {
    if !x.is_finite() {
        return x;
    }
    let f = x.floor();
    let diff = x - f;
    if diff < 0.5 {
        f
    } else if diff > 0.5 {
        f + 1.0
    } else {
        // exact half -> toward +∞
        f + 1.0
    }
}

/// JavaScript `Number.prototype.toFixed(frac)`.
///
/// `frac` in `0..=100`. Returns the value with exactly `frac` digits after the
/// decimal point, correctly rounded (ties up) from the exact binary value.
pub fn to_fixed(x: f64, frac: usize) -> String {
    to_fixed_with(x, frac, Precision::Exact)
}

/// [`to_fixed`], reading the value at `precision`. `Precision::Excel15` is what
/// a spreadsheet's fixed-decimal formats (`0.00`) want.
pub fn to_fixed_with(x: f64, frac: usize, precision: Precision) -> String {
    if x.is_nan() {
        return "NaN".to_string();
    }
    if x.is_infinite() {
        return if x < 0.0 { "-Infinity" } else { "Infinity" }.to_string();
    }
    // For magnitudes >= 1e21, JS `toFixed` defers to `ToString`.
    if x.abs() >= 1e21 {
        return to_string_js(x);
    }
    let sign = if x < 0.0 { "-" } else { "" };
    let e = expansion(x, precision);

    // Build the integer formed by (int . first `frac` frac-digits), rounding.
    let fbytes = e.frac.as_bytes();
    let mut kept_frac: Vec<u8> = Vec::with_capacity(frac);
    for i in 0..frac {
        kept_frac.push(*fbytes.get(i).unwrap_or(&b'0'));
    }
    // Combined integer digit string (no point) for carry handling.
    let mut combined = e.int.clone();
    combined.push_str(std::str::from_utf8(&kept_frac).unwrap());
    if round_up_at(fbytes, frac) {
        combined = inc_digits(&combined);
    }
    // Split back into int / frac. The frac part is always the last `frac` chars.
    let (int_out, frac_out) = if frac == 0 {
        (combined.as_str(), "")
    } else {
        let split = combined.len() - frac;
        (&combined[..split], &combined[split..])
    };
    let int_out = if int_out.is_empty() { "0" } else { int_out };

    // Note: JS `toFixed` keeps the "-" sign even when the value rounds to zero
    // (e.g. `(-1e-104).toFixed(2) === "-0.00"`), so we do NOT strip it here.
    if frac == 0 {
        format!("{sign}{int_out}")
    } else {
        format!("{sign}{int_out}.{frac_out}")
    }
}

/// Round the exact expansion to `sig` significant digits (ties up).
///
/// Returns `(digits, exp)` where `digits` is a string of exactly `sig` digits
/// (leading digit nonzero unless the value is zero) and `exp` is the power of
/// ten of the leading digit, i.e. the value ≈ `d.ddd… × 10^exp`.
fn round_sig(e: &Exact, sig: usize) -> (String, i32) {
    let sig = sig.max(1);
    // Assemble the significant-digit stream and the exponent of its leading digit.
    let int_nonzero = e.int.bytes().any(|b| b != b'0');
    let (stream, mut exp): (Vec<u8>, i32) = if int_nonzero {
        // leading digit is first digit of int; strip leading zeros (there are
        // none for a canonical int part except the single "0" case handled above).
        let s: Vec<u8> = e.int.bytes().chain(e.frac.bytes()).collect();
        (s.clone(), e.int.len() as i32 - 1)
    } else {
        // value < 1: find first nonzero frac digit
        match e.frac.bytes().position(|b| b != b'0') {
            Some(k) => {
                let s: Vec<u8> = e.frac.bytes().skip(k).collect();
                (s, -(k as i32) - 1)
            }
            None => {
                // exact zero
                return ("0".repeat(sig), 0);
            }
        }
    };

    if stream.len() <= sig {
        let mut digits = String::from_utf8(stream).unwrap();
        while digits.len() < sig {
            digits.push('0');
        }
        return (digits, exp);
    }

    let mut kept: String = String::from_utf8(stream[..sig].to_vec()).unwrap();
    if round_up_at(&stream, sig) {
        kept = inc_digits(&kept);
        if kept.len() > sig {
            // overflow e.g. 999 -> 1000; keep leading `sig` digits, bump exp
            kept.truncate(sig);
            exp += 1;
        }
    }
    (kept, exp)
}

/// Like [`round_sig`] but with ties-to-even, as ECMAScript `Number::toString`
/// requires (the shortest-representation algorithm resolves an exact half to the
/// even last digit). Used only by [`to_string_js`].
fn round_sig_even(e: &Exact, sig: usize) -> (String, i32) {
    let sig = sig.max(1);
    let int_nonzero = e.int.bytes().any(|b| b != b'0');
    let (stream, mut exp): (Vec<u8>, i32) = if int_nonzero {
        (
            e.int.bytes().chain(e.frac.bytes()).collect(),
            e.int.len() as i32 - 1,
        )
    } else {
        match e.frac.bytes().position(|b| b != b'0') {
            Some(k) => (e.frac.bytes().skip(k).collect(), -(k as i32) - 1),
            None => return ("0".repeat(sig), 0),
        }
    };

    if stream.len() <= sig {
        let mut digits = String::from_utf8(stream).unwrap();
        while digits.len() < sig {
            digits.push('0');
        }
        return (digits, exp);
    }

    let mut kept = String::from_utf8(stream[..sig].to_vec()).unwrap();
    let rd = stream[sig];
    let up = if rd > b'5' {
        true
    } else if rd < b'5' {
        false
    } else {
        let has_tail = stream[sig + 1..].iter().any(|&b| b != b'0');
        // exact half -> round to even (up iff the kept last digit is odd)
        has_tail || (kept.as_bytes()[sig - 1] - b'0') % 2 == 1
    };
    if up {
        kept = inc_digits(&kept);
        if kept.len() > sig {
            kept.truncate(sig);
            exp += 1;
        }
    }
    (kept, exp)
}

/// JavaScript `Number.prototype.toExponential(frac)`.
pub fn to_exponential(x: f64, frac: usize) -> String {
    to_exponential_with(x, frac, Precision::Exact)
}

/// [`to_exponential`], reading the value at `precision`.
pub fn to_exponential_with(x: f64, frac: usize, precision: Precision) -> String {
    if x.is_nan() {
        return "NaN".to_string();
    }
    if x.is_infinite() {
        return if x < 0.0 { "-Infinity" } else { "Infinity" }.to_string();
    }
    let sign = if x < 0.0 && x != 0.0 { "-" } else { "" };
    let e = expansion(x, precision);
    let (digits, exp) = round_sig(&e, frac + 1);
    let mantissa = if frac == 0 {
        digits[..1].to_string()
    } else {
        format!("{}.{}", &digits[..1], &digits[1..])
    };
    let (esign, eabs) = if exp < 0 { ("-", -exp) } else { ("+", exp) };
    format!("{sign}{mantissa}e{esign}{eabs}")
}

/// JavaScript `Number.prototype.toPrecision(prec)`.
pub fn to_precision(x: f64, prec: usize) -> String {
    to_precision_with(x, prec, Precision::Exact)
}

/// [`to_precision`], reading the value at `precision`.
pub fn to_precision_with(x: f64, prec: usize, precision: Precision) -> String {
    if x.is_nan() {
        return "NaN".to_string();
    }
    if x.is_infinite() {
        return if x < 0.0 { "-Infinity" } else { "Infinity" }.to_string();
    }
    let prec = prec.max(1);
    let sign = if x < 0.0 && x != 0.0 { "-" } else { "" };
    let e = expansion(x, precision);
    let (digits, exp) = round_sig(&e, prec);

    if exp < -6 || exp >= prec as i32 {
        // exponential form with `prec` significant digits
        let mantissa = if prec == 1 {
            digits[..1].to_string()
        } else {
            format!("{}.{}", &digits[..1], &digits[1..])
        };
        let (esign, eabs) = if exp < 0 { ("-", -exp) } else { ("+", exp) };
        return format!("{sign}{mantissa}e{esign}{eabs}");
    }

    // fixed form
    let db = digits.as_bytes();
    if exp >= 0 {
        let intlen = (exp + 1) as usize;
        let int_part = &digits[..intlen];
        let frac_part = &digits[intlen..];
        if frac_part.is_empty() {
            format!("{sign}{int_part}")
        } else {
            format!("{sign}{int_part}.{frac_part}")
        }
    } else {
        // exp in -6..=-1: "0." + zeros + digits
        let zeros = (-exp - 1) as usize;
        let mut frac = String::new();
        for _ in 0..zeros {
            frac.push('0');
        }
        frac.push_str(std::str::from_utf8(db).unwrap());
        format!("{sign}0.{frac}")
    }
}

/// JavaScript `String(n)` / `n.toString(10)` for a finite `f64`, following the
/// ECMAScript `Number::toString` algorithm (shortest round-tripping digits, with
/// the exponential-vs-fixed cutoffs at `n > 21` and `n <= -6`).
pub fn to_string_js(x: f64) -> String {
    if x.is_nan() {
        return "NaN".to_string();
    }
    if x.is_infinite() {
        return if x < 0.0 { "-Infinity" } else { "Infinity" }.to_string();
    }
    if x == 0.0 {
        return "0".to_string();
    }
    let sign = if x < 0.0 { "-" } else { "" };

    // Rust's `{:e}` gives the shortest round-tripping representation, so its
    // digit count `k` is the correct ECMAScript shortest length. Rust and V8 can
    // disagree on the *last digit* when the shortest rep is an exact tie, so we
    // re-round the exact value to `k` digits with ties-to-even (V8's rule).
    let sci = format!("{:e}", x.abs()); // e.g. "6.100029174392375e177", "1e21"
    let (mant, _) = sci.split_once('e').unwrap();
    let k = mant.chars().filter(|&c| c != '.').count();
    let (digits, e) = round_sig_even(&exact_nonneg(x), k);
    let digits = digits;
    let k = digits.len() as i32; // number of significant digits
    let n = e + 1; // position of the decimal point relative to the digit string

    let body = if k <= n && n <= 21 {
        // integer, pad with (n-k) zeros
        let mut s = digits;
        for _ in 0..(n - k) {
            s.push('0');
        }
        s
    } else if 0 < n && n <= 21 {
        format!("{}.{}", &digits[..n as usize], &digits[n as usize..])
    } else if -6 < n && n <= 0 {
        let mut s = String::from("0.");
        for _ in 0..(-n) {
            s.push('0');
        }
        s.push_str(&digits);
        s
    } else {
        // exponential form
        let ee = n - 1;
        let (esign, eabs) = if ee < 0 { ("-", -ee) } else { ("+", ee) };
        if k == 1 {
            format!("{digits}e{esign}{eabs}")
        } else {
            format!("{}.{}e{esign}{eabs}", &digits[..1], &digits[1..])
        }
    };
    format!("{sign}{body}")
}

/// Alias retained for the sites in `ssf` that call `Number.toString(10)` on
/// integer-valued numbers.
pub fn to_string10(x: f64) -> String {
    to_string_js(x)
}
