use super::super::utils::{get_condition_result, ConditionResult};
use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;
use statrs::distribution::{Continuous, ContinuousCDF, FisherSnedecor};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 4, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(x, first);
    assert_or_return!(x >= 0., ast::Error::Num);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(freedom1, second);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(freedom2, third);
    assert_or_return!(freedom2 > 1. && freedom1 > 1., ast::Error::Num);

    let fourth = fetcher.get_calc_value(args_iter.next().unwrap());
    let v = get_condition_result(fourth);

    let freedom1 = freedom1.trunc();
    let freedom2 = freedom2.trunc();
    match v {
        ConditionResult::True => {
            let n = FisherSnedecor::new(freedom1, freedom2).unwrap();
            let r = n.cdf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::False => {
            let n = FisherSnedecor::new(freedom1, freedom2).unwrap();
            let r = n.pdf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::Error(e) => CalcVertex::from_error(e),
    }
}
