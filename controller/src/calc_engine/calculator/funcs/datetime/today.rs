use chrono::prelude::*;
use controller_base::datetime::get_serial_num_by_date_1900;
use parser::ast;

use super::super::CalcVertex;

pub fn calc(args: Vec<CalcVertex>) -> CalcVertex {
    assert_or_return!(args.len() == 0, ast::Error::Unspecified);
    let datetime = Local::now();
    let date = datetime.date();
    let year = date.year();
    let month = date.month();
    let day = date.day();
    let d = get_serial_num_by_date_1900(year as u32, month, day);
    match d {
        Some(n) => CalcVertex::from_number(n as f64),
        None => CalcVertex::from_error(ast::Error::Num),
    }
}
