use crate::*;
use gents_derives::TS;
use pest::iterators::Pair;

#[derive(Debug, TS, Clone, Eq, PartialEq)]
#[ts(rename_all = "camelCase", file_name = "token_unit.ts")]
pub struct TokenUnit {
    pub token_type: TokenType,
    pub start: usize,
    pub end: usize,
}

/// We only have formatting rules for these types
#[derive(Debug, TS, Clone, Eq, PartialEq)]
#[ts(rename_all = "camelCase", file_name = "token_type.ts")]
pub enum TokenType {
    FuncName,
    CellReference,
    ErrorConstant,
    WrongSuffix,
    Other,
}

pub fn lex_and_fmt(s: &str, allow_wrong: bool) -> Option<Vec<TokenUnit>> {
    let pairs = if allow_wrong { lex_wrong(s) } else { lex(s) }?;
    Some(convert_rule_to_units(pairs))
}

fn lex_wrong(s: &str) -> Option<pest::iterators::Pair<Rule>> {
    let result = FormulaParser::parse(Rule::start_wrong, s);
    match result {
        Ok(mut r) => {
            let tokens = r.next().unwrap();
            Some(tokens)
        }
        Err(e) => {
            error!("parse formula failed: {}\nMeet error: {}", s, e);
            None
        }
    }
}

fn convert_rule_to_units(pair: Pair<Rule>) -> Vec<TokenUnit> {
    let mut result = Vec::new();
    match pair.as_rule() {
        Rule::function_name => {
            let ty = TokenType::FuncName;
            let s = pair.as_span();

            result.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
        }
        Rule::cell_reference => {
            let ty = TokenType::CellReference;
            let s = pair.as_span();
            result.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
        }
        Rule::error_constant => {
            let ty = TokenType::ErrorConstant;
            let s = pair.as_span();
            result.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
        }
        Rule::wrong_suffix => {
            let ty = TokenType::WrongSuffix;
            let s = pair.as_span();
            result.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
        }
        _ => {
            let inner = pair.clone().into_inner();
            if inner.peek().is_none() {
                let ty = TokenType::Other;
                let s = pair.as_span();
                result.push(TokenUnit {
                    start: s.start(),
                    end: s.end(),
                    token_type: ty,
                });
            } else {
                for inner_pair in inner {
                    result.extend(convert_rule_to_units(inner_pair));
                }
            }
        }
    }
    result
}

#[test]
fn test_lex_and_fmt() {
    let s = "A1";
    let result = lex_and_fmt(s, false).unwrap();
    assert_eq!(
        result,
        vec![TokenUnit {
            start: 0,
            end: 2,
            token_type: TokenType::CellReference
        }]
    )
}

#[test]
fn test_lex_and_fmt_error() {
    let s = "SUM(A1+Sheet2!A2)";
    let result = lex_and_fmt(s, false).unwrap();
    assert_eq!(
        result,
        vec![
            TokenUnit {
                start: 0,
                end: 3,
                token_type: TokenType::FuncName
            },
            TokenUnit {
                start: 4,
                end: 6,
                token_type: TokenType::CellReference
            },
            TokenUnit {
                start: 6,
                end: 7,
                token_type: TokenType::Other
            },
            TokenUnit {
                start: 7,
                end: 16,
                token_type: TokenType::CellReference
            }
        ]
    )
}

#[test]
fn test_lex_and_fmt_wrong() {
    let s = "SUM(A1+Sheet2!A2)!111";
    let result = lex_and_fmt(s, true).unwrap();
    assert_eq!(
        result,
        vec![
            TokenUnit {
                start: 0,
                end: 3,
                token_type: TokenType::FuncName
            },
            TokenUnit {
                start: 4,
                end: 6,
                token_type: TokenType::CellReference
            },
            TokenUnit {
                start: 6,
                end: 7,
                token_type: TokenType::Other
            },
            TokenUnit {
                start: 7,
                end: 16,
                token_type: TokenType::CellReference
            },
            TokenUnit {
                start: 17,
                end: 21,
                token_type: TokenType::WrongSuffix
            }
        ]
    )
}
