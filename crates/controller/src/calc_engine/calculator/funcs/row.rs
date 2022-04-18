use crate::calc_engine::calculator::calc_vertex::Reference;
use crate::calc_engine::connector::Connector;

use super::CalcVertex;

use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() > 1 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    match args.into_iter().next() {
        Some(value) => match value {
            CalcVertex::Value(_) => CalcVertex::from_error(ast::Error::Unspecified),
            CalcVertex::Reference(reference) => match reference.reference {
                Reference::Addr(a) => CalcVertex::from_number(a.row as f64),
                Reference::ColumnRange(_) => todo!(),
                Reference::RowRange(_) => todo!(),
                Reference::Range(_) => todo!(),
            },
            CalcVertex::Union(_) => todo!(),
        },
        None => CalcVertex::from_number(fetcher.get_curr_addr().row as f64 + 1_f64),
    }
}
