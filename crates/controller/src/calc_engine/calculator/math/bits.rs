use std::ops::{BitAnd, BitOr, BitXor};

/// As Microsoft Excel use 40 bits to present a number, we should make an effort
/// to adapt it.
/// https://support.microsoft.com/en-us/office/dec2hex-function-6344ee8b-b6b5-4c6a-a672-f64666704619
pub fn dec2hex(n: f64, places: Option<usize>) -> Option<String> {
    if n > 549755813887_f64 || n < -549755813888_f64 {
        return None;
    }
    let n = n.floor() as i64;
    let s = format!("{:X}", n);
    let max_len: usize = 10;
    match places {
        Some(p) => {
            if p > max_len {
                None
            } else if n < 0 {
                let res = s.chars().skip(s.len() - max_len).collect::<String>();
                Some(res)
            } else if p < s.len() {
                None
            } else {
                let pad = p - s.len();
                Some(format!("{}{}", "0".repeat(pad), s))
            }
        }
        None => {
            if n < 0 {
                let res = s.chars().skip(s.len() - max_len).collect::<String>();
                Some(res)
            } else {
                Some(s)
            }
        }
    }
}

/// https://support.microsoft.com/en-us/office/dec2oct-function-c9d835ca-20b7-40c4-8a9e-d3be351ce00f
pub fn dec2oct(n: f64, places: Option<usize>) -> Option<String> {
    if n > 536870911_f64 || n < -536870912_f64 {
        return None;
    }

    let n = n.floor() as i64;
    let s = format!("{:o}", n);
    let max_len: usize = 10;
    match places {
        Some(p) => {
            if p > max_len {
                None
            } else if n < 0 {
                let res = s.chars().skip(s.len() - max_len).collect::<String>();
                Some(res)
            } else if p < s.len() {
                None
            } else {
                let pad = p as usize - s.len();
                Some(format!("{}{}", "0".repeat(pad), s))
            }
        }
        None => {
            if n < 0 {
                let res = s.chars().skip(s.len() - max_len).collect::<String>();
                Some(res)
            } else {
                Some(s)
            }
        }
    }
}

/// https://support.microsoft.com/en-us/office/dec2oct-function-c9d835ca-20b7-40c4-8a9e-d3be351ce00f
pub fn dec2bin(n: f64, places: Option<usize>) -> Option<String> {
    if n > 511_f64 || n < -512_f64 {
        return None;
    }

    let n = n.floor() as i64;
    let s = format!("{:o}", n);
    let max_len: usize = 10;
    match places {
        Some(p) => {
            if p > max_len {
                None
            } else if n < 0 {
                let res = s.chars().skip(s.len() - max_len).collect::<String>();
                Some(res)
            } else if p < s.len() {
                None
            } else {
                let pad = p as usize - s.len();
                Some(format!("{}{}", "0".repeat(pad), s))
            }
        }
        None => {
            if n < 0 {
                let res = s.chars().skip(s.len() - max_len).collect::<String>();
                Some(res)
            } else {
                Some(s)
            }
        }
    }
}

/// https://support.microsoft.com/en-us/office/bin2dec-function-63905b57-b3a0-453d-99f4-647bb519cd6c
pub fn bin2dec(bin_num: &str) -> Option<f64> {
    let l = bin_num.len();
    if l > 10 || bin_num.len() == 0 {
        return None;
    }
    let n = i16::from_str_radix(bin_num, 2);
    match n {
        Ok(r) => {
            // negative number
            if r > 511 {
                Some(r as f64 - 1024.)
            } else {
                Some(r as f64)
            }
        }
        Err(_) => None,
    }
}

pub fn oct2dec(oct_num: &str) -> Option<f64> {
    let l = oct_num.len();
    if l > 10 || l == 0 {
        return None;
    }
    let n = i32::from_str_radix(oct_num, 8);
    match n {
        Ok(r) => {
            // negative number
            if r > 536870911 {
                Some(r as f64 - 1073741824.)
            } else {
                Some(r as f64)
            }
        }
        Err(_) => todo!(),
    }
}

pub fn hex2dec(hex_num: &str) -> Option<f64> {
    let l = hex_num.len();
    if l > 10 || l == 0 {
        return None;
    }
    let n = i64::from_str_radix(hex_num, 16);
    match n {
        Ok(r) => {
            // negative number
            if r > (2_i64.pow(39)) {
                Some(r as f64 - (2_i64.pow(40)) as f64)
            } else {
                Some(r as f64)
            }
        }
        Err(_) => todo!(),
    }
}

pub fn bin2hex(bin_num: &str, places: Option<usize>) -> Option<String> {
    let num = bin2dec(bin_num)?;
    dec2hex(num, places)
}

pub fn bin2oct(bin_num: &str, places: Option<usize>) -> Option<String> {
    let num = bin2dec(bin_num)?;
    dec2oct(num, places)
}

pub fn oct2hex(oct_num: &str, places: Option<usize>) -> Option<String> {
    let num = oct2dec(oct_num)?;
    dec2hex(num, places)
}

pub fn oct2bin(oct_num: &str, places: Option<usize>) -> Option<String> {
    let num = oct2dec(oct_num)?;
    dec2bin(num, places)
}

pub fn hex2oct(hex_num: &str, places: Option<usize>) -> Option<String> {
    let num = hex2dec(hex_num)?;
    dec2oct(num, places)
}

pub fn hex2bin(hex_num: &str, places: Option<usize>) -> Option<String> {
    let num = hex2dec(hex_num)?;
    dec2bin(num, places)
}

pub fn bitor(n1: f64, n2: f64) -> Option<f64> {
    if n1 < 0. || n2 < 0. || n1 >= 2_i64.pow(48) as f64 || n2 >= 2_i64.pow(48) as f64 {
        return None;
    }
    let n1 = n1.floor() as u64;
    let n2 = n2.floor() as u64;
    let result = n1.bitor(n2);
    Some(result as f64)
}

pub fn bitand(n1: f64, n2: f64) -> Option<f64> {
    if n1 < 0. || n2 < 0. || n1 >= 2_i64.pow(48) as f64 || n2 >= 2_i64.pow(48) as f64 {
        return None;
    }
    let n1 = n1.floor() as u64;
    let n2 = n2.floor() as u64;
    let result = n1.bitand(n2);
    Some(result as f64)
}

pub fn bitxor(n1: f64, n2: f64) -> Option<f64> {
    if n1 < 0. || n2 < 0. || n1 >= 2_i64.pow(48) as f64 || n2 >= 2_i64.pow(48) as f64 {
        return None;
    }
    let n1 = n1.floor() as u64;
    let n2 = n2.floor() as u64;
    let result = n1.bitxor(n2);
    Some(result as f64)
}

pub fn bitlshift(num: f64, shift_amt: f64) -> Option<f64> {
    if num < 0. || shift_amt < 0. || num > 2_i64.pow(48) as f64 || shift_amt > 53. {
        return None;
    }
    let n1 = num.floor() as u64;
    let n2 = shift_amt.floor() as usize;
    let res = n1 << n2;
    Some(res as f64)
}

pub fn bitrshift(num: f64, shift_amt: f64) -> Option<f64> {
    if num < 0. || shift_amt < 0. || num > 2_i64.pow(48) as f64 || shift_amt > 53. {
        return None;
    }
    let n1 = num.floor() as u64;
    let n2 = shift_amt.floor() as usize;
    let res = n1 >> n2;
    Some(res as f64)
}

#[cfg(test)]
mod tests {

    use super::bin2dec;
    use super::bitlshift;
    use super::bitrshift;
    use super::dec2hex;
    use super::dec2oct;
    use super::hex2dec;
    use super::oct2dec;

    #[test]
    fn dec2hex_places_is_none_test() {
        let n = -19.;
        assert_eq!(dec2hex(n, None).unwrap(), "FFFFFFFFED");
        let n = 19.;
        assert_eq!(dec2hex(n, None).unwrap(), "13");
        let n = -1300.;
        assert_eq!(dec2hex(n, None).unwrap(), "FFFFFFFAEC");
        let n = -93000000000.;
        assert_eq!(dec2hex(n, None).unwrap(), "EA58C49E00");
        let n = -549755813889_f64;
        assert_eq!(dec2hex(n, None), None);
        let n = 190000.;
        assert_eq!(dec2hex(n, None).unwrap(), "2E630");
    }

    #[test]
    fn dec2hex_with_places_test() {
        let n = 190000.;
        assert_eq!(dec2hex(n, Some(6)).unwrap(), "02E630");
        let n = 190000.;
        assert_eq!(dec2hex(n, Some(5)).unwrap(), "2E630");
        let n = 190000.;
        assert_eq!(dec2hex(n, Some(4)), None);
        let n = -190000.;
        assert_eq!(dec2hex(n, Some(10)).unwrap(), "FFFFFD19D0");
        let n = -190000.;
        assert_eq!(dec2hex(n, Some(1)).unwrap(), "FFFFFD19D0");
    }

    #[test]
    fn dec2oct_places_is_none_test() {
        let n = -19.;
        assert_eq!(dec2oct(n, None).unwrap(), "7777777755");
        let n = 19.;
        assert_eq!(dec2oct(n, None).unwrap(), "23");
        let n = -1300.;
        assert_eq!(dec2oct(n, None).unwrap(), "7777775354");
        let n = -93000000000.;
        assert_eq!(dec2oct(n, None), None);
        let n = 190000.;
        assert_eq!(dec2oct(n, None).unwrap(), "563060");
    }

    #[test]
    fn dec2oct_with_places_test() {
        let n = 190000.;
        assert_eq!(dec2oct(n, Some(6)).unwrap(), "563060");
        let n = 190000.;
        assert_eq!(dec2oct(n, Some(7)).unwrap(), "0563060");
    }

    #[test]
    fn bin2dec_test() {
        let n = "1100100";
        let r = bin2dec(n);
        assert!((r.unwrap() - 100.).abs() < 1e-10);
        let n = "1111111111";
        let r = bin2dec(n);
        assert!((r.unwrap() - -1.).abs() < 1e-10);
        let n = "1101101011";
        let r = bin2dec(n);
        assert!((r.unwrap() - -149.).abs() < 1e-10);
        let n = "111111111";
        let r = bin2dec(n);
        assert!((r.unwrap() - 511.).abs() < 1e-10);
    }

    #[test]
    fn oct2dec_test() {
        let n = "7777777777";
        let r = oct2dec(n);
        assert!((r.unwrap() - -1.).abs() < 1e-10);
        let n = "777777777";
        let r = oct2dec(n);
        assert!((r.unwrap() - 134217727.).abs() < 1e-10);
        let n = "4777777776";
        let r = oct2dec(n);
        assert!((r.unwrap() - -402653186.).abs() < 1e-10);
        let n = "77776";
        let r = oct2dec(n);
        assert!((r.unwrap() - 32766.).abs() < 1e-10);
    }

    #[test]
    fn hex2dec_test() {
        let n = "FFFFFFFFFF";
        let r = hex2dec(n);
        assert!((r.unwrap() - -1.).abs() < 1e-10);
        let n = "FFFFFFFFF";
        let r = hex2dec(n);
        assert!((r.unwrap() - 68719476735.).abs() < 1e-10);
        let n = "A";
        let r = hex2dec(n);
        assert!((r.unwrap() - 10.).abs() < 1e-10);
    }

    #[test]
    fn bitlshift_test() {
        let r = bitlshift(2., 4.).unwrap();
        assert_eq!(r, 32.);
    }

    #[test]
    fn bitrshift_test() {
        let r = bitrshift(32., 4.).unwrap();
        assert_eq!(r, 2.);
    }
}
