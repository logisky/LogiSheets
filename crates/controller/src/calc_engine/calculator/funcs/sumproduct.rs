use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::connector::Connector;
use logisheets_parser::ast;

/// SUMPRODUCT(array1, [array2], ...) — multiply corresponding elements of the
/// arrays and sum the products. All arrays must share the same dimensions
/// (#VALUE! otherwise); non-numeric cells count as 0 and errors propagate.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(!args.is_empty(), ast::Error::Unspecified);

    let mut grids: Vec<(usize, usize, Vec<f64>)> = Vec::with_capacity(args.len());
    for arg in args {
        match to_grid(fetcher.get_calc_value(arg)) {
            Ok(g) => grids.push(g),
            Err(e) => return CalcVertex::from_error(e),
        }
    }

    let (rows, cols, _) = &grids[0];
    let (rows, cols) = (*rows, *cols);
    // Every array must have identical dimensions.
    if grids.iter().any(|(r, c, _)| *r != rows || *c != cols) {
        return CalcVertex::from_error(ast::Error::Value);
    }

    let n = rows * cols;
    let mut sum = 0.;
    for i in 0..n {
        let mut product = 1.;
        for (_, _, nums) in &grids {
            product *= nums[i];
        }
        sum += product;
    }
    CalcVertex::from_number(sum)
}

/// Turn an argument into (rows, cols, row-major numbers). Scalars are treated as
/// a 1x1 array; non-numeric cells become 0, errors propagate.
fn to_grid(value: CalcValue) -> Result<(usize, usize, Vec<f64>), ast::Error> {
    match value {
        CalcValue::Scalar(s) => Ok((1, 1, vec![num_of(s)?])),
        CalcValue::Range(m) => {
            let (r, c) = m.get_avail_size();
            let mut nums = Vec::with_capacity(r * c);
            for v in m.into_iter() {
                nums.push(num_of(v)?);
            }
            Ok((r, c, nums))
        }
        _ => Err(ast::Error::Value),
    }
}

fn num_of(v: Value) -> Result<f64, ast::Error> {
    match v {
        Value::Number(n) => Ok(n),
        Value::Error(e) => Err(e),
        _ => Ok(0.),
    }
}
