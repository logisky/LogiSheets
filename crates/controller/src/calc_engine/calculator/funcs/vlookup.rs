use super::CalcVertex;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 3 && args.len() != 4 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut args_iter = args.into_iter();
    let lookup_value = args_iter.next().unwrap();
    let table_array = args_iter.next().unwrap();
    let col_index_num = args_iter.next().unwrap();
    let range_look_up = args_iter.next();
    todo!()
}
