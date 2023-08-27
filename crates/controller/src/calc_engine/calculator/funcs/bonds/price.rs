use crate::calc_engine::calculator::math::bond::price;
use crate::calc_engine::calculator::math::day_count::{
    Actual360, Actual365, ActualActual, Europe30_360, UsPsa30_360,
};
use logisheets_parser::ast;

use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 6 && args.len() <= 7, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();

    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(settlement, first);
    assert_or_return!(settlement > 0., ast::Error::Value);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(maturity, second);
    assert_or_return!(maturity > 0., ast::Error::Value);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(rate, third);
    assert_or_return!(rate >= 0., ast::Error::Num);

    let fourth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(yld, fourth);
    assert_or_return!(yld >= 0., ast::Error::Num);

    let fifth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(redemption, fifth);
    assert_or_return!(redemption > 0., ast::Error::Num);

    let sixth = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(freq, sixth);
    assert_or_return!(freq == 1. || freq == 2. || freq == 4., ast::Error::Num);

    assert_or_return!(maturity > settlement, ast::Error::Num);

    let settle = settlement.floor() as u32;
    let maturity = maturity.floor() as u32;
    let freq = freq.floor() as u8;

    let result = if let Some(arg) = args_iter.next() {
        assert_f64_from_calc_value!(b, fetcher.get_calc_value(arg));
        assert_or_return!(b >= 0. && b <= 4., ast::Error::Num);
        match b.floor() as u8 {
            0 => price::<UsPsa30_360>(settle, maturity, rate, yld, redemption, freq),
            1 => price::<ActualActual>(settle, maturity, rate, yld, redemption, freq),
            2 => price::<Actual360>(settle, maturity, rate, yld, redemption, freq),
            3 => price::<Actual365>(settle, maturity, rate, yld, redemption, freq),
            4 => price::<Europe30_360>(settle, maturity, rate, yld, redemption, freq),
            _ => unreachable!(),
        }
    } else {
        price::<UsPsa30_360>(settle, maturity, rate, yld, redemption, freq)
    };
    CalcVertex::from_number(result)
}
