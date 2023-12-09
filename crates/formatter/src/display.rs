pub struct FormattedString {
    pub chars: Vec<FmtChar>,
    pub color: Option<u8>,
}

impl FormattedString {
    pub fn to_string(&self) -> String {
        self.chars.iter().fold(String::from(""), |mut prev, c| {
            let s = &c.c;
            prev.push_str(s);
            prev
        })
    }
}

pub struct FmtChar {
    pub c: String,
    pub char_type: CharType,
}

pub enum CharType {
    /// Just show the `c`
    None,
    /// Underscore means that `c` is not shown and whitespaces
    /// with the same width as the `c` is placed here.
    Underscore,
    /// Asterisk means this `c` should be repeated to fill the column width.
    /// One `FormattedString` should only have one `FmtChat` with `Asterisk` type.
    /// All but last `Asterisk FmtChar` is invalid.
    Asterisk,
}
