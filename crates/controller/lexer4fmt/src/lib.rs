//! A tolerant variant of `logisheets_lexer` for formula EDITING rather than
//! evaluation: its grammar accepts a trailing incomplete tail (`SUM(A1+`), and
//! [`lex_and_fmt`] turns the parse tree into highlight tokens and the cell
//! references to colour on the grid. Nothing here builds an AST; the engine's
//! evaluation path uses `logisheets_lexer` + `logisheets_parser`.

use pest::Parser;
use pest_derive::Parser;
use tracing::error;

mod fmt;

pub use fmt::{CellRef, FormulaDisplayInfo, TokenType, TokenUnit, lex_and_fmt};

#[derive(Parser)]
#[grammar = "grammar.pest"]
pub struct FormulaParser;

/// Lex a formula body (no leading `=`) with the tolerant grammar, returning
/// the `formula` pair. `None` when it does not lex; the failure is logged.
pub fn lex(s: &str) -> Option<pest::iterators::Pair<'_, Rule>> {
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
