use pest::Parser;
use pest_derive::Parser;
use tracing::error;

mod fmt;

pub use fmt::{lex_and_fmt, CellRef, FormulaDisplayInfo, TokenType, TokenUnit};

#[derive(Parser)]
#[grammar = "grammar.pest"]
pub struct FormulaParser;

pub fn lex(s: &str) -> Option<pest::iterators::Pair<Rule>> {
    let result = FormulaParser::parse(Rule::start, s);
    match result {
        Ok(mut r) => {
            let tokens = r.next().unwrap();
            Some(tokens)
        }
        Err(e) => {
            println!("parse formula failed: {}\nMeet error: {}", s, e);
            error!("parse formula failed: {}\nMeet error: {}", s, e);
            None
        }
    }
}
