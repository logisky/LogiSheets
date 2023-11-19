use lazy_static::lazy_static;
use regex::Regex;

lazy_static! {
    static ref NUMBER_PLACEHOLDER_REGEX: Regex = Regex::new(r#"^[?#0]+"#).unwrap();
    static ref COMMA_REGEX: Regex = Regex::new(r#"^,+"#).unwrap();
    static ref DOT_REGEX: Regex = Regex::new(r#"^\.+"#).unwrap();
    static ref SLASH_REGEX: Regex = Regex::new(r#"^\/+"#).unwrap();
    static ref LITERAL_REGEX: Regex = Regex::new(r#"^"(.*)""#).unwrap();
    static ref SEMICOLON_REGEX: Regex = Regex::new(r#"^;"#).unwrap();
    static ref UNDERSCORE_REGEX: Regex = Regex::new(r#"^_(.)?"#).unwrap();
}

pub struct ParseResult {
    pub first: Segment,
    pub second: Option<Segment>,
    pub third: Option<Segment>,
}

pub struct Parser {}

impl Parser {
    pub fn parse(&mut self, fmt: &str) -> ParseResult {
        let l = fmt.len();
        let mut curr = 0;
        let mut idx = 0;
        let mut segments: Vec<Segment> = Vec::with_capacity(3);
        while curr <= l - 1 || idx < 3 {
            let seg = self.parse_segment(fmt);
            curr += seg.len();
            idx += 1;

            segments[idx] = seg;
        }

        let mut iter = segments.into_iter();
        ParseResult {
            first: iter.next().unwrap(),
            second: iter.next(),
            third: iter.next(),
        }
    }

    fn parse_segment(&mut self, fmt: &str) -> Segment {
        Segment::parse(fmt)
    }
}

#[derive(Debug)]
pub struct Segment {
    pub tokens: Vec<Token>,

    last_comma: i8,
    first_dot: i8,
    slash: i8,
    len: usize,
}

impl Segment {
    pub fn len(&self) -> usize {
        self.len
    }

    pub fn new() -> Self {
        Segment {
            tokens: vec![],
            last_comma: -1,
            first_dot: -1,
            slash: -1,
            len: 0,
        }
    }

    pub fn parse(s: &str) -> Segment {
        let mut seg = Segment::new();
        let mut s = s;
        loop {
            match seg.add_token(&s) {
                Ok(ParsingSegment::Continue(next)) => {
                    s = next;
                }
                Ok(ParsingSegment::Stop(_)) => return seg,
                Err(_) => panic!(),
            }
        }
    }

    pub fn add_token<'a>(&mut self, s: &'a str) -> Result<ParsingSegment<'a>, ()> {
        let mut stop = false;
        let size = if let Some(r) = NUMBER_PLACEHOLDER_REGEX.find(s) {
            let holders = r.as_str().to_string();
            let token = Token::NumberPlaceHolder(holders);
            self.tokens.push(token);
            r.len()
        } else if let Some(r) = COMMA_REGEX.find(s) {
            let l = r.len();
            let token = Token::Comma(l as u8 - 1u8);
            self.tokens.push(token);
            self.last_comma = self.tokens.len() as i8 - 1;
            l
        } else if let Some(r) = DOT_REGEX.find(s) {
            let l = r.len();
            self.tokens.push(Token::Dot(l as u8 - 1u8));
            if self.first_dot < 0 {
                self.first_dot = self.tokens.len() as i8 - 1;
            }
            l
        } else if let Some(r) = SLASH_REGEX.find(s) {
            if self.slash > 0 || r.len() > 1 {
                let token = Token::Display(r.as_str().to_string());
                self.tokens.push(token);
            } else {
                let token = Token::Slash;
                self.tokens.push(token);
                self.slash = (self.tokens.len() - 1) as i8;
            }
            r.len()
        } else if let Some(r) = LITERAL_REGEX.find(s) {
            let s = &r.as_str()[1..r.len() - 1];
            let token = Token::Display(s.to_string());
            self.tokens.push(token);
            r.len()
        } else if let Some(_) = SEMICOLON_REGEX.find(s) {
            stop = true;
            1
        } else if let Some(r) = UNDERSCORE_REGEX.find(s) {
            let c = r.as_str().chars().last().unwrap();
            let token = Token::Underscore(c);
            self.tokens.push(token);
            r.len()
        } else {
            return Err(());
        };

        self.len += size;

        let remained = &s[size..];
        let parsing = if stop {
            ParsingSegment::Stop(remained)
        } else {
            ParsingSegment::Continue(remained)
        };
        Ok(parsing)
    }
}

pub enum ParsingSegment<'a> {
    Continue(&'a str),
    Stop(&'a str),
}

#[derive(Debug)]
pub enum Token {
    Display(String),
    NumberPlaceHolder(String),
    Underscore(char),
    Comma(u8),
    Dot(u8),
    Slash,
}
