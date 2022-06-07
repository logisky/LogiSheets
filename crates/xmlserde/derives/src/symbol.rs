use std::fmt::{self, Display};
use syn::{Ident, Path};

#[derive(Copy, Clone)]
pub struct Symbol(&'static str);

pub const WITH_NS: Symbol = Symbol("with_ns");
pub const WITH_CUSTOM_NS: Symbol = Symbol("with_custom_ns");
pub const ROOT: Symbol = Symbol("root");
pub const XML_SERDE: Symbol = Symbol("xmlserde");
pub const NAME: Symbol = Symbol("name");
pub const TYPE: Symbol = Symbol("ty");
pub const SKIP_SERIALIZING: Symbol = Symbol("skip_serializing");
pub const VEC_SIZE: Symbol = Symbol("vec_size");
pub const DEFAULT: Symbol = Symbol("default");

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
