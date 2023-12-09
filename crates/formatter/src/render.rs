#![allow(dead_code)]
use crate::{FmtChar, FormattedString, Segment, Token};

pub fn render_number(mut num: f64, seg: Segment) -> FormattedString {
    let mut result: Vec<FmtChar> = vec![];
    if seg.slash < 0 {
        if seg.tokens.len() as i8 == seg.last_comma && seg.first_dot < 0 {
            let tok = seg.tokens.get(seg.last_comma as usize).unwrap();
            let len = tok.comma_len() as f64;
            num = num / 1000f64.powf(len);
        }
        // Find out how many digits there are after the decimal point
        let dot_idx = if seg.first_dot < 0 {
            seg.tokens.len()
        } else {
            seg.first_dot as usize + 1
        };
        let mut digits = 0;
        for i in dot_idx..seg.tokens.len() {
            let tok = seg.tokens.get(i).unwrap();
            if let Token::NumberPlaceholder(s) = tok {
                digits += s.len();
            }
        }
        // Round it and get integer part and decimal part
        num = num * 10f64.powi(digits as i32).round() / 10f64.powi(digits as i32);
        let integer_part = num.trunc();
        let decimal_part = (num - integer_part) * 10f64.powi(digits as i32);
        let mut integer_part = integer_part as u64;
        let mut decimal_part = decimal_part as u64;
        // render integer
        for j in dot_idx..=0 {
            let tok = seg.tokens.get(j).unwrap();
            let fmt_char = match tok {
                Token::NumberPlaceholder(s) => {
                    let l = s.len();
                    let (first, second) = split_u64(integer_part, l);
                    integer_part = first;
                    render_placeholders_before_dot(second, s, seg.last_comma > 0)
                }
                _ => tok.to_fmt_char(),
            };
            result.insert(0, fmt_char);
        }
        // render decimal part
        for k in dot_idx + 1..seg.tokens.len() {
            let tok = seg.tokens.get(k).unwrap();
            let fmt_char = match tok {
                Token::NumberPlaceholder(s) => {
                    let l = s.len();
                    digits = digits - l;
                    let (first, second) = split_u64(decimal_part, digits);
                    decimal_part = second;
                    render_placeholders_after_dot(first, s)
                }
                _ => tok.to_fmt_char(),
            };
            result.push(fmt_char);
        }

        return FormattedString {
            chars: result,
            color: None,
        };
    }

    let mut integer: Option<usize> = None;
    let mut numerator: Option<usize> = None;
    let mut denominator: Option<usize> = None;
    // Find out the placeholders of `integer`, `numerator`. `denominator`
    for i in 0..seg.tokens.len() {
        let idx = i as i8;
        if idx == seg.slash {
            continue;
        }
        let tok = seg.tokens.get(i).unwrap();
        if let Token::NumberPlaceholder(_) = tok {
            if idx < seg.slash {
                if integer.is_none() {
                    integer = Some(i);
                } else if numerator.is_none() {
                    numerator = Some(i);
                } else {
                    integer = numerator;
                    numerator = Some(i);
                }
            } else {
                if denominator.is_none() {
                    denominator = Some(i);
                    break;
                }
            }
        }
    }

    // If denomintaor is None, regard the slash as a display token and render it again.
    if denominator.is_none() {
        let mut new_seg = seg;
        let mut slash_tok = new_seg.tokens.get_mut(new_seg.slash as usize).unwrap();
        let mut tok = Token::Display("/".to_string());
        std::mem::swap(&mut tok, &mut slash_tok);
        new_seg.slash = -1;
        return render_number(num, new_seg);
    }

    let (n, den, i) = if integer.is_some() {
        let i = num.trunc() as u64;
        let d = num - num.trunc();
        let (n, den) = find_fraction(d);
        (n, den, i)
    } else {
        let (n, den) = find_fraction(num);
        (n, den, 0)
    };
    for j in 0..seg.tokens.len() {
        let tok = seg.tokens.get(j).unwrap();
        let c = if j == integer.unwrap_or(seg.tokens.len()) {
            let ph = tok.downcast_placeholder();
            render_placeholders_before_dot(i, ph, seg.last_comma >= 0)
        } else if j == denominator.unwrap() {
            let ph = tok.downcast_placeholder();
            render_placeholders_before_dot(den, ph, seg.last_comma >= 0)
        } else if j == numerator.unwrap() {
            let ph = tok.downcast_placeholder();
            render_placeholders_before_dot(n, ph, seg.last_comma >= 0)
        } else {
            tok.to_fmt_char()
        };
        result.push(c)
    }
    FormattedString {
        color: None,
        chars: result,
    }
}

pub fn render_placeholders_before_dot(num: u64, placeholder: &str, has_comma: bool) -> FmtChar {
    let mut remaining = num;
    let mut digit_cnt = 0;
    let mut chars = placeholder.chars().into_iter().rev();
    let mut buf: Vec<char> = vec![];
    loop {
        digit_cnt += 1;
        let c = chars.next();
        if remaining == 0 && c.is_none() {
            break;
        }
        if remaining == 0 {
            let c = c.unwrap();
            match c {
                '?' => buf.push(' '),
                '0' => buf.push('0'),
                '#' => {}
                _ => unreachable!(),
            }
            continue;
        }
        if has_comma && digit_cnt % 3 == 1 && digit_cnt > 1 {
            buf.push(',')
        }
        let n = (remaining % 10) as u8 + 48;
        remaining = remaining / 10;
        buf.push(n as char);
    }

    let res = buf.into_iter().rev().collect::<String>();
    FmtChar {
        c: res,
        char_type: crate::CharType::None,
    }
}

pub fn render_placeholders_after_dot(num: u64, placeholder: &str) -> FmtChar {
    let mut remaining = num;
    let mut chars = placeholder.chars().into_iter();
    let mut buf: Vec<char> = vec![];
    loop {
        let c = chars.next();
        if remaining == 0 && c.is_none() {
            break;
        }
        if remaining == 0 {
            let c = c.unwrap();
            match c {
                '?' => buf.push(' '),
                '0' => buf.push('0'),
                '#' => {}
                _ => unreachable!(),
            }
            continue;
        }
        // Magic number here is to convert the 1u8 to '1'
        let n = (remaining % 10) as u8 + 48;
        remaining = remaining / 10;
        buf.push(n as char);
        if remaining == 0 {
            buf.reverse();
        }
    }
    let res = buf.into_iter().collect::<String>();
    FmtChar {
        c: res,
        char_type: crate::CharType::None,
    }
}

fn find_fraction_approximately(decimal: f64, denominator_digits: u8) -> (u64, u64) {
    let (numerator, denominator) = find_fraction(decimal);
    let curr_digits = get_digits(denominator);
    if curr_digits <= denominator_digits {
        return (numerator, denominator);
    }
    // use a nicer solution
    let base = 10_f64.powf(curr_digits as f64);
    let round = (decimal * base).round() / 10_f64.powf(curr_digits as f64);
    return find_fraction(round);
}

fn find_fraction(decimal: f64) -> (u64, u64) {
    const MAX_DIGITS: u64 = 1_000_000;

    let mut numerator: u64 = (decimal * MAX_DIGITS as f64) as u64;
    let mut denominator: u64 = MAX_DIGITS;

    // Find the greatest common divisor
    let gcd = greatest_common_divisor(numerator, denominator);

    // Simplify the fraction
    numerator /= gcd;
    denominator /= gcd;

    (numerator, denominator)
}

fn greatest_common_divisor(mut a: u64, mut b: u64) -> u64 {
    while b != 0 {
        let temp = b;
        b = a % b;
        a = temp;
    }
    a
}

fn split_u64(n: u64, digits: usize) -> (u64, u64) {
    let base = 10u64.pow(digits as u32);
    let first = n / base;
    let second = n % base;
    (first, second)
}

#[inline]
fn get_digits(n: u64) -> u8 {
    let mut curr = n;
    let mut r = 0;
    while curr > 0 {
        r += 1;
        curr /= 10;
    }
    r
}

#[cfg(test)]
mod tests {
    use crate::parser::Parser;

    use super::*;

    #[test]
    fn test_fraction() {
        let n = 1.75;
        let fmt = "# #/#";
        let mut parser = Parser {};
        let seg = parser.parse(fmt).first;
        let fmt_str = render_number(n, seg).to_string();
        assert_eq!(fmt_str, "1 3/4")
    }

    #[test]
    fn find_fraction_test() {
        let n = 0.75;
        let (numerator, denominator) = find_fraction(n);
        assert_eq!(numerator, 3);
        assert_eq!(denominator, 4);
    }

    #[test]
    fn test_render_placeholders_before_dot() {
        let fmt = "##000";
        let num = 1234u64;
        let res = render_placeholders_before_dot(num, fmt, false);
        assert_eq!(res.c, "1234");
        let res = render_placeholders_before_dot(num, fmt, true);
        assert_eq!(res.c, "1,234");

        let fmt = "??000";
        let num = 1234u64;
        let res = render_placeholders_before_dot(num, fmt, false);
        assert_eq!(res.c, " 1234");
    }

    #[test]
    fn test_render_placeholders_after_dot() {
        let fmt = "##0000";
        let num = 1234u64;
        let res = render_placeholders_after_dot(num, fmt);
        assert_eq!(res.c, "123400");
    }
}
