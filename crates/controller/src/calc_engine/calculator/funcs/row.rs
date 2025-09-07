use crate::calc_engine::calculator::calc_vertex::Reference;
use crate::calc_engine::connector::Connector;

use super::CalcVertex;

use logisheets_parser::ast;

pub fn calc_row<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() <= 1, ast::Error::Unspecified);
    match args.into_iter().next() {
        Some(value) => match value {
            CalcVertex::Value(_) => CalcVertex::from_error(ast::Error::Unspecified),
            CalcVertex::Reference(reference) => match reference.reference {
                Reference::Addr(a) => CalcVertex::from_number(a.row as f64 + 1.),
                Reference::ColumnRange(_) => CalcVertex::from_number(1.),
                Reference::RowRange(rr) => CalcVertex::from_number(rr.start as f64 + 1.),
                Reference::Range(s, _) => CalcVertex::from_number(s.row as f64 + 1.),
            },
            CalcVertex::Union(_) => CalcVertex::from_error(ast::Error::Unspecified),
            CalcVertex::Ephemeral(_) => CalcVertex::from_error(ast::Error::Unspecified),
        },
        None => CalcVertex::from_number(fetcher.get_curr_addr().row as f64 + 1_f64),
    }
}

pub fn calc_rows<C>(args: Vec<CalcVertex>, _: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let arg = args.into_iter().next().unwrap();
    match arg {
        CalcVertex::Value(_) => CalcVertex::from_number(1.),
        CalcVertex::Reference(reference) => match reference.reference {
            Reference::Addr(_) => CalcVertex::from_number(1.),
            Reference::ColumnRange(_) => CalcVertex::from_number(1048576.),
            Reference::RowRange(rr) => CalcVertex::from_number((rr.end - rr.start + 1) as f64),
            Reference::Range(s, e) => CalcVertex::from_number((e.row - s.row + 1) as f64),
        },
        CalcVertex::Union(_) => CalcVertex::from_error(ast::Error::Unspecified),
        CalcVertex::Ephemeral(_) => CalcVertex::from_error(ast::Error::Unspecified),
    }
}

pub fn calc_column<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() <= 1, ast::Error::Unspecified);
    match args.into_iter().next() {
        Some(value) => match value {
            CalcVertex::Value(_) => CalcVertex::from_error(ast::Error::Unspecified),
            CalcVertex::Reference(reference) => match reference.reference {
                Reference::Addr(a) => CalcVertex::from_number(a.col as f64 + 1.),
                Reference::ColumnRange(cr) => CalcVertex::from_number(cr.start as f64 + 1.),
                Reference::RowRange(_) => CalcVertex::from_number(1.),
                Reference::Range(s, _) => CalcVertex::from_number(s.col as f64 + 1.),
            },
            CalcVertex::Union(_) => CalcVertex::from_error(ast::Error::Unspecified),
            CalcVertex::Ephemeral(_) => CalcVertex::from_error(ast::Error::Unspecified),
        },
        None => CalcVertex::from_number(fetcher.get_curr_addr().col as f64 + 1_f64),
    }
}

pub fn calc_columns<C>(args: Vec<CalcVertex>, _: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1, ast::Error::Unspecified);
    let arg = args.into_iter().next().unwrap();
    match arg {
        CalcVertex::Value(_) => CalcVertex::from_number(1.),
        CalcVertex::Reference(reference) => match reference.reference {
            Reference::Addr(_) => CalcVertex::from_number(1.),
            Reference::ColumnRange(cr) => CalcVertex::from_number((cr.end - cr.start + 1) as f64),
            Reference::RowRange(_) => CalcVertex::from_number(16384.),
            Reference::Range(s, e) => CalcVertex::from_number((e.col - s.col + 1) as f64),
        },
        CalcVertex::Union(_) => CalcVertex::from_error(ast::Error::Unspecified),
        CalcVertex::Ephemeral(_) => CalcVertex::from_error(ast::Error::Unspecified),
    }
}
