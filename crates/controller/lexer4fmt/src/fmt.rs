use crate::*;
use gents_derives::TS;
use pest::iterators::Pair;

#[derive(Debug, TS, Clone, Eq, PartialEq)]
#[ts(rename_all = "camelCase", file_name = "formula_display_info.ts")]
pub struct FormulaDisplayInfo {
    /// Every cell reference, in source order, for colouring the referenced
    /// ranges on the grid.
    pub cell_refs: Vec<CellRef>,
    /// Leaf tokens in source order, for syntax highlighting.
    pub token_units: Vec<TokenUnit>,
}

#[derive(Debug, TS, Clone, Eq, PartialEq, Default)]
/// A reference as written in the formula. Rows and columns are 0-based; a
/// missing component (a whole-column `A:A` has no rows) is `None`. `sheet2` is
/// the end of a 3-D `Sheet1:Sheet3!` span. Names are kept as written.
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
/// A token's span in the input. `start`/`end` are BYTE offsets (end
/// exclusive), not character offsets: a host indexing a UTF-16 string must
/// convert them when the formula contains non-ASCII text.
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

/// Tokenize a formula body (no leading `=`) for display. Unlike the strict
/// `logisheets_lexer`, a trailing unparseable tail is accepted and reported as
/// a `WrongSuffix` token, so a half-typed formula still highlights. `None`
/// only when not even a prefix lexes.
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
        // Both spans keep an absolute reference's `$` (`$4`, `$B`): the
        // grammar's absolute rules are silent. A component that doesn't
        // convert (row 0, an absurd column) is left out rather than panicking
        // — this runs on every keystroke of a half-typed formula.
        Rule::a1_row => {
            let Some(row) = row_label_to_index(pair.as_str()) else {
                return;
            };
            if cell_ref.row1.is_none() {
                cell_ref.row1 = Some(row);
            } else {
                cell_ref.row2 = Some(row);
            }
        }
        Rule::a1_column => {
            let Some(col) = column_label_to_index(pair.as_str()) else {
                return;
            };
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

/// `"4"` / `"$4"` → 3 (0-based). `None` for row 0 or overflow.
fn row_label_to_index(label: &str) -> Option<usize> {
    label
        .trim_start_matches('$')
        .parse::<usize>()
        .ok()?
        .checked_sub(1)
}

/// `"B"` / `"$B"` → 1 (0-based). `None` for anything but letters, or overflow.
fn column_label_to_index(label: &str) -> Option<usize> {
    let mut result: usize = 0;
    for c in label.trim_start_matches('$').chars() {
        let u = c.to_ascii_uppercase();
        if !u.is_ascii_uppercase() {
            return None;
        }
        result = result
            .checked_mul(26)?
            .checked_add(u as usize - 'A' as usize + 1)?;
    }
    result.checked_sub(1)
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
fn test_lex_and_fmt_lower_case() {
    let s = "a1";
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

/// `$` (absolute) references used to underflow in the column conversion and
/// panic on `"$4".parse()` in the row one, so `$B$4` got no tokens at all: no
/// highlight, and nothing for F4 to cycle on the next press.
#[test]
fn test_lex_and_fmt_absolute_refs() {
    let cases: [(
        &str,
        usize,
        Option<usize>,
        Option<usize>,
        Option<usize>,
        Option<usize>,
    ); 6] = [
        ("$B$4", 4, Some(3), Some(1), None, None),
        ("B$4", 3, Some(3), Some(1), None, None),
        ("$B4", 3, Some(3), Some(1), None, None),
        ("$AA$10", 6, Some(9), Some(26), None, None),
        ("$B$4:$C5", 8, Some(3), Some(1), Some(4), Some(2)),
        ("Sheet1!$B$4", 11, Some(3), Some(1), None, None),
    ];
    for (s, len, row1, col1, row2, col2) in cases {
        let result = lex_and_fmt(s).unwrap();
        assert_eq!(
            result.token_units,
            vec![TokenUnit {
                start: 0,
                end: len,
                token_type: TokenType::CellReference
            }],
            "{s}"
        );
        let r = &result.cell_refs[0];
        assert_eq!(
            (r.row1, r.col1, r.row2, r.col2),
            (row1, col1, row2, col2),
            "{s}"
        );
    }
}

/// Inside a larger formula, after a function and an operator.
#[test]
fn test_lex_and_fmt_absolute_ref_in_formula() {
    let result = lex_and_fmt("SUM(A1)+$B$4").unwrap();
    let refs: Vec<_> = result
        .token_units
        .iter()
        .filter(|t| t.token_type == TokenType::CellReference)
        .map(|t| (t.start, t.end))
        .collect();
    assert_eq!(refs, vec![(4, 6), (8, 12)]);
}

/// Row 0 is not a row: the reference still tokenizes, without a row index.
#[test]
fn test_lex_and_fmt_row_zero_does_not_panic() {
    let result = lex_and_fmt("A0").unwrap();
    assert_eq!(result.cell_refs[0].row1, None);
}
