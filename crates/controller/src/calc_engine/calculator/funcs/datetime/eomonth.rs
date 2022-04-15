use controller_base::datetime::{get_date_by_serial_num_1900, get_serial_num_by_date_1900};
use parser::ast;

use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(date_num, first);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(delta_months, second);
    let delta_months = delta_months.floor() as i32;
    let mut date = get_date_by_serial_num_1900(date_num.floor() as u32);
    date.add_delta_months(delta_months);
    let year = date.year;
    let month = date.month;
    let day = match date.month {
        1 => 31,
        2 => {
            if (year % 100 == 0 && year % 400 == 0) || year % 4 == 0 {
                29
            } else {
                28
            }
        }
        3 => 31,
        4 => 30,
        5 => 31,
        6 => 30,
        7 => 31,
        8 => 31,
        9 => 30,
        10 => 31,
        11 => 30,
        12 => 30,
        _ => 30,
    };
    let res = get_serial_num_by_date_1900(year, month, day);
    if let Some(r) = res {
        CalcVertex::from_number(r as f64)
    } else {
        CalcVertex::from_error(ast::Error::Num)
    }
}
