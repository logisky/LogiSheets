use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};
use logisheets_parser::ast;
use std::collections::BTreeMap;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let mut bmap = BTreeMap::new();
    for arg in args.into_iter() {
        let value = fetcher.get_calc_value(arg);
        if let Err(e) = count_an_arg(value, &mut bmap) {
            return CalcVertex::from_error(e);
        }
    }
    let mut max = 0;
    let mut position = 0;
    let mut result = String::from("");

    bmap.into_iter().for_each(|(k, (cnt, p))| {
        if cnt > max {
            result = k;
            max = cnt;
            position = p;
        } else if cnt == max && position > p {
            position = p;
            result = k;
        }
    });

    let num = result.parse::<f64>().unwrap();
    CalcVertex::from_number(num)
}

fn count_an_arg(
    value: CalcValue,
    bmap: &mut BTreeMap<String, (u32, usize)>,
) -> Result<(), ast::Error> {
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Number(num) => {
                let s = num.to_string();
                let l = bmap.len();
                let mut insert = bmap.entry(s).or_insert((0, l));
                insert.0 += 1;
                Ok(())
            }
            Value::Error(e) => Err(e),
            _ => Err(ast::Error::Value),
        },
        CalcValue::Range(r) => {
            r.into_iter().for_each(|v| match v {
                Value::Number(num) => {
                    let s = num.to_string();
                    let l = bmap.len();
                    let mut insert = bmap.entry(s).or_insert((0, l));
                    insert.0 += 1;
                }
                _ => {}
            });
            Ok(())
        }
        CalcValue::Cube(c) => {
            c.into_iter().for_each(|v| match v {
                Value::Number(num) => {
                    let s = num.to_string();
                    let l = bmap.len();
                    let mut insert = bmap.entry(s).or_insert((0, l));
                    insert.0 += 1;
                }
                _ => {}
            });
            Ok(())
        }
        CalcValue::Union(_) => unreachable!(),
    }
}
