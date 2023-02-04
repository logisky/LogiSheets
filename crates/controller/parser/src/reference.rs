use crate::{
    ast::{CubeDisplay, ExtRefDisplay, RangeDisplay},
    context::ContextTrait,
    errors::ParseError,
};
use anyhow::Result;

use super::ast;
use logisheets_base::{
    column_label_to_index, id_fetcher::IdFetcherTrait, Addr, BlockRange, CellId, Cube, CubeCross,
    ExtRef, NormalRange, Range, RefAbs, SheetId,
};
use logisheets_lexer::*;
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

pub fn build_cell_reference<T>(pair: Pair<Rule>, context: &mut T) -> Result<ast::PureNode>
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
    Ok(ast::PureNode::Reference(r))
}

fn build_a1_reference_range_with_prefix<T>(
    pair: Pair<Rule>,
    curr_sheet: SheetId,
    id_fetcher: &mut T,
) -> Result<ast::CellReference>
where
    T: ContextTrait,
{
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let build_mut_ref_range =
        |pair: Pair<Rule>, sheet_id: SheetId, id_fetcher: &mut T| -> Result<ast::CellReference> {
            let a1_ref = build_mut_a1_reference_range(pair, sheet_id, id_fetcher)?;
            let start = a1_ref.start;
            let end = a1_ref.end;
            let ref_abs =
                RefAbs::from_addr_range(start.row_abs, end.row_abs, start.col_abs, end.col_abs);
            match (start.cell_id, end.cell_id) {
                (CellId::NormalCell(s), CellId::NormalCell(e)) => {
                    let range = Range::Normal(NormalRange::AddrRange(s, e));
                    let range_id = id_fetcher.fetch_range_id(&curr_sheet, &range);
                    Ok(ast::CellReference::Mut(RangeDisplay {
                        range_id,
                        ref_abs,
                        sheet_id,
                    }))
                }
                (CellId::BlockCell(s), CellId::BlockCell(e)) => {
                    if s.block_id != e.block_id {
                        panic!("")
                    }

                    let range = Range::Block(BlockRange::AddrRange(s, e));
                    let range_id = id_fetcher.fetch_range_id(&curr_sheet, &range);
                    Ok(ast::CellReference::Mut(RangeDisplay {
                        range_id,
                        ref_abs,
                        sheet_id,
                    }))
                }
                _ => panic!(),
            }
        };
    match first.as_rule() {
        Rule::work_sheet_prefix => {
            let prefix = build_work_sheet_prefix(first);
            let second = iter.next().unwrap();
            match prefix {
                Some(p) => {
                    let unmut_prefix = build_unmut_prefix(&p, id_fetcher);
                    match unmut_prefix {
                        Some(prefix) => {
                            let unmut = build_unmut_a1_reference_range(second);
                            let ref_abs = RefAbs::from_addr_range(
                                unmut.start.row_abs,
                                unmut.end.row_abs,
                                unmut.start.col_abs,
                                unmut.end.col_abs,
                            );
                            let cross = CubeCross::AddrRange(
                                Addr {
                                    row: unmut.start.row,
                                    col: unmut.start.col,
                                },
                                Addr {
                                    row: unmut.end.row,
                                    col: unmut.end.col,
                                },
                            );
                            match prefix {
                                ast::UnMutRefPrefix::Local(sts) => {
                                    let cube = Cube {
                                        from_sheet: sts.from_sheet,
                                        to_sheet: sts.to_sheet,
                                        cross,
                                    };
                                    let cube_id = id_fetcher.fetch_cube_id(&cube);
                                    Ok(ast::CellReference::UnMut(CubeDisplay { cube_id, ref_abs }))
                                }
                                ast::UnMutRefPrefix::External(ext_prefix) => {
                                    let ext_ref = ExtRef {
                                        ext_book: ext_prefix.workbook,
                                        from_sheet: ext_prefix.from_sheet,
                                        to_sheet: ext_prefix.to_sheet,
                                        cross,
                                    };
                                    let ext_ref_id = id_fetcher.fetch_ext_ref_id(&ext_ref);
                                    Ok(ast::CellReference::Ext(ExtRefDisplay {
                                        ext_ref_id,
                                        ref_abs,
                                    }))
                                }
                            }
                        }
                        None => {
                            let sheet_id = id_fetcher.fetch_sheet_id(&p.sheet);
                            build_mut_ref_range(second, sheet_id, id_fetcher)
                        }
                    }
                }
                None => build_mut_ref_range(second, curr_sheet, id_fetcher),
            }
        }
        Rule::a1_reference_range => build_mut_ref_range(first, curr_sheet, id_fetcher),
        _ => unreachable!(),
    }
}

fn build_a1_reference_with_prefix<T>(
    pair: Pair<Rule>,
    curr_sheet: SheetId,
    id_fetcher: &mut T,
) -> Result<ast::CellReference>
where
    T: ContextTrait,
{
    let mut p_iter = pair.into_inner();
    let first = p_iter.next().unwrap();
    let build_mut_ref = |pair: Pair<Rule>,
                         sheet_id: SheetId,
                         id_fetcher: &mut T|
     -> Result<ast::CellReference> {
        let a1_ref = build_mut_a1_reference(pair, sheet_id, id_fetcher)?;
        let range_display = match a1_ref {
            ast::A1Reference::A1ColumnRange(col_range) => {
                let ref_abs = RefAbs {
                    start_row: false,
                    start_col: col_range.start_abs,
                    end_row: false,
                    end_col: col_range.end_abs,
                };
                let range = Range::Normal(NormalRange::ColRange(col_range.start, col_range.end));
                let range_id = id_fetcher.fetch_range_id(&sheet_id, &range);
                RangeDisplay {
                    range_id,
                    ref_abs,
                    sheet_id,
                }
            }
            ast::A1Reference::A1RowRange(row_range) => {
                let ref_abs = RefAbs {
                    start_row: row_range.start_abs,
                    start_col: false,
                    end_row: row_range.end_abs,
                    end_col: false,
                };
                let range = Range::Normal(NormalRange::RowRange(row_range.start, row_range.end));
                let range_id = id_fetcher.fetch_range_id(&sheet_id, &range);
                RangeDisplay {
                    range_id,
                    ref_abs,
                    sheet_id,
                }
            }
            ast::A1Reference::Addr(addr_range) => {
                let ref_abs = RefAbs {
                    start_row: addr_range.row_abs,
                    start_col: addr_range.col_abs,
                    end_row: false,
                    end_col: false,
                };
                let range = match addr_range.cell_id {
                    CellId::NormalCell(cell_id) => Range::Normal(NormalRange::Single(cell_id)),
                    CellId::BlockCell(block_cell_id) => {
                        Range::Block(BlockRange::Single(block_cell_id))
                    }
                };
                let range_id = id_fetcher.fetch_range_id(&sheet_id, &range);
                RangeDisplay {
                    range_id,
                    ref_abs,
                    sheet_id,
                }
            }
        };
        Ok(ast::CellReference::Mut(range_display))
    };
    match first.as_rule() {
        Rule::work_sheet_prefix => {
            let prefix = build_work_sheet_prefix(first);
            let second = p_iter.next().unwrap();
            match prefix {
                None => build_mut_ref(second, curr_sheet, id_fetcher),
                Some(p) => {
                    let unmut_prefix = build_unmut_prefix(&p, id_fetcher);
                    match unmut_prefix {
                        Some(prefix) => {
                            let unmut = build_unmut_a1_reference(second);
                            match (prefix, unmut) {
                                (
                                    ast::UnMutRefPrefix::Local(sts),
                                    ast::UnMutA1Reference::A1ColumnRange(col_range),
                                ) => {
                                    let cube = Cube {
                                        from_sheet: sts.from_sheet,
                                        to_sheet: sts.to_sheet,
                                        cross: CubeCross::ColRange(col_range.start, col_range.end),
                                    };
                                    let ref_abs = RefAbs::from_col_range(
                                        col_range.start_abs,
                                        col_range.end_abs,
                                    );
                                    let cube_id = id_fetcher.fetch_cube_id(&cube);
                                    Ok(ast::CellReference::UnMut(CubeDisplay { cube_id, ref_abs }))
                                }
                                (
                                    ast::UnMutRefPrefix::Local(sts),
                                    ast::UnMutA1Reference::A1RowRange(row_range),
                                ) => {
                                    let cube = Cube {
                                        from_sheet: sts.from_sheet,
                                        to_sheet: sts.to_sheet,
                                        cross: CubeCross::RowRange(row_range.start, row_range.end),
                                    };
                                    let ref_abs = RefAbs::from_row_range(
                                        row_range.start_abs,
                                        row_range.end_abs,
                                    );
                                    let cube_id = id_fetcher.fetch_cube_id(&cube);
                                    Ok(ast::CellReference::UnMut(CubeDisplay { cube_id, ref_abs }))
                                }
                                (
                                    ast::UnMutRefPrefix::Local(sts),
                                    ast::UnMutA1Reference::Addr(addr),
                                ) => {
                                    let cube = Cube {
                                        from_sheet: sts.from_sheet,
                                        to_sheet: sts.to_sheet,
                                        cross: CubeCross::Single(addr.row, addr.col),
                                    };
                                    let ref_abs = RefAbs::from_addr(addr.row_abs, addr.col_abs);
                                    let cube_id = id_fetcher.fetch_cube_id(&cube);
                                    Ok(ast::CellReference::UnMut(CubeDisplay { cube_id, ref_abs }))
                                }
                                (
                                    ast::UnMutRefPrefix::External(ext_prefix),
                                    ast::UnMutA1Reference::A1ColumnRange(col_range),
                                ) => {
                                    let cross = CubeCross::ColRange(col_range.start, col_range.end);
                                    let ref_abs = RefAbs::from_col_range(
                                        col_range.start_abs,
                                        col_range.end_abs,
                                    );
                                    let ext_ref = ExtRef {
                                        ext_book: ext_prefix.workbook,
                                        from_sheet: ext_prefix.from_sheet,
                                        to_sheet: ext_prefix.to_sheet,
                                        cross,
                                    };
                                    let ext_ref_id = id_fetcher.fetch_ext_ref_id(&ext_ref);
                                    Ok(ast::CellReference::Ext(ExtRefDisplay {
                                        ext_ref_id,
                                        ref_abs,
                                    }))
                                }
                                (
                                    ast::UnMutRefPrefix::External(ext_prefix),
                                    ast::UnMutA1Reference::A1RowRange(row_range),
                                ) => {
                                    let cross = CubeCross::RowRange(row_range.start, row_range.end);
                                    let ref_abs = RefAbs::from_row_range(
                                        row_range.start_abs,
                                        row_range.end_abs,
                                    );
                                    let ext_ref = ExtRef {
                                        ext_book: ext_prefix.workbook,
                                        from_sheet: ext_prefix.from_sheet,
                                        to_sheet: ext_prefix.to_sheet,
                                        cross,
                                    };
                                    let ext_ref_id = id_fetcher.fetch_ext_ref_id(&ext_ref);
                                    Ok(ast::CellReference::Ext(ExtRefDisplay {
                                        ext_ref_id,
                                        ref_abs,
                                    }))
                                }
                                (
                                    ast::UnMutRefPrefix::External(ext_prefix),
                                    ast::UnMutA1Reference::Addr(addr),
                                ) => {
                                    let cross = CubeCross::ColRange(addr.row, addr.col);
                                    let ref_abs = RefAbs::from_addr(addr.row_abs, addr.col_abs);
                                    let ext_ref = ExtRef {
                                        ext_book: ext_prefix.workbook,
                                        from_sheet: ext_prefix.from_sheet,
                                        to_sheet: ext_prefix.to_sheet,
                                        cross,
                                    };
                                    let ext_ref_id = id_fetcher.fetch_ext_ref_id(&ext_ref);
                                    Ok(ast::CellReference::Ext(ExtRefDisplay {
                                        ext_ref_id,
                                        ref_abs,
                                    }))
                                }
                            }
                        }
                        None => {
                            let sheet_id = id_fetcher.fetch_sheet_id(&p.sheet);
                            build_mut_ref(second, sheet_id, id_fetcher)
                        }
                    }
                }
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
            Some(ast::UnMutRefPrefix::Local(ast::LocalSheetToSheet {
                from_sheet: from_id,
                to_sheet: to_id,
            }))
        }
        (Some(workbook), None) => {
            if id_fetcher.get_book_name() == workbook {
                None
            } else {
                let ext_book_id = id_fetcher.fetch_ext_book_id(workbook);
                Some(ast::UnMutRefPrefix::External(ast::ExternalPrefix {
                    workbook: ext_book_id,
                    from_sheet: None,
                    to_sheet: id_fetcher.fetch_sheet_id(&prefix.sheet),
                }))
            }
        }
        (Some(workbook), Some(from_sheet)) => {
            if id_fetcher.get_book_name() == workbook {
                let from_id = id_fetcher.fetch_sheet_id(&from_sheet);
                let to_id = id_fetcher.fetch_sheet_id(&prefix.sheet);
                Some(ast::UnMutRefPrefix::Local(ast::LocalSheetToSheet {
                    from_sheet: from_id,
                    to_sheet: to_id,
                }))
            } else {
                let from_id = id_fetcher.fetch_sheet_id(&from_sheet);
                let to_id = id_fetcher.fetch_sheet_id(&prefix.sheet);
                let ext_book_id = id_fetcher.fetch_ext_book_id(workbook);
                Some(ast::UnMutRefPrefix::External(ast::ExternalPrefix {
                    workbook: ext_book_id,
                    from_sheet: Some(from_id),
                    to_sheet: to_id,
                }))
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
    match (start, end) {
        (ast::UnMutA1Reference::Addr(s), ast::UnMutA1Reference::Addr(e)) => {
            ast::UnMutA1ReferenceRange { start: s, end: e }
        }
        _ => unreachable!(),
    }
}

fn build_mut_a1_reference_range<T>(
    pair: Pair<Rule>,
    sheet_id: SheetId,
    id_fetcher: &mut T,
) -> Result<ast::A1ReferenceRange>
where
    T: ContextTrait,
{
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let start = build_mut_a1_addr(first, sheet_id, id_fetcher)?;
    let second = iter.next().unwrap();
    let end = build_mut_a1_addr(second, sheet_id, id_fetcher)?;
    Ok(ast::A1ReferenceRange { start, end })
}

fn build_mut_a1_reference<T>(
    pair: Pair<Rule>,
    sheet_id: SheetId,
    id_fetcher: &mut T,
) -> Result<ast::A1Reference>
where
    T: IdFetcherTrait,
{
    let first = pair.into_inner().next().unwrap();
    match first.as_rule() {
        Rule::a1_addr => {
            let addr = build_mut_a1_addr(first, sheet_id, id_fetcher)?;
            Ok(ast::A1Reference::Addr(addr))
        }
        Rule::a1_column_range => {
            let cr = build_mut_a1_column_range(first, sheet_id, id_fetcher)?;
            Ok(ast::A1Reference::A1ColumnRange(cr))
        }
        Rule::a1_row_range => {
            let rr = build_mut_a1_row_range(first, sheet_id, id_fetcher)?;
            Ok(ast::A1Reference::A1RowRange(rr))
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
) -> Result<ast::Address> {
    let mut iter = pair.into_inner();
    let column_pair = iter.next().unwrap();
    let row_pair = iter.next().unwrap();
    let (col_abs, col) = build_column(column_pair).unwrap_or((false, 1));
    let (row_abs, row) = build_row(row_pair).unwrap_or((false, 1));
    let cell_id = id_fetcher.fetch_cell_id(&sheet_id, row, col)?;
    Ok(ast::Address {
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
) -> Result<ast::ColRange> {
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let (start_abs, start) = build_column(first).unwrap_or((false, 1));
    let second = iter.next().unwrap();
    let (end_abs, end) = build_column(second).unwrap_or((false, 1));
    let start_id = id_fetcher.fetch_col_id(&sheet_id, start)?;
    let end_id = id_fetcher.fetch_col_id(&sheet_id, end)?;
    Ok(ast::ColRange {
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
) -> Result<ast::RowRange> {
    let mut iter = pair.into_inner();
    let first = iter.next().unwrap();
    let (start_abs, start) = build_row(first).unwrap_or((false, 1));
    let second = iter.next().unwrap();
    let (end_abs, end) = build_row(second).unwrap_or((false, 1));
    let start_id = id_fetcher.fetch_row_id(&sheet_id, start)?;
    let end_id = id_fetcher.fetch_row_id(&sheet_id, end)?;
    Ok(ast::RowRange {
        start: start_id,
        end: end_id,
        end_abs,
        start_abs,
    })
}

fn build_column(pair: Pair<Rule>) -> Result<(bool, usize)> {
    parse_column(pair.as_str())
}

fn build_row(pair: Pair<Rule>) -> Result<(bool, usize)> {
    parse_row(pair.as_str())
}

fn parse_row(row: &str) -> Result<(bool, usize)> {
    let result = ROW_REGEX.captures_iter(row).next().map_or(
        Err(ParseError::ParseRowFailed(row.to_string())),
        |c| {
            let abs = c.get(1).is_some();
            let label = c
                .get(2)
                .ok_or(ParseError::ParseRowFailed(row.to_string()))?
                .as_str();
            let idx = label
                .parse::<usize>()
                .or(Err(ParseError::ParseRowFailed(row.to_string())))?
                - 1;
            Ok((abs, idx))
        },
    )?;
    Ok(result)
}

fn parse_column(col: &str) -> Result<(bool, usize)> {
    let result = COLUMN_REGEX.captures_iter(col).next().map_or(
        Err(ParseError::ParseColFailed(col.to_string())),
        |c| {
            let abs = c.get(1).is_some();
            let label = c
                .get(2)
                .ok_or(ParseError::ParseColFailed(col.to_string()))?
                .as_str();
            let i = column_label_to_index(label);
            Ok((abs, i))
        },
    )?;
    Ok(result)
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
        assert!(matches!(result, Ok((false, 1))));
        let col = "$AB";
        let result = parse_column(col);
        assert!(matches!(result, Ok((true, 27))));
    }
}
