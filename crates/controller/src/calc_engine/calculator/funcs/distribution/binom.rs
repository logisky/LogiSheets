use super::super::utils::{get_condition_result, ConditionResult};
use super::super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;
use statrs::distribution::{Binomial, Discrete, DiscreteCDF};

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 4, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();

    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(success, first);
    assert_or_return!(success >= 0., ast::Error::Num);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(trials, second);
    assert_or_return!(trials >= success, ast::Error::Num);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(probability, third);
    assert_or_return!(probability >= 0. && probability <= 1., ast::Error::Num);

    let fourth = fetcher.get_calc_value(args_iter.next().unwrap());
    let v = get_condition_result(fourth);

    let x = success.trunc() as u64;
    let trials = trials.trunc() as u64;
    match v {
        ConditionResult::True => {
            let n = Binomial::new(probability, trials).unwrap();
            let r = n.cdf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::False => {
            let n = Binomial::new(probability, trials).unwrap();
            let r = n.pmf(x);
            CalcVertex::from_number(r)
        }
        ConditionResult::Error(e) => CalcVertex::from_error(e),
    }
}

pub fn calc_inv<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 3, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();

    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(trials, first);
    assert_or_return!(trials >= 0., ast::Error::Num);

    let second = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(probability, second);
    assert_or_return!(probability >= 0. && probability <= 1., ast::Error::Num);

    let third = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_f64_from_calc_value!(alpha, third);
    assert_or_return!(alpha > 0. && alpha < 1., ast::Error::Num);

    let trials = trials as u64;

    let n = Binomial::new(probability, trials).unwrap();
    let result = n.inverse_cdf(alpha);
    CalcVertex::from_number(result as f64)
}
