use controller_base::async_func::{AsyncCalcResult, Task};
use parser::ast;

use crate::calc_engine::{
    calculator::calc_vertex::{CalcValue, CalcVertex, Value},
    connector::Connector,
};

pub fn calc<C>(name: &str, args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let sheet_id = fetcher.get_active_sheet();
    let curr_cell = fetcher.get_curr_addr();
    let cid = fetcher.get_cell_id(sheet_id, curr_cell.row, curr_cell.col);
    assert_or_return!(cid.is_some(), ast::Error::Unspecified);
    let cid = cid.unwrap();
    let async_args = args
        .into_iter()
        .map(|arg| fetcher.get_calc_value(arg).to_async_arg())
        .collect::<Vec<_>>();
    let res = fetcher.query_or_commit_task(
        sheet_id,
        cid,
        Task {
            async_func: name.to_string(),
            args: async_args,
        },
    );
    CalcVertex::Value(CalcValue::Scalar(decode_result(res)))
}

fn decode_result(result: Option<AsyncCalcResult>) -> Value {
    if let Some(result) = result {
        match result {
            Ok(s) => {
                if let Ok(num_res) = s.parse::<f64>() {
                    Value::Number(num_res)
                } else {
                    let upper = s.to_uppercase();
                    if upper == "TRUE" {
                        Value::Boolean(true)
                    } else if upper == "FALSE" {
                        Value::Boolean(false)
                    } else {
                        Value::Text(s)
                    }
                }
            }
            Err(_) => Value::Error(ast::Error::Null), // To specify
        }
    } else {
        Value::Error(ast::Error::GettingData)
    }
}
