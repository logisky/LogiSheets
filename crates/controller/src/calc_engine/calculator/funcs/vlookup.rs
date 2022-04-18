use super::CalcVertex;
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

#[allow(dead_code)]
pub fn calc<C>(args: Vec<CalcVertex>, _fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    if args.len() != 3 && args.len() != 4 {
        return CalcVertex::from_error(ast::Error::Unspecified);
    }
    let mut args_iter = args.into_iter();
    let _lookup_value = args_iter.next().unwrap();
    let _table_array = args_iter.next().unwrap();
    let _col_index_num = args_iter.next().unwrap();
    let _range_look_up = args_iter.next();
    todo!()
}
