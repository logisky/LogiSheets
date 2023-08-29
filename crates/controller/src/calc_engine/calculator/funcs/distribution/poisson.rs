use super::super::utils::{get_condition_result, ConditionResult};
use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;
use statrs::distribution::{Discrete, DiscreteCDF, Poisson};

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
    assert_f64_from_calc_value!(mean, second);
    assert_or_return!(mean > 0., ast::Error::Num);
    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    let v = get_condition_result(third);

    let x = x.trunc() as u64;
    match v {
        ConditionResult::True => {
            let n = Poisson::new(mean).unwrap();
            let r = n.cdf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::False => {
            let n = Poisson::new(mean).unwrap();
            let r = n.pmf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::Error(e) => CalcVertex::from_error(e),
    }
}
