use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

fn calc<C, F>(args: Vec<CalcVertex>, fetcher: &mut C, f: &F) -> CalcVertex
where
    C: Connector,
    F: Fn(f64, i32) -> f64,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);

    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(digits, second);

    let r = f(num, digits.trunc() as i32);
    CalcVertex::from_number(r)
}

/// How a decimal digit past the cut is resolved.
#[derive(Clone, Copy)]
enum Mode {
    /// ROUND: half away from zero.
    HalfAway,
    /// ROUNDUP: away from zero whenever anything is dropped.
    Away,
    /// ROUNDDOWN: toward zero always.
    Toward,
}

/// Round `num` at `digits` decimal places, deciding on the number's
/// 15-significant-digit DECIMAL form rather than on the binary double.
///
/// The obvious `(num * 10f64.powi(digits)).round() / …` is wrong twice over,
/// and both ways showed up as real answers:
///
/// - As a double, `4.935` is `4.93499999999999961`, so scaling and rounding
///   gives 4.93. Excel says 4.94 — it never sees those trailing digits,
///   because 15 significant decimal digits is all it keeps.
/// - The scaling itself has error, and its direction depends on how the value
///   was produced. `4.935 * 100` is `493.49999999999994`, while the same
///   number reconstructed from a parsed literal overshoots to
///   `493.50000000000006`. That is why `ROUND(4.935,2)` used to answer 4.94
///   while `ROUND(B1,2)` over a cell holding 4.935 answered 4.93 — the same
///   number, rounded two ways.
///
/// Working on the decimal digits removes both. The kept digits form an integer,
/// the carry is ordinary decimal carrying, and the result is rebuilt as a
/// decimal string so the returned double is the correctly-rounded one rather
/// than the product of another float multiply.
fn round_decimal(num: f64, digits: i32, mode: Mode) -> f64 {
    if !num.is_finite() || num == 0. {
        return num;
    }
    // `{:.14e}` is exactly 15 significant digits, as `d.dddddddddddddde±x`.
    let s = format!("{:.14e}", num.abs());
    let Some((mantissa, exp)) = s.split_once('e') else {
        return num;
    };
    let Ok(exp) = exp.parse::<i32>() else {
        return num;
    };
    let ds: Vec<u8> = mantissa
        .bytes()
        .filter(u8::is_ascii_digit)
        .map(|b| b - b'0')
        .collect();

    // `ds` is the digit string of `0.d1d2… × 10^(exp+1)`, so the last digit
    // kept when rounding at `digits` places sits at index `exp + digits`.
    let keep = exp + digits + 1;
    if keep >= ds.len() as i32 {
        // More places asked for than the decimal form holds: already exact.
        return num;
    }
    let (kept, dropped) = if keep <= 0 {
        (&[][..], &ds[..])
    } else {
        ds.split_at(keep as usize)
    };
    let mut n = kept.iter().fold(0u64, |acc, d| acc * 10 + *d as u64);
    let round_away = match mode {
        // With `keep` negative the cut falls to the left of every significant
        // digit, so the digit deciding the tie is one of the zeros in between
        // — not `dropped[0]`. The value is then under half a unit at this
        // place and stays put, which is why `ROUND(0.0005,2)` is 0 and not
        // 0.01. `ROUNDUP` still moves it: something nonzero was dropped.
        Mode::HalfAway => keep >= 0 && dropped.first().is_some_and(|d| *d >= 5),
        Mode::Away => dropped.iter().any(|d| *d != 0),
        Mode::Toward => false,
    };
    if round_away {
        // Ordinary decimal carry: 999 + 1 = 1000, no special case needed.
        n += 1;
    }
    if n == 0 {
        return 0f64.copysign(num);
    }

    // Rebuilt as a decimal string: `n` is the value in units of 10^-digits.
    let mut text = n.to_string();
    if digits > 0 {
        let point = digits as usize;
        if text.len() <= point {
            text = format!("{}{}", "0".repeat(point - text.len() + 1), text);
        }
        text.insert(text.len() - point, '.');
    } else {
        text.push_str(&"0".repeat((-digits) as usize));
    }
    if num < 0. {
        text.insert(0, '-');
    }
    text.parse().unwrap_or(num)
}

pub fn calc_mround<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);

    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(multiple, second);

    assert_or_return!(multiple * num >= 0., ast::Error::Num);
    if num == 0. {
        return CalcVertex::from_number(0.);
    }
    let n = (num / multiple).round();
    CalcVertex::from_number(n * multiple)
}

pub fn calc_round<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |num: f64, digits: i32| -> f64 { round_decimal(num, digits, Mode::HalfAway) };

    calc(args, fetcher, &f)
}

pub fn calc_rounddown<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |num: f64, digits: i32| -> f64 { round_decimal(num, digits, Mode::Toward) };

    calc(args, fetcher, &f)
}

pub fn calc_roundup<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let f = |num: f64, digits: i32| -> f64 { round_decimal(num, digits, Mode::Away) };

    calc(args, fetcher, &f)
}

/// TRUNC(number, [num_digits]) — drop the fractional part beyond `num_digits`
/// (default 0), truncating toward zero. `num_digits` may be negative.
pub fn calc_trunc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1 || args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let digits = if let Some(arg) = args_iter.next() {
        let v = fetcher.get_calc_value(arg);
        assert_f64_from_calc_value!(d, v);
        d.trunc() as i32
    } else {
        0
    };
    let shift = 10_f64.powi(digits);
    CalcVertex::from_number((num * shift).trunc() / shift)
}

/// CEILING(number, significance) — round `number` UP (away from zero) to the
/// nearest multiple of `significance`. `number` and `significance` must share a
/// sign (else #NUM!); a zero significance yields 0.
pub fn calc_ceiling<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_to_multiple(args, fetcher, true)
}

/// FLOOR(number, significance) — round `number` DOWN (toward zero) to the
/// nearest multiple of `significance`. Same sign / zero rules as CEILING.
pub fn calc_floor<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    calc_to_multiple(args, fetcher, false)
}

fn calc_to_multiple<C>(args: Vec<CalcVertex>, fetcher: &mut C, up: bool) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(num, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(sig, second);
    if sig == 0. || num == 0. {
        return CalcVertex::from_number(0.);
    }
    // number and significance must have the same sign.
    assert_or_return!((num > 0.) == (sig > 0.), ast::Error::Num);
    let q = num / sig;
    let rounded = if up { q.ceil() } else { q.floor() };
    CalcVertex::from_number(rounded * sig)
}

#[cfg(test)]
mod tests {
    use super::{Mode, round_decimal};

    fn round(num: f64, digits: i32) -> f64 {
        round_decimal(num, digits, Mode::HalfAway)
    }

    /// The case that started this: as a double, 4.935 is 4.93499999999999961,
    /// so scaling by 100 and rounding gives 4.93. Excel answers 4.94, because
    /// 15 significant decimal digits is all it keeps and 4.93500000000000 is a
    /// tie, resolved away from zero.
    #[test]
    fn half_way_decimals_round_away_from_zero_like_excel() {
        assert_eq!(round(4.935, 2), 4.94);
        assert_eq!(round(1.005, 2), 1.01);
        assert_eq!(round(2.675, 2), 2.68);
        assert_eq!(round(-4.935, 2), -4.94);
        assert_eq!(round(2.5, 0), 3.0);
        assert_eq!(round(-2.5, 0), -3.0);
    }

    /// The old implementation's answer depended on how the value reached it:
    /// `4.935 * 100` is 493.49999999999994, while the same number rebuilt from
    /// a parsed literal overshoots to 493.50000000000006. So `ROUND(4.935,2)`
    /// gave 4.94 and `ROUND(B1,2)` over a cell holding 4.935 gave 4.93.
    #[test]
    fn the_same_number_rounds_the_same_way_however_it_arrived() {
        let computed = 9.87 / 2.0;
        assert_eq!(computed, 4.935, "the double is the same either way");
        assert_eq!(round(computed, 2), round(4.935, 2));
        assert_eq!(round(computed, 2), 4.94);
    }

    #[test]
    fn negative_digits_round_to_tens_and_hundreds() {
        assert_eq!(round(1250.0, -2), 1300.0);
        assert_eq!(round(1234.5, -2), 1200.0);
        assert_eq!(round(-1250.0, -2), -1300.0);
        // Every digit falls past the cut, so there is nothing left to keep.
        assert_eq!(round(4.935, -3), 0.0);
    }

    /// A cut left of every significant digit is decided by the zeros in
    /// between, not by the first digit it finds: 0.0005 at two places is under
    /// half a unit, so it stays at 0 — but rounding *up* still moves it.
    #[test]
    fn a_value_under_half_a_unit_stays_put() {
        assert_eq!(round(0.0005, 2), 0.0);
        assert_eq!(round_decimal(0.0005, 2, Mode::Away), 0.01);
        assert_eq!(round_decimal(0.0005, 2, Mode::Toward), 0.0);
        // One place further in it is exactly the tie, and goes away from zero.
        assert_eq!(round(0.005, 2), 0.01);
        assert_eq!(round(0.05, 1), 0.1);
        assert_eq!(round(0.04, 1), 0.0);
    }

    /// Scaling by a power of ten used to leave `ROUNDDOWN(2.1,2)` at 2.09,
    /// because `2.1 * 100` is 209.99999999999997.
    #[test]
    fn rounding_toward_and_away_do_not_lose_an_exact_value() {
        assert_eq!(round_decimal(2.1, 2, Mode::Toward), 2.1);
        assert_eq!(round_decimal(2.1, 2, Mode::Away), 2.1);
        assert_eq!(round_decimal(3.14159, 3, Mode::Away), 3.142);
        // Toward zero, so a negative goes up rather than down.
        assert_eq!(round_decimal(-3.14159, 3, Mode::Toward), -3.141);
        assert_eq!(round_decimal(-3.14159, 3, Mode::Away), -3.142);
    }

    #[test]
    fn asking_for_more_places_than_the_number_has_changes_nothing() {
        assert_eq!(round(4.935, 10), 4.935);
        assert_eq!(round(0.0, 2), 0.0);
        assert_eq!(round(1.0e20, 2), 1.0e20);
        assert!(round(f64::NAN, 2).is_nan());
        assert_eq!(round(f64::INFINITY, 2), f64::INFINITY);
    }
}
