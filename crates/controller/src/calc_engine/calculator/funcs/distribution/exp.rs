use super::super::utils::{get_condition_result, ConditionResult};
use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;
use statrs::distribution::{Continuous, ContinuousCDF, Exp};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(x, first);
    assert_or_return!(x >= 0., ast::Error::Num);
    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(lambda, second);

    assert_or_return!(x >= 0. && lambda > 0., ast::Error::Num);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    let v = get_condition_result(third);
    match v {
        ConditionResult::True => {
            let n = Exp::new(lambda).unwrap();
            let r = n.cdf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::False => {
            let n = Exp::new(lambda).unwrap();
            let r = n.pdf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::Error(e) => CalcVertex::from_error(e),
    }
}
