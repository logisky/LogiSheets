use logisheets_parser::ast;

use super::{CalcValue, Value};

pub enum ConditionResult {
    True,
    False,
    Error(ast::Error),
}

pub fn get_condition_result(calc_value: CalcValue) -> ConditionResult {
    match calc_value {
        CalcValue::Scalar(s) => match s {
            Value::Blank => ConditionResult::False,
            Value::Number(num) => {
                if num.abs() < 1e-10 {
                    ConditionResult::False
                } else {
                    ConditionResult::True
                }
            }
            Value::Text(_) => ConditionResult::Error(ast::Error::Value),
            Value::Boolean(b) => {
                if b {
                    ConditionResult::True
                } else {
                    ConditionResult::False
                }
            }
            Value::Error(e) => ConditionResult::Error(e),
            Value::Date(_) => ConditionResult::True,
        },
        CalcValue::Union(_) => ConditionResult::Error(ast::Error::Value),
        // WPS neither support this.
        CalcValue::Range(_) => ConditionResult::Error(ast::Error::Value),
        CalcValue::Cube(_) => ConditionResult::Error(ast::Error::Ref),
    }
}

pub fn convert_f64(value: Value) -> Result<f64, ast::Error> {
    match value {
        Value::Blank => Ok(0_f64),
        Value::Number(n) => Ok(n),
        Value::Text(t) => match t.parse::<f64>() {
            Ok(n) => Ok(n),
            Err(_) => Err(ast::Error::Value),
        },
        Value::Boolean(b) => {
            if b {
                Ok(1.)
            } else {
                Ok(0.)
            }
        }
        Value::Error(e) => Err(e),
        Value::Date(_) => todo!(),
    }
}

pub fn is_error(value: &CalcValue) -> bool {
    match value {
        CalcValue::Scalar(s) => match s {
            Value::Error(_) => true,
            _ => false,
        },
        CalcValue::Range(_) => false,
        CalcValue::Cube(_) => true,
        CalcValue::Union(_) => todo!(),
    }
}

fn get_f64(v: Value) -> Result<Option<f64>, ast::Error> {
    match v {
        Value::Number(f) => Ok(Some(f)),
        Value::Boolean(b) => {
            if b {
                Ok(Some(1.))
            } else {
                Ok(Some(0.))
            }
        }
        Value::Error(e) => Err(e),
        _ => Ok(None),
    }
}

pub fn get_nums_from_value(value: CalcValue) -> Result<Vec<f64>, ast::Error> {
    match value {
        CalcValue::Scalar(v) => match get_f64(v) {
            Ok(num) => {
                if let Some(f) = num {
                    Ok(vec![f])
                } else {
                    Ok(vec![])
                }
            }
            Err(e) => Err(e),
        },
        CalcValue::Range(r) => r.into_iter().fold(Ok(vec![]), |prev, curr| {
            if prev.is_err() {
                return prev;
            }
            let num = get_f64(curr);
            match num {
                Ok(f) => {
                    if let Some(n) = f {
                        let mut v = prev.unwrap();
                        v.push(n);
                        Ok(v)
                    } else {
                        prev
                    }
                }
                Err(e) => Err(e),
            }
        }),
        CalcValue::Cube(c) => c.into_iter().fold(Ok(vec![]), |prev, curr| {
            if prev.is_err() {
                return prev;
            }
            let num = get_f64(curr);
            match num {
                Ok(f) => {
                    if let Some(n) = f {
                        let mut v = prev.unwrap();
                        v.push(n);
                        Ok(v)
                    } else {
                        prev
                    }
                }
                Err(e) => Err(e),
            }
        }),
        CalcValue::Union(_) => Err(ast::Error::Unspecified),
    }
}

#[cfg(test)]
pub mod tests_utils {
    use logisheets_base::async_func::{AsyncCalcResult, AsyncFuncCommitTrait, Task};
    use logisheets_base::get_active_sheet::GetActiveSheetTrait;
    use logisheets_base::get_curr_addr::GetCurrAddrTrait;
    use logisheets_base::set_curr_cell::SetCurrCellTrait;
    use logisheets_parser::ast;

    use crate::calc_engine::calculator::calc_vertex::{CalcValue, CalcVertex};
    use crate::calc_engine::connector::Connector;
    use crate::vertex_manager::vertex::FormulaId;

    pub struct TestFetcher {}
    impl AsyncFuncCommitTrait for TestFetcher {
        fn query_or_commit_task(
            &mut self,
            _sheet_id: logisheets_base::SheetId,
            _cell_id: logisheets_base::CellId,
            _task: Task,
        ) -> Option<AsyncCalcResult> {
            None
        }
    }
    impl GetActiveSheetTrait for TestFetcher {
        fn get_active_sheet(&self) -> logisheets_base::SheetId {
            todo!()
        }
    }

    impl GetCurrAddrTrait for TestFetcher {
        fn get_curr_addr(&self) -> logisheets_base::Addr {
            todo!()
        }
    }

    impl SetCurrCellTrait for TestFetcher {
        fn set_curr_cell(
            &mut self,
            _active_sheet: logisheets_base::SheetId,
            _addr: logisheets_base::Addr,
        ) {
            todo!()
        }
    }

    impl Connector for TestFetcher {
        fn convert(&mut self, _: &ast::CellReference) -> CalcVertex {
            todo!()
        }

        fn get_calc_value(&mut self, vertex: CalcVertex) -> CalcValue {
            match vertex {
                CalcVertex::Value(v) => v,
                CalcVertex::Reference(_) => panic!(),
                CalcVertex::Union(_) => todo!(),
            }
        }

        fn get_text(&self, _: &logisheets_base::TextId) -> Option<String> {
            todo!()
        }

        fn get_func_name(&self, _: &logisheets_base::FuncId) -> Option<String> {
            todo!()
        }

        fn get_cell_idx(
            &mut self,
            _sheet_id: logisheets_base::SheetId,
            _cell_id: &logisheets_base::CellId,
        ) -> Option<(usize, usize)> {
            Some((0, 0))
        }

        fn get_cell_id(
            &mut self,
            _sheet_id: logisheets_base::SheetId,
            _row: usize,
            _col: usize,
        ) -> Option<logisheets_base::CellId> {
            todo!()
        }

        fn commit_calc_values(
            &mut self,
            _vertex: FormulaId,
            _result: CalcValue,
        ) -> std::collections::HashSet<crate::vertex_manager::vertex::FormulaId> {
            todo!()
        }

        fn is_async_func(&self, _func_name: &str) -> bool {
            false
        }
    }
}
