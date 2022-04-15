use crate::{
    ast::{MutRefWithPrefix, UnMutRefWithPrefix},
    context::ContextTrait,
};

use super::ast;
use controller_base::{column_label_to_index, id_fetcher::IdFetcherTrait, CellId, SheetId};
use lexer::*;
use pest::iterators::Pair;
use regex::Regex;

lazy_static! {
    static ref NUM_REGEX: Regex =
        Regex::new(r#"([0-9]+)?(\.?([0-9]+))?([Ee]([+-]?[0-9]+))?"#).unwrap();
    static ref WORKSHEET_PREIFX_REGEX: Regex =
        Regex::new(r#"'?(\[(.+?)\])?((.+?):)?(.+?)'?!"#).unwrap();
    static ref COLUMN_REGEX: Regex = Regex::new(r#"(\$)?([A-Z]+)"#).unwrap();
    static ref ROW_REGEX: Regex = Regex::new(r#"(\$)?([0-9]+)"#).unwrap();
}

pub fn build_cell_reference<T>(pair: Pair<Rule>, context: &mut T) -> Option<ast::PureNode>
where
    T: ContextTrait,
{
    let mut pairs = pair.into_inner();
    let p = pairs.next().unwrap();
    let curr_sheet = context.get_active_sheet();
    let id_fetcher = context;
    let r = match p.as_rule() {
        Rule::a1_reference_with_prefix => build_a1_reference_with_prefix(p, curr_sheet, id_fetcher),
        Rule::a1_reference_range_with_prefix => {
            build_a1_reference_range_with_prefix(p, curr_sheet, id_fetcher)
        }
        _ => unreachable!(),
    }?;
    Some(ast::PureNode::Reference(r))
}

fn build_a1_reference_range_with_prefix<T>(
    pair: Pair<Rule>,
    curr_sheet: SheetId,
    id_fetcher: &mut T,
) -> Option<ast::CellReference>
where
    T: ContextTrait,
{
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let build_mut_ref = |pair, sheet_id, id_fetcher| {
        let a1_ref = build_mut_a1_reference_range(pair, sheet_id, id_fetcher)?;
        Some(ast::CellReference::Mut(MutRefWithPrefix {
            sheet_id: curr_sheet,
            reference: ast::MutRef::A1ReferenceRange(a1_ref),
        }))
    };
    match first.as_rule() {
        Rule::work_sheet_prefix => {
            let prefix = build_work_sheet_prefix(first);
            let second = iter.next().unwrap();
            match prefix {
                Some(p) => {
                    let unmut_prefix = build_unmut_prefix(&p, id_fetcher);
                    match unmut_prefix {
                        Some(up) => {
                            let unmut = build_unmut_a1_reference_range(second);
                            Some(ast::CellReference::UnMut(UnMutRefWithPrefix {
                                prefix: up,
                                reference: ast::UnMutRef::A1ReferenceRange(unmut),
                            }))
                        }
                        None => {
                            let sheet_id = id_fetcher.fetch_sheet_id(&p.sheet);
                            build_mut_ref(second, sheet_id, id_fetcher)
                        }
                    }
                }
                None => build_mut_ref(second, curr_sheet, id_fetcher),
            }
        }
        Rule::a1_reference_range => build_mut_ref(first, curr_sheet, id_fetcher),
        _ => unreachable!(),
    }
}

fn build_a1_reference_with_prefix<T>(
    pair: Pair<Rule>,
    curr_sheet: SheetId,
    id_fetcher: &mut T,
) -> Option<ast::CellReference>
where
    T: ContextTrait,
{
    let mut p_iter = pair.into_inner();
    let first = p_iter.next().unwrap();
    let build_mut_ref = |pair, sheet_id, id_fetcher| {
        let a1_ref = build_mut_a1_reference(pair, sheet_id, id_fetcher)?;
        Some(ast::CellReference::Mut(MutRefWithPrefix {
            sheet_id,
            reference: ast::MutRef::A1Reference(a1_ref),
        }))
    };
    match first.as_rule() {
        Rule::work_sheet_prefix => {
            let prefix = build_work_sheet_prefix(first);
            let second = p_iter.next().unwrap();
            match prefix {
                Some(p) => {
                    let unmut_prefix = build_unmut_prefix(&p, id_fetcher);
                    match unmut_prefix {
                        Some(up) => {
                            let unmut = build_unmut_a1_reference(second);
                            Some(ast::CellReference::UnMut(UnMutRefWithPrefix {
                                prefix: up,
                                reference: ast::UnMutRef::A1Reference(unmut),
                            }))
                        }
                        None => {
                            let sheet_id = id_fetcher.fetch_sheet_id(&p.sheet);
                            build_mut_ref(second, sheet_id, id_fetcher)
                        }
                    }
                }
                None => build_mut_ref(second, curr_sheet, id_fetcher),
            }
        }
        Rule::a1_reference => build_mut_ref(first, curr_sheet, id_fetcher),
        _ => unreachable!(),
    }
}

fn build_unmut_prefix<T>(
    prefix: &ReferencePrefix,
    id_fetcher: &mut T,
) -> Option<ast::UnMutRefPrefix>
where
    T: ContextTrait,
{
    match (&prefix.workbook, &prefix.from_sheet) {
        (None, None) => None,
        (None, Some(from_sheet)) => {
            let from_id = id_fetcher.fetch_sheet_id(&from_sheet);
            let to_id = id_fetcher.fetch_sheet_id(&prefix.sheet);
            Some(ast::UnMutRefPrefix::Local(
                ast::LocalUnMutRefPrefix::SheetToSheet(ast::LocalSheetToSheet {
                    from_sheet: from_id,
                    to_sheet: to_id,
                }),
            ))
        }
        (Some(workbook), None) => {
            if id_fetcher.get_book_name() == workbook {
                None
            } else {
                let ext_book_id = id_fetcher.fetch_ext_book_id(workbook);
                Some(ast::UnMutRefPrefix::External(
                    ast::ExternalUnMutRefPrefix::Sheet(ast::ExternalSheet {
                        sheet: id_fetcher.fetch_sheet_id(&prefix.sheet),
                        workbook: ext_book_id,
                    }),
                ))
            }
        }
        (Some(workbook), Some(from_sheet)) => {
            if id_fetcher.get_book_name() == workbook {
                let from_id = id_fetcher.fetch_sheet_id(&from_sheet);
                let to_id = id_fetcher.fetch_sheet_id(&prefix.sheet);
                Some(ast::UnMutRefPrefix::Local(
                    ast::LocalUnMutRefPrefix::SheetToSheet(ast::LocalSheetToSheet {
                        from_sheet: from_id,
                        to_sheet: to_id,
                    }),
                ))
            } else {
                let from_id = id_fetcher.fetch_sheet_id(&from_sheet);
                let to_id = id_fetcher.fetch_sheet_id(&prefix.sheet);
                let ext_book_id = id_fetcher.fetch_ext_book_id(workbook);
                Some(ast::UnMutRefPrefix::External(
                    ast::ExternalUnMutRefPrefix::SheetToSheet(ast::ExternalSheetToSheet {
                        workbook: ext_book_id,
                        from_sheet: from_id,
                        to_sheet: to_id,
                    }),
                ))
            }
        }
    }
}

fn build_unmut_a1_reference_range(pair: Pair<Rule>) -> ast::UnMutA1ReferenceRange {
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let start = build_unmut_a1_reference(first);
    let second = iter.next().unwrap();
    let end = build_unmut_a1_reference(second);
    ast::UnMutA1ReferenceRange { start, end }
}

fn build_mut_a1_reference_range<T>(
    pair: Pair<Rule>,
    sheet_id: SheetId,
    id_fetcher: &mut T,
) -> Option<ast::A1ReferenceRange>
where
    T: ContextTrait,
{
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let start = build_mut_a1_reference(first, sheet_id, id_fetcher)?;
    let second = iter.next().unwrap();
    let end = build_mut_a1_reference(second, sheet_id, id_fetcher)?;
    match (&start, &end) {
        (ast::A1Reference::Addr(s), ast::A1Reference::Addr(e)) => match (&s.cell_id, &e.cell_id) {
            (CellId::NormalCell(_), CellId::NormalCell(_)) => {
                Some(ast::A1ReferenceRange { start, end })
            }
            (CellId::NormalCell(_), CellId::BlockCell(_)) => Some(ast::A1ReferenceRange {
                start: start.clone(),
                end: start,
            }),
            (CellId::BlockCell(_), CellId::NormalCell(_)) => Some(ast::A1ReferenceRange {
                start: end.clone(),
                end,
            }),
            (CellId::BlockCell(b1), CellId::BlockCell(b2)) => {
                if b1.block_id != b2.block_id {
                    Some(ast::A1ReferenceRange {
                        start: start.clone(),
                        end: start,
                    })
                } else {
                    Some(ast::A1ReferenceRange { start, end })
                }
            }
        },
        _ => Some(ast::A1ReferenceRange { start, end }),
    }
}

fn build_mut_a1_reference<T>(
    pair: Pair<Rule>,
    sheet_id: SheetId,
    id_fetcher: &mut T,
) -> Option<ast::A1Reference>
where
    T: IdFetcherTrait,
{
    let first = pair.into_inner().next().unwrap();
    match first.as_rule() {
        Rule::a1_addr => {
            let addr = build_mut_a1_addr(first, sheet_id, id_fetcher)?;
            Some(ast::A1Reference::Addr(addr))
        }
        Rule::a1_column_range => {
            let cr = build_mut_a1_column_range(first, sheet_id, id_fetcher)?;
            Some(ast::A1Reference::A1ColumnRange(cr))
        }
        Rule::a1_row_range => {
            let rr = build_mut_a1_row_range(first, sheet_id, id_fetcher)?;
            Some(ast::A1Reference::A1RowRange(rr))
        }
        _ => unreachable!(),
    }
}

fn build_unmut_a1_reference(pair: Pair<Rule>) -> ast::UnMutA1Reference {
    let first = pair.into_inner().next().unwrap();
    match first.as_rule() {
        Rule::a1_addr => {
            let addr = build_unmut_a1_addr(first);
            ast::UnMutA1Reference::Addr(addr)
        }
        Rule::a1_column_range => {
            let cr = build_unmut_a1_column_range(first);
            ast::UnMutA1Reference::A1ColumnRange(cr)
        }
        Rule::a1_row_range => {
            let rr = build_unmut_a1_row_range(first);
            ast::UnMutA1Reference::A1RowRange(rr)
        }
        _ => unreachable!(),
    }
}

fn build_mut_a1_addr(
    pair: Pair<Rule>,
    sheet_id: SheetId,
    id_fetcher: &mut dyn IdFetcherTrait,
) -> Option<ast::Address> {
    let mut iter = pair.into_inner();
    let column_pair = iter.next().unwrap();
    let row_pair = iter.next().unwrap();
    let (col_abs, col) = build_column(column_pair).unwrap_or((false, 1));
    let (row_abs, row) = build_row(row_pair).unwrap_or((false, 1));
    let cell_id = id_fetcher.fetch_cell_id(sheet_id, row, col)?;
    Some(ast::Address {
        cell_id,
        row_abs,
        col_abs,
    })
}

fn build_unmut_a1_addr(pair: Pair<Rule>) -> ast::UnMutAddress {
    let mut iter = pair.into_inner();
    let column_pair = iter.next().unwrap();
    let row_pair = iter.next().unwrap();
    let (col_abs, col) = build_column(column_pair).unwrap_or((false, 1));
    let (row_abs, row) = build_row(row_pair).unwrap_or((false, 1));
    ast::UnMutAddress {
        row,
        col,
        row_abs,
        col_abs,
    }
}

fn build_unmut_a1_column_range(pair: Pair<Rule>) -> ast::UnMutColRange {
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let (start_abs, start) = build_column(first).unwrap_or((false, 1));
    let second = iter.next().unwrap();
    let (end_abs, end) = build_column(second).unwrap_or((false, 1));
    ast::UnMutColRange {
        start,
        start_abs,
        end_abs,
        end,
    }
}

fn build_unmut_a1_row_range(pair: Pair<Rule>) -> ast::UnMutRowRange {
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let (start_abs, start) = build_row(first).unwrap_or((false, 1));
    let second = iter.next().unwrap();
    let (end_abs, end) = build_row(second).unwrap_or((false, 1));
    ast::UnMutRowRange {
        start_abs,
        start,
        end_abs,
        end,
    }
}

fn build_mut_a1_column_range(
    pair: Pair<Rule>,
    sheet_id: SheetId,
    id_fetcher: &mut dyn IdFetcherTrait,
) -> Option<ast::ColRange> {
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let (start_abs, start) = build_column(first).unwrap_or((false, 1));
    let second = iter.next().unwrap();
    let (end_abs, end) = build_column(second).unwrap_or((false, 1));
    let start_id = id_fetcher.fetch_col_id(sheet_id, start)?;
    let end_id = id_fetcher.fetch_col_id(sheet_id, end)?;
    Some(ast::ColRange {
        start: start_id,
        start_abs,
        end_abs,
        end: end_id,
    })
}

fn build_mut_a1_row_range(
    pair: Pair<Rule>,
    sheet_id: SheetId,
    id_fetcher: &mut dyn IdFetcherTrait,
) -> Option<ast::RowRange> {
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let (start_abs, start) = build_row(first).unwrap_or((false, 1));
    let second = iter.next().unwrap();
    let (end_abs, end) = build_row(second).unwrap_or((false, 1));
    let start_id = id_fetcher.fetch_row_id(sheet_id, start)?;
    let end_id = id_fetcher.fetch_row_id(sheet_id, end)?;
    Some(ast::RowRange {
        start: start_id,
        end: end_id,
        end_abs,
        start_abs,
    })
}

fn build_column(pair: Pair<Rule>) -> Option<(bool, usize)> {
    parse_column(pair.as_str())
}

fn build_row(pair: Pair<Rule>) -> Option<(bool, usize)> {
    parse_row(pair.as_str())
}

fn parse_row(row: &str) -> Option<(bool, usize)> {
    ROW_REGEX.captures_iter(row).next().map_or(None, |c| {
        let abs = c.get(1).is_some();
        let idx = c.get(2).map_or(None, |s| {
            let label = s.as_str();
            let idx = label.parse::<usize>().unwrap_or(0);
            Some(idx - 1)
        })?;
        Some((abs, idx))
    })
}

fn parse_column(col: &str) -> Option<(bool, usize)> {
    COLUMN_REGEX.captures_iter(col).next().map_or(None, |c| {
        let abs = c.get(1).is_some();
        let idx = c.get(2).map_or(None, |s| {
            let label = s.as_str();
            let i = column_label_to_index(label);
            Some(i)
        })?;
        Some((abs, idx))
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReferencePrefix {
    pub sheet: String,
    pub from_sheet: Option<String>,
    pub workbook: Option<String>,
}

fn build_work_sheet_prefix(pair: Pair<Rule>) -> Option<ReferencePrefix> {
    WORKSHEET_PREIFX_REGEX
        .captures_iter(pair.as_str())
        .next()
        .map_or(None, |c| {
            let sheet = c.get(5).map_or(None, |m| {
                let name = m.as_str();
                Some(name.to_string())
            })?;
            let workbook = c.get(2).map_or(None, |m| {
                let name = m.as_str();
                Some(name.to_string())
            });
            let from_sheet = c.get(4).map_or(None, |m| {
                let name = m.as_str();
                Some(name.to_string())
            });
            Some(ReferencePrefix {
                sheet,
                workbook,
                from_sheet,
            })
        })
}

#[cfg(test)]
mod tests {
    use super::parse_column;
    #[test]
    fn parse_column_test() {
        let col = "B";
        let result = parse_column(col);
        assert!(matches!(result, Some((false, 1))));
        let col = "$AB";
        let result = parse_column(col);
        assert!(matches!(result, Some((true, 27))));
    }
}
