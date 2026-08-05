//! Date-serial parsing and date/time field rendering, ported from `ssf`'s
//! `parse_date_code` and `write_date`.
//!
//! Divergence from upstream: the calendar date is derived from the serial via
//! pure civil-date arithmetic (Howard Hinnant's algorithm) instead of the host
//! `Date` object. This is deterministic and timezone-independent and matches
//! Excel for the serial -> calendar direction.

use crate::helpers::{pad0, pad0_i};
use crate::jsnum;

pub const DAYS: [[&str; 2]; 7] = [
    ["Sun", "Sunday"],
    ["Mon", "Monday"],
    ["Tue", "Tuesday"],
    ["Wed", "Wednesday"],
    ["Thu", "Thursday"],
    ["Fri", "Friday"],
    ["Sat", "Saturday"],
];

pub const MONTHS: [[&str; 3]; 12] = [
    ["J", "Jan", "January"],
    ["F", "Feb", "February"],
    ["M", "Mar", "March"],
    ["A", "Apr", "April"],
    ["M", "May", "May"],
    ["J", "Jun", "June"],
    ["J", "Jul", "July"],
    ["A", "Aug", "August"],
    ["S", "Sep", "September"],
    ["O", "Oct", "October"],
    ["N", "Nov", "November"],
    ["D", "Dec", "December"],
];

/// The parsed components of a date serial (mirrors `ssf`'s date object).
#[derive(Debug, Clone, Copy)]
pub struct DateCode {
    /// `D`: the integer day serial (used by `[h]`/`[m]`/`[s]` elapsed time).
    pub serial_d: i64,
    /// `T`: the integer time-of-day in seconds.
    pub serial_t: i64,
    /// `u`: sub-second fraction.
    pub u: f64,
    pub y: i64,
    pub m: i64,
    pub d: i64,
    pub h: i64,
    pub min: i64,
    pub sec: i64,
    /// `q`: day of week, 0=Sunday .. 6=Saturday.
    pub q: i64,
}

/// Days from 1900-01-01 to 1970-01-01 (real Gregorian, no leap bug).
const DAYS_1900_TO_1970: i64 = 25567;

/// Howard Hinnant's `civil_from_days`: `z` = days since 1970-01-01.
fn civil_from_days(z: i64) -> (i64, i64, i64) {
    let z = z + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = z - era * 146097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365; // [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Day of week for `z` days since 1970-01-01, 0=Sunday.
fn weekday(z: i64) -> i64 {
    (z.rem_euclid(7) + 4) % 7
}

/// `ssf.parse_date_code(v, opts, b2)`.
pub fn parse_date_code(v: f64, date1904: bool, b2: bool) -> Option<DateCode> {
    if v > 2958465.0 || v < 0.0 {
        return None;
    }
    let mut date: i64 = v as i64; // v|0 (v >= 0)
    let mut time: i64 = (86400.0 * (v - date as f64)).floor() as i64;
    let mut serial_d = date;
    let mut serial_t = time;
    let mut u = 86400.0 * (v - date as f64) - time as f64;
    if u.abs() < 1e-6 {
        u = 0.0;
    }
    if date1904 {
        date += 1462;
    }
    if u > 0.9999 {
        u = 0.0;
        time += 1;
        if time == 86400 {
            serial_t = 0;
            time = 0;
            date += 1;
            serial_d += 1;
        }
    }

    let (y, m, d, dow): (i64, i64, i64, i64);
    if date == 60 {
        if b2 {
            (y, m, d) = (1317, 10, 29);
        } else {
            (y, m, d) = (1900, 2, 29);
        }
        dow = 3;
    } else if date == 0 {
        if b2 {
            (y, m, d) = (1317, 8, 29);
        } else {
            (y, m, d) = (1900, 1, 0);
        }
        dow = 6;
    } else {
        let mut dd = date;
        if dd > 60 {
            dd -= 1;
        }
        let z = (dd - 1) - DAYS_1900_TO_1970;
        let (yy, mm, ddd) = civil_from_days(z);
        let mut w = weekday(z);
        if dd < 60 {
            w = (w + 6) % 7;
        }
        if b2 {
            // fix_hijri: rough Gregorian->Hijri by subtracting 581 years.
            (y, m, d) = (yy - 581, mm, ddd);
        } else {
            (y, m, d) = (yy, mm, ddd);
        }
        dow = w;
    }

    let sec = time % 60;
    time /= 60;
    let min = time % 60;
    time /= 60;
    let h = time;

    Some(DateCode {
        serial_d,
        serial_t,
        u,
        y,
        m,
        d,
        h,
        min,
        sec,
        q: dow,
    })
}

fn substr(s: &str, start: usize, len: usize) -> String {
    s.chars().skip(start).take(len).collect()
}

/// `ssf.write_date(type, fmt, val, ss0)`.
///
/// `t` is the token type character; `fmt` is the accumulated run (e.g. "yyyy",
/// "mm", "hh", "[h]", ".00"). Returns the rendered fragment, or an error for
/// malformed time codes (matching upstream's `throw`).
pub fn write_date(t: char, fmt: &str, val: &DateCode, ss0: i64) -> Result<String, String> {
    let flen = fmt.chars().count();
    let out: i64;
    let mut outl: usize = 0;
    let mut y = val.y;

    match t {
        'b' => {
            // buddhist year: +543, then fall through to 'y' logic
            y = val.y + 543;
            match flen {
                1 | 2 => {
                    out = y % 100;
                    outl = 2;
                }
                _ => {
                    out = y % 10000;
                    outl = 4;
                }
            }
        }
        'y' => match flen {
            1 | 2 => {
                out = y % 100;
                outl = 2;
            }
            _ => {
                out = y % 10000;
                outl = 4;
            }
        },
        'm' => match flen {
            1 | 2 => {
                out = val.m;
                outl = flen;
            }
            3 => return Ok(MONTHS[(val.m - 1) as usize][1].to_string()),
            5 => return Ok(MONTHS[(val.m - 1) as usize][0].to_string()),
            _ => return Ok(MONTHS[(val.m - 1) as usize][2].to_string()),
        },
        'd' => match flen {
            1 | 2 => {
                out = val.d;
                outl = flen;
            }
            3 => return Ok(DAYS[val.q as usize][0].to_string()),
            _ => return Ok(DAYS[val.q as usize][1].to_string()),
        },
        'h' => match flen {
            1 | 2 => {
                out = 1 + (val.h + 11) % 12;
                outl = flen;
            }
            _ => return Err(format!("bad hour format: {fmt}")),
        },
        'H' => match flen {
            1 | 2 => {
                out = val.h;
                outl = flen;
            }
            _ => return Err(format!("bad hour format: {fmt}")),
        },
        'M' => match flen {
            1 | 2 => {
                out = val.min;
                outl = flen;
            }
            _ => return Err(format!("bad minute format: {fmt}")),
        },
        's' => {
            if fmt != "s" && fmt != "ss" && fmt != ".0" && fmt != ".00" && fmt != ".000" {
                return Err(format!("bad second format: {fmt}"));
            }
            if val.u == 0.0 && (fmt == "s" || fmt == "ss") {
                return Ok(pad0_i(val.sec, flen));
            }
            let tt: i64 = if ss0 >= 2 {
                if ss0 == 3 { 1000 } else { 100 }
            } else if ss0 == 1 {
                10
            } else {
                1
            };
            let mut ss = jsnum::round(tt as f64 * (val.sec as f64 + val.u)) as i64;
            if ss >= 60 * tt {
                ss = 0;
            }
            if fmt == "s" {
                return Ok(if ss == 0 {
                    "0".to_string()
                } else {
                    jsnum::to_string_js(ss as f64 / tt as f64)
                });
            }
            let o = pad0_i(ss, (2 + ss0) as usize);
            if fmt == "ss" {
                return Ok(substr(&o, 0, 2));
            }
            return Ok(format!(".{}", substr(&o, 2, flen - 1)));
        }
        'Z' => {
            match fmt {
                "[h]" | "[hh]" => out = val.serial_d * 24 + val.h,
                "[m]" | "[mm]" => out = (val.serial_d * 24 + val.h) * 60 + val.min,
                "[s]" | "[ss]" => {
                    out = ((val.serial_d * 24 + val.h) * 60 + val.min) * 60
                        + jsnum::round(val.sec as f64 + val.u) as i64
                }
                _ => return Err(format!("bad abstime format: {fmt}")),
            }
            outl = if flen == 3 { 1 } else { 2 };
        }
        'e' => {
            out = y;
            outl = 1;
        }
        _ => {
            out = 0;
        }
    }

    if outl > 0 {
        Ok(pad0(&out.to_string(), outl))
    } else {
        Ok(String::new())
    }
}
