use chrono::prelude::*;
use logisheets_base::datetime::{get_decimal_num_by_time, get_serial_num_by_date_1900};
use logisheets_parser::ast;

use crate::calc_engine::connector::Connector;

use super::super::CalcVertex;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 0, ast::Error::Unspecified);

    let _ = fetcher.set_curr_as_dirty();

    let datetime = Local::now();
    let date = datetime.date_naive();
    let year = date.year();
    let month = date.month();
    let day = date.day();
    let time = datetime.time();
    let hour = time.hour();
    let minute = time.minute();
    let second = time.second();
    let d = get_serial_num_by_date_1900(year as u32, month, day);
    let t = get_decimal_num_by_time(hour, minute, second);
    match (d, t) {
        (Some(d), Some(t)) => {
            let res = d as f64 + t;
            CalcVertex::from_number(res)
        }
        _ => CalcVertex::from_error(ast::Error::Num),
    }
}
