use crate::*;
use gents_derives::TS;
use pest::iterators::Pair;

#[derive(Debug, TS, Clone, Eq, PartialEq)]
#[ts(rename_all = "camelCase", file_name = "formula_display_info.ts")]
pub struct FormulaDisplayInfo {
    pub cell_refs: Vec<CellRef>,
    pub token_units: Vec<TokenUnit>,
}

#[derive(Debug, TS, Clone, Eq, PartialEq, Default)]
#[ts(rename_all = "camelCase", file_name = "cell_ref.ts")]
pub struct CellRef {
    pub workbook: Option<String>,
    pub sheet1: Option<String>,
    pub sheet2: Option<String>,
    pub row1: Option<usize>,
    pub col1: Option<usize>,
    pub row2: Option<usize>,
    pub col2: Option<usize>,
}

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
    FuncArg,
    CellReference,
    ErrorConstant,
    WrongSuffix,
    Other,
}

pub fn lex_and_fmt(s: &str) -> Option<FormulaDisplayInfo> {
    let pairs = lex(s)?;
    let mut result = FormulaDisplayInfo {
        cell_refs: Vec::new(),
        token_units: Vec::new(),
    };
    convert_rule_to_units(pairs, &mut result);
    Some(result)
}

fn convert_rule_to_units(pair: Pair<Rule>, result: &mut FormulaDisplayInfo) {
    match pair.as_rule() {
        Rule::function_name => {
            let ty = TokenType::FuncName;
            let s = pair.as_span();

            result.token_units.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
        }
        Rule::cell_reference => {
            let ty = TokenType::CellReference;
            let s = pair.as_span();
            result.token_units.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });

            let mut cell_ref = CellRef::default();
            convert_cell_reference(pair, &mut cell_ref);
            result.cell_refs.push(cell_ref);
        }
        Rule::error_constant => {
            let ty = TokenType::ErrorConstant;
            let s = pair.as_span();
            result.token_units.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
        }
        Rule::wrong_suffix => {
            let ty = TokenType::WrongSuffix;
            let s = pair.as_span();
            result.token_units.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
        }
        Rule::argument | Rule::empty_arg => {
            let ty = TokenType::FuncArg;
            let s = pair.as_span();
            result.token_units.push(TokenUnit {
                start: s.start(),
                end: s.end(),
                token_type: ty,
            });
            pair.into_inner().for_each(|p| {
                convert_rule_to_units(p, result);
            });
        }
        _ => {
            let inner = pair.clone().into_inner();
            if inner.peek().is_none() {
                let ty = TokenType::Other;
                let s = pair.as_span();
                result.token_units.push(TokenUnit {
                    start: s.start(),
                    end: s.end(),
                    token_type: ty,
                });
            } else {
                for inner_pair in inner {
                    convert_rule_to_units(inner_pair, result);
                }
            }
        }
    }
}

fn convert_cell_reference(pair: Pair<Rule>, cell_ref: &mut CellRef) {
    match pair.as_rule() {
        Rule::workbook_name | Rule::workbook_name_special => {
            let s = pair.as_str().to_string();
            if cell_ref.workbook.is_none() {
                cell_ref.workbook = Some(s);
            }
        }
        Rule::sheet_name | Rule::sheet_name_special => {
            let s = pair.as_str().to_string();
            if cell_ref.sheet1.is_none() {
                cell_ref.sheet1 = Some(s);
            } else {
                cell_ref.sheet2 = Some(s);
            }
        }
        Rule::a1_row => {
            let s = pair.as_str().to_string();
            let row = s.parse::<usize>().unwrap();
            if cell_ref.row1.is_none() {
                cell_ref.row1 = Some(row - 1);
            } else {
                cell_ref.row2 = Some(row - 1);
            }
        }
        Rule::a1_column => {
            let s = pair.as_str().to_string();
            let col = column_label_to_index(&s);
            if cell_ref.col1.is_none() {
                cell_ref.col1 = Some(col);
            } else {
                cell_ref.col2 = Some(col);
            }
        }
        _ => {
            for p in pair.into_inner() {
                convert_cell_reference(p, cell_ref);
            }
        }
    }
}

fn column_label_to_index(label: &str) -> usize {
    let mut result: usize = 0;
    for (i, c) in label.chars().rev().enumerate() {
        result += (c as usize - 64) * 26_usize.pow(i as u32);
    }
    result - 1
}

#[test]
fn test_lex_wrong_formula() {
    let s = "SUM(A1+Sheet2!A2";
    let result = lex_and_fmt(s);
    assert!(result.is_some());
    let s = "SUM(";
    let result = lex_and_fmt(s);
    assert_eq!(
        result.unwrap(),
        FormulaDisplayInfo {
            cell_refs: Vec::new(),
            token_units: vec![TokenUnit {
                start: 0,
                end: 3,
                token_type: TokenType::FuncName
            }]
        }
    );
    let s = "SUM";
    let result = lex_and_fmt(s);
    assert_eq!(
        result.unwrap(),
        FormulaDisplayInfo {
            cell_refs: Vec::new(),
            token_units: vec![TokenUnit {
                start: 0,
                end: 3,
                token_type: TokenType::FuncName
            }]
        }
    );
}

#[test]
fn test_lex_and_fmt() {
    let s = "A1";
    let result = lex_and_fmt(s).unwrap();
    assert_eq!(
        result,
        FormulaDisplayInfo {
            cell_refs: vec![CellRef {
                workbook: None,
                sheet1: None,
                sheet2: None,
                row1: Some(0),
                col1: Some(0),
                row2: None,
                col2: None,
            }],
            token_units: vec![TokenUnit {
                start: 0,
                end: 2,
                token_type: TokenType::CellReference
            }]
        }
    )
}

#[test]
fn test_wrong_suffix() {
    let s = "(Sheet2!A2+SUM";
    let result = lex_and_fmt(s);
    assert!(result.is_some());
}

#[test]
fn test_lex_and_fmt_error() {
    let s = "SUM(A1+Sheet2!A2)";
    let result = lex_and_fmt(s).unwrap();
    assert_eq!(
        result,
        FormulaDisplayInfo {
            cell_refs: vec![
                CellRef {
                    row1: Some(0),
                    col1: Some(0),
                    row2: None,
                    col2: None,
                    sheet1: None,
                    sheet2: None,
                    workbook: None,
                },
                CellRef {
                    row1: Some(1),
                    col1: Some(0),
                    row2: None,
                    col2: None,
                    sheet1: Some("Sheet2".to_string()),
                    sheet2: None,
                    workbook: None,
                }
            ],
            token_units: vec![
                TokenUnit {
                    start: 0,
                    end: 3,
                    token_type: TokenType::FuncName
                },
                TokenUnit {
                    start: 4,
                    end: 16,
                    token_type: TokenType::FuncArg
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
        }
    )
}

#[test]
fn test_lex_and_fmt_wrong() {
    let s = "SUM(A1+Sheet2!A2)!111";
    let result = lex_and_fmt(s).unwrap();
    assert_eq!(
        result,
        FormulaDisplayInfo {
            cell_refs: vec![
                CellRef {
                    workbook: None,
                    sheet1: None,
                    sheet2: None,
                    row1: Some(0),
                    col1: Some(0),
                    row2: None,
                    col2: None,
                },
                CellRef {
                    workbook: None,
                    sheet1: Some("Sheet2".to_string()),
                    sheet2: None,
                    row1: Some(1),
                    col1: Some(0),
                    row2: None,
                    col2: None,
                }
            ],
            token_units: vec![
                TokenUnit {
                    start: 0,
                    end: 3,
                    token_type: TokenType::FuncName
                },
                TokenUnit {
                    start: 4,
                    end: 16,
                    token_type: TokenType::FuncArg
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
        }
    )
}
