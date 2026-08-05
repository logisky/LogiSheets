//! `eval_fmt` — tokenize a single format section and render a value against it.
//! Ported from `ssf`'s `eval_fmt`, plus `split_fmt` and `fmt_is_date`.

use regex::Regex;
use std::sync::OnceLock;

use crate::datecode::{parse_date_code, write_date, DateCode};
use crate::general;
use crate::jsnum;
use crate::writenum::write_num;

/// A value to be formatted: a number or text.
#[derive(Debug, Clone)]
pub enum Value {
    Num(f64),
    Text(String),
}

impl Value {
    fn as_num(&self) -> f64 {
        match self {
            Value::Num(n) => *n,
            Value::Text(_) => f64::NAN,
        }
    }
    fn as_text(&self) -> String {
        match self {
            Value::Num(n) => jsnum::to_string_js(*n),
            Value::Text(t) => t.clone(),
        }
    }
}

#[derive(Debug, Clone)]
struct Tok {
    t: char,
    v: String,
}

fn abstime_re() -> &'static Regex {
    static C: OnceLock<Regex> = OnceLock::new();
    C.get_or_init(|| Regex::new(r"\[[HhMmSs\x{0E0A}\x{0E19}\x{0E17}]*\]").unwrap())
}
fn currency_re() -> &'static Regex {
    static C: OnceLock<Regex> = OnceLock::new();
    C.get_or_init(|| Regex::new(r"\$([^-\[\]]*)").unwrap())
}
fn dot0_re() -> &'static Regex {
    static C: OnceLock<Regex> = OnceLock::new();
    C.get_or_init(|| Regex::new(r"\.0+$").unwrap())
}

fn isgeneral_chars(f: &[char], i: usize) -> bool {
    const G: [char; 7] = ['g', 'e', 'n', 'e', 'r', 'a', 'l'];
    if f.len() < i + 7 {
        return false;
    }
    (0..7).all(|k| f[i + k].to_ascii_lowercase() == G[k])
}

fn chars_substr_upper(f: &[char], i: usize, len: usize) -> String {
    f.iter()
        .skip(i)
        .take(len)
        .collect::<String>()
        .to_uppercase()
}

fn chars_substr(f: &[char], i: usize, len: usize) -> String {
    f.iter().skip(i).take(len).collect()
}

/// JS `substr(start, len)` over an ASCII string, clamping like the spec.
fn substr(s: &str, start: i32, len: i32) -> String {
    let b = s.as_bytes();
    let n = b.len() as i32;
    let st = if start < 0 { (n + start).max(0) } else { start.min(n) };
    let l = if len < 0 { 0 } else { len.min(n - st) };
    String::from_utf8_lossy(&b[st as usize..(st + l) as usize]).into_owned()
}

fn charat(s: &str, idx: i32) -> Option<char> {
    if idx < 0 {
        return None;
    }
    s.as_bytes().get(idx as usize).map(|&b| b as char)
}

/// `ssf.split_fmt`.
pub fn split_fmt(fmt: &str) -> Result<Vec<String>, String> {
    let f: Vec<char> = fmt.chars().collect();
    let n = f.len();
    let mut out: Vec<String> = Vec::new();
    let mut in_str = false;
    let mut i = 0usize;
    let mut j = 0usize;
    while i < n {
        match f[i] {
            '"' => in_str = !in_str,
            '_' | '*' | '\\' => {
                i += 1;
            }
            ';' if !in_str => {
                out.push(f[j..i].iter().collect());
                j = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    out.push(f[j..].iter().collect());
    if in_str {
        return Err(format!("Format |{}| unterminated string ", fmt));
    }
    Ok(out)
}

/// `ssf.fmt_is_date` / `SSF.is_date`.
pub fn fmt_is_date(fmt: &str) -> bool {
    let f: Vec<char> = fmt.chars().collect();
    let n = f.len();
    let mut i = 0usize;
    while i < n {
        let c = f[i];
        match c {
            'G' => {
                if isgeneral_chars(&f, i) {
                    i += 6;
                }
                i += 1;
            }
            '"' => {
                i += 1;
                while i < n && f[i] != '"' {
                    i += 1;
                }
                i += 1;
            }
            '\\' => i += 2,
            '_' => i += 2,
            '@' => i += 1,
            'B' | 'b' => {
                if f.get(i + 1) == Some(&'1') || f.get(i + 1) == Some(&'2') {
                    return true;
                }
                return true; // falls through to the m/d/y group -> date
            }
            'M' | 'D' | 'Y' | 'H' | 'S' | 'E' | 'm' | 'd' | 'y' | 'h' | 's' | 'e' | 'g' => {
                return true
            }
            'A' | 'a' | '上' => {
                if chars_substr_upper(&f, i, 3) == "A/P" {
                    return true;
                }
                if chars_substr_upper(&f, i, 5) == "AM/PM" {
                    return true;
                }
                if chars_substr(&f, i, 5) == "上午/下午" {
                    return true;
                }
                i += 1;
            }
            '[' => {
                let mut o = String::from('[');
                loop {
                    let tmp = f.get(i).copied();
                    i += 1;
                    let cond = tmp != Some(']') && i < n;
                    if !cond {
                        break;
                    }
                    o.push(f[i]);
                }
                if abstime_re().is_match(&o) {
                    return true;
                }
            }
            '.' | '0' | '#' => {
                // consume a numeric run
                loop {
                    i += 1;
                    if i >= n {
                        break;
                    }
                    let cc = f[i];
                    if "0#?.,E+-%".contains(cc) {
                        continue;
                    }
                    if cc == '\\'
                        && f.get(i + 1) == Some(&'-')
                        && f.get(i + 2).map_or(false, |x| "0#".contains(*x))
                    {
                        continue;
                    }
                    break;
                }
            }
            '?' => {
                while f.get(i + 1) == Some(&'?') {
                    i += 1;
                }
                i += 1;
            }
            '*' => {
                i += 1;
                if f.get(i) == Some(&' ') || f.get(i) == Some(&'*') {
                    i += 1;
                }
            }
            '(' | ')' => i += 1,
            '1'..='9' => {
                while i < n && f.get(i + 1).map_or(false, |x| x.is_ascii_digit()) {
                    i += 1;
                }
                i += 1;
            }
            ' ' => i += 1,
            _ => i += 1,
        }
    }
    false
}

struct Ev {
    out: Vec<Tok>,
    i: usize,
    lst: char,
    hr: char,
    dt: Option<DateCode>,
    date1904: bool,
    f: Vec<char>,
    n: usize,
}

impl Ev {
    /// Shared m/d/y/h/s/e/g/b handling. Returns Ok(false) to abort with "".
    fn datetime(&mut self, c: char, vnum: f64) -> Result<bool, String> {
        if vnum < 0.0 {
            return Ok(false);
        }
        if self.dt.is_none() {
            self.dt = parse_date_code(vnum, self.date1904, false);
            if self.dt.is_none() {
                return Ok(false);
            }
        }
        self.i += 1;
        let mut o = String::from(c);
        while self.i < self.n && self.f[self.i].to_ascii_lowercase() == c {
            o.push(c);
            self.i += 1;
        }
        let mut cc = c;
        if cc == 'm' && self.lst.to_ascii_lowercase() == 'h' {
            cc = 'M';
        }
        if cc == 'h' {
            cc = self.hr;
        }
        self.out.push(Tok { t: cc, v: o });
        self.lst = cc;
        Ok(true)
    }

    fn numeric(&mut self, start: char) {
        let mut o = String::from(start);
        self.i += 1;
        while self.i < self.n && "0#?.,E+-%".contains(self.f[self.i]) {
            o.push(self.f[self.i]);
            self.i += 1;
        }
        self.out.push(Tok { t: 'n', v: o });
    }
}

const ALLOWED: &str = ",$-+/():!^&'~{}<>=€acfijklopqrtuvwxzP";

/// `ssf.eval_fmt(fmt, v, opts, flen)`.
pub fn eval_fmt(fmt: &str, v: &Value, date1904: bool, flen: usize) -> Result<String, String> {
    let vnum = v.as_num();
    let mut ev = Ev {
        out: Vec::new(),
        i: 0,
        lst: 't',
        hr: 'H',
        dt: None,
        date1904,
        f: fmt.chars().collect(),
        n: 0,
    };
    ev.n = ev.f.len();

    // --- Tokenize ---
    while ev.i < ev.n {
        let c = ev.f[ev.i];
        match c {
            'G' => {
                if !isgeneral_chars(&ev.f, ev.i) {
                    return Err(format!("unrecognized character {} in {}", c, fmt));
                }
                ev.out.push(Tok { t: 'G', v: "General".into() });
                ev.i += 7;
            }
            '"' => {
                let mut o = String::new();
                ev.i += 1;
                while ev.i < ev.n && ev.f[ev.i] != '"' {
                    o.push(ev.f[ev.i]);
                    ev.i += 1;
                }
                ev.out.push(Tok { t: 't', v: o });
                ev.i += 1;
            }
            '\\' => {
                ev.i += 1;
                let w = ev.f.get(ev.i).copied().unwrap_or('\0');
                let t = if w == '(' || w == ')' { w } else { 't' };
                ev.out.push(Tok { t, v: w.to_string() });
                ev.i += 1;
            }
            '_' => {
                ev.out.push(Tok { t: 't', v: " ".into() });
                ev.i += 2;
            }
            '@' => {
                ev.out.push(Tok { t: 'T', v: v.as_text() });
                ev.i += 1;
            }
            'B' | 'b' => {
                let next = ev.f.get(ev.i + 1).copied();
                if next == Some('1') || next == Some('2') {
                    if ev.dt.is_none() {
                        ev.dt = parse_date_code(vnum, date1904, next == Some('2'));
                        if ev.dt.is_none() {
                            return Ok(String::new());
                        }
                    }
                    let sub = chars_substr(&ev.f, ev.i, 2);
                    ev.out.push(Tok { t: 'X', v: sub });
                    ev.lst = c;
                    ev.i += 2;
                } else if !ev.datetime('b', vnum)? {
                    return Ok(String::new());
                }
            }
            'M' | 'D' | 'Y' | 'H' | 'S' | 'E' => {
                if !ev.datetime(c.to_ascii_lowercase(), vnum)? {
                    return Ok(String::new());
                }
            }
            'm' | 'd' | 'y' | 'h' | 's' | 'e' | 'g' => {
                if !ev.datetime(c, vnum)? {
                    return Ok(String::new());
                }
            }
            'A' | 'a' | '上' => {
                let mut q = Tok { t: c, v: c.to_string() };
                if ev.dt.is_none() {
                    ev.dt = parse_date_code(vnum, date1904, false);
                }
                if chars_substr_upper(&ev.f, ev.i, 3) == "A/P" {
                    if let Some(dt) = &ev.dt {
                        q.v = if dt.h >= 12 { "P" } else { "A" }.into();
                    }
                    q.t = 'T';
                    ev.hr = 'h';
                    ev.i += 3;
                } else if chars_substr_upper(&ev.f, ev.i, 5) == "AM/PM" {
                    if let Some(dt) = &ev.dt {
                        q.v = if dt.h >= 12 { "PM" } else { "AM" }.into();
                    }
                    q.t = 'T';
                    ev.i += 5;
                    ev.hr = 'h';
                } else if chars_substr(&ev.f, ev.i, 5) == "上午/下午" {
                    if let Some(dt) = &ev.dt {
                        q.v = if dt.h >= 12 { "下午" } else { "上午" }.into();
                    }
                    q.t = 'T';
                    ev.i += 5;
                    ev.hr = 'h';
                } else {
                    q.t = 't';
                    ev.i += 1;
                }
                if ev.dt.is_none() && q.t == 'T' {
                    return Ok(String::new());
                }
                ev.out.push(q);
                ev.lst = c;
            }
            '[' => {
                let mut o = String::from('[');
                loop {
                    let tmp = ev.f.get(ev.i).copied();
                    ev.i += 1;
                    let cond = tmp != Some(']') && ev.i < ev.n;
                    if !cond {
                        break;
                    }
                    o.push(ev.f[ev.i]);
                }
                if !o.ends_with(']') {
                    return Err(format!("unterminated \"[\" block: |{}|", o));
                }
                if abstime_re().is_match(&o) {
                    if ev.dt.is_none() {
                        ev.dt = parse_date_code(vnum, date1904, false);
                        if ev.dt.is_none() {
                            return Ok(String::new());
                        }
                    }
                    let lc = o.to_lowercase();
                    let second = lc.chars().nth(1).unwrap_or('\0');
                    ev.out.push(Tok { t: 'Z', v: lc });
                    ev.lst = second;
                } else if o.contains('$') {
                    let sym = currency_re()
                        .captures(&o)
                        .and_then(|c| c.get(1))
                        .map(|m| m.as_str())
                        .filter(|s| !s.is_empty())
                        .unwrap_or("$")
                        .to_string();
                    if !fmt_is_date(fmt) {
                        ev.out.push(Tok { t: 't', v: sym });
                    }
                }
            }
            '.' => {
                if ev.dt.is_some() {
                    let mut o = String::from('.');
                    ev.i += 1;
                    while ev.i < ev.n && ev.f[ev.i] == '0' {
                        o.push('0');
                        ev.i += 1;
                    }
                    ev.out.push(Tok { t: 's', v: o });
                } else {
                    ev.numeric('.');
                }
            }
            '0' | '#' => ev.numeric(c),
            '?' => {
                let mut o = String::from('?');
                ev.i += 1;
                while ev.i < ev.n && ev.f[ev.i] == '?' {
                    o.push('?');
                    ev.i += 1;
                }
                ev.out.push(Tok { t: '?', v: o });
                ev.lst = '?';
            }
            '*' => {
                ev.i += 1;
                if ev.f.get(ev.i) == Some(&' ') || ev.f.get(ev.i) == Some(&'*') {
                    ev.i += 1;
                }
            }
            '(' | ')' => {
                let tt = if flen == 1 { 't' } else { c };
                ev.out.push(Tok { t: tt, v: c.to_string() });
                ev.i += 1;
            }
            '1'..='9' => {
                let mut o = String::from(c);
                loop {
                    if ev.i >= ev.n {
                        break;
                    }
                    ev.i += 1;
                    if ev.i < ev.n && ev.f[ev.i].is_ascii_digit() {
                        o.push(ev.f[ev.i]);
                    } else {
                        break;
                    }
                }
                ev.out.push(Tok { t: 'D', v: o });
            }
            ' ' => {
                ev.out.push(Tok { t: ' ', v: " ".into() });
                ev.i += 1;
            }
            '$' => {
                ev.out.push(Tok { t: 't', v: "$".into() });
                ev.i += 1;
            }
            _ => {
                if !ALLOWED.contains(c) {
                    return Err(format!("unrecognized character {} in {}", c, fmt));
                }
                ev.out.push(Tok { t: 't', v: c.to_string() });
                ev.i += 1;
            }
        }
    }

    // --- Scan for date/time parts (backwards) ---
    let mut bt = 0i32;
    let mut ss0 = 0i64;
    let mut lst = 't';
    for i in (0..ev.out.len()).rev() {
        match ev.out[i].t {
            'h' | 'H' => {
                ev.out[i].t = ev.hr;
                lst = 'h';
                if bt < 1 {
                    bt = 1;
                }
            }
            's' => {
                if let Some(m) = dot0_re().find(&ev.out[i].v) {
                    ss0 = ss0.max(m.as_str().len() as i64 - 1);
                }
                if bt < 3 {
                    bt = 3;
                }
                lst = 's';
            }
            'd' | 'y' | 'M' | 'e' => lst = ev.out[i].t,
            'm' => {
                if lst == 's' {
                    ev.out[i].t = 'M';
                    if bt < 2 {
                        bt = 2;
                    }
                }
            }
            'X' => {}
            'Z' => {
                let hasv = |set: &str| ev.out[i].v.chars().any(|ch| set.contains(ch));
                if bt < 1 && hasv("Hh") {
                    bt = 1;
                }
                if bt < 2 && hasv("Mm") {
                    bt = 2;
                }
                if bt < 3 && hasv("Ss") {
                    bt = 3;
                }
            }
            _ => {}
        }
    }

    // --- time rounding ---
    if let Some(dt) = &mut ev.dt {
        match bt {
            1 => {
                if dt.u >= 0.5 {
                    dt.u = 0.0;
                    dt.sec += 1;
                }
                if dt.sec >= 60 {
                    dt.sec = 0;
                    dt.min += 1;
                }
                if dt.min >= 60 {
                    dt.min = 0;
                    dt.h += 1;
                }
            }
            2 => {
                if dt.u >= 0.5 {
                    dt.u = 0.0;
                    dt.sec += 1;
                }
                if dt.sec >= 60 {
                    dt.sec = 0;
                    dt.min += 1;
                }
            }
            _ => {}
        }
    }

    // --- replace fields ---
    let out = &mut ev.out;
    let mut nstr = String::new();
    let mut i = 0usize;
    while i < out.len() {
        match out[i].t {
            't' | 'T' | ' ' | 'D' => {}
            'X' => {
                out[i].v = String::new();
                out[i].t = ';';
            }
            'd' | 'm' | 'y' | 'h' | 'H' | 'M' | 's' | 'e' | 'b' | 'Z' => {
                let dt = ev.dt.as_ref().unwrap();
                out[i].v = write_date(out[i].t, &out[i].v, dt, ss0)?;
                out[i].t = 't';
            }
            'n' | '?' => {
                let mut jj = i + 1;
                loop {
                    let cur = match out.get(jj) {
                        Some(x) => x.clone(),
                        None => break,
                    };
                    let c = cur.t;
                    let next = out.get(jj + 1);
                    let cond = c == '?'
                        || c == 'D'
                        || ((c == ' ' || c == 't')
                            && next.map_or(false, |nx| {
                                nx.t == '?' || (nx.t == 't' && nx.v == "/")
                            }))
                        || (c == 't'
                            && (cur.v == "/"
                                || (cur.v == " "
                                    && next.map_or(false, |nx| nx.t == '?'))));
                    if !cond {
                        break;
                    }
                    let addv = out[jj].v.clone();
                    out[i].v.push_str(&addv);
                    out[jj].v = String::new();
                    out[jj].t = ';';
                    jj += 1;
                }
                nstr.push_str(&out[i].v);
                i = jj - 1;
            }
            'G' => {
                out[i].t = 't';
                out[i].v = general_of(v);
            }
            _ => {}
        }
        i += 1;
    }

    // --- distribute the rendered number across placeholder slots ---
    if !nstr.is_empty() {
        let myv = if nstr.starts_with('(') {
            vnum
        } else {
            if vnum < 0.0 && flen > 1 {
                -vnum
            } else {
                vnum
            }
        };
        let mut ostr = write_num("n", &nstr, myv)?;
        if !nstr.starts_with('(') && myv < 0.0 && out.first().map_or(false, |o| o.t == 't') {
            ostr = substr(&ostr, 1, ostr.len() as i32);
            out[0].v = format!("-{}", out[0].v);
        }

        let mut jj: i32 = ostr.len() as i32 - 1;
        let mut decpt = out.len();
        for k in 0..out.len() {
            if out[k].t != 't' && out[k].v.contains('.') {
                decpt = k;
                break;
            }
        }
        let mut lasti = out.len();
        let is_np = |t: char| t == 'n' || t == '?';

        if decpt == out.len() && !ostr.contains('E') {
            for k in (0..out.len()).rev() {
                if !is_np(out[k].t) {
                    continue;
                }
                let vlen = out[k].v.len() as i32;
                if jj >= vlen - 1 {
                    jj -= vlen;
                    out[k].v = substr(&ostr, jj + 1, vlen);
                } else if jj < 0 {
                    out[k].v = String::new();
                } else {
                    out[k].v = substr(&ostr, 0, jj + 1);
                    jj = -1;
                }
                out[k].t = 't';
                lasti = k;
            }
            if jj >= 0 && lasti < out.len() {
                out[lasti].v = format!("{}{}", substr(&ostr, 0, jj + 1), out[lasti].v);
            }
        } else if decpt != out.len() && !ostr.contains('E') {
            // integer part (right-to-left from decpt)
            jj = ostr.find('.').map(|x| x as i32).unwrap_or(-1) - 1;
            for k in (0..=decpt).rev() {
                if k >= out.len() || !is_np(out[k].t) {
                    continue;
                }
                let vhasdot = out[k].v.contains('.');
                let mut j: i32 = if vhasdot && k == decpt {
                    out[k].v.find('.').unwrap() as i32 - 1
                } else {
                    out[k].v.len() as i32 - 1
                };
                let mut vv = substr(&out[k].v, j + 1, out[k].v.len() as i32);
                while j >= 0 {
                    let ch = charat(&out[k].v, j);
                    if jj >= 0 && (ch == Some('0') || ch == Some('#')) {
                        vv = format!("{}{}", charat(&ostr, jj).unwrap_or('\0'), vv);
                        jj -= 1;
                    }
                    j -= 1;
                }
                out[k].v = vv;
                out[k].t = 't';
                lasti = k;
            }
            if jj >= 0 && lasti < out.len() {
                out[lasti].v = format!("{}{}", substr(&ostr, 0, jj + 1), out[lasti].v);
            }
            // fraction part (left-to-right from decpt)
            jj = ostr.find('.').map(|x| x as i32 + 1).unwrap_or(ostr.len() as i32);
            for k in decpt..out.len() {
                if out[k].t != '(' && !is_np(out[k].t) && k != decpt {
                    continue;
                }
                let vhasdot = out[k].v.contains('.');
                let mut j: i32 = if vhasdot && k == decpt {
                    out[k].v.find('.').unwrap() as i32 + 1
                } else {
                    0
                };
                let mut vv = substr(&out[k].v, 0, j);
                let vlen = out[k].v.len() as i32;
                while j < vlen {
                    if jj < ostr.len() as i32 {
                        vv.push(charat(&ostr, jj).unwrap_or('\0'));
                        jj += 1;
                    }
                    j += 1;
                }
                out[k].v = vv;
                out[k].t = 't';
                // (upstream also updates `lasti` here, but it is never read after
                // the fraction pass, so we omit the dead assignment)
            }
        }
    }

    // --- any leftover numeric tokens ---
    for k in 0..ev.out.len() {
        let t = ev.out[k].t;
        if t == 'n' || t == '?' {
            let myv = if flen > 1
                && vnum < 0.0
                && k > 0
                && ev.out[k - 1].v == "-"
            {
                -vnum
            } else {
                vnum
            };
            let fmt_run = ev.out[k].v.clone();
            ev.out[k].v = write_num(&t.to_string(), &fmt_run, myv)?;
            ev.out[k].t = 't';
        }
    }

    let mut retval = String::new();
    for tok in &ev.out {
        retval.push_str(&tok.v);
    }
    Ok(retval)
}

fn general_of(v: &Value) -> String {
    match v {
        Value::Num(n) => general::general_fmt_num_value(*n),
        Value::Text(t) => t.clone(),
    }
}
