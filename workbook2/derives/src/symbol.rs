use std::fmt::{self, Display};
use syn::{Ident, Path};

#[derive(Copy, Clone)]
pub struct Symbol(&'static str);

pub const XML_SERDE: Symbol = Symbol("xmlserde");
pub const NAME: Symbol = Symbol("name");
pub const TYPE: Symbol = Symbol("ty");
pub const SKIP_SERIALIZING: Symbol = Symbol("skip_serializing");
pub const SKIP_SERIALIZING_IF: Symbol = Symbol("skip_serializing_if");
pub const VEC_SIZE: Symbol = Symbol("vec_size");

impl PartialEq<Symbol> for Ident {
    fn eq(&self, other: &Symbol) -> bool {
        self == other.0
    }
}

impl<'a> PartialEq<Symbol> for &'a Ident {
    fn eq(&self, word: &Symbol) -> bool {
        *self == word.0
    }
}

impl<'a> PartialEq<Symbol> for Path {
    fn eq(&self, word: &Symbol) -> bool {
        self.is_ident(word.0)
    }
}

impl<'a> PartialEq<Symbol> for &'a Path {
    fn eq(&self, word: &Symbol) -> bool {
        self.is_ident(word.0)
    }
}

impl Display for Symbol {
    fn fmt(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
        formatter.write_str(self.0)
    }
}
