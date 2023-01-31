use logisheets_controller::controller::edit_action::{
    CellInput, ColShift, EditAction, EditPayload, PayloadsAction, RowShift, SheetRename, SheetShift,
};
use logisheets_controller::{Value, Workbook};

use crate::operator::{
    CheckError, CheckNum, CheckString, Input, Operator, ShiftData, Statement, Switch,
};
use crate::parser::{parse, ParseError};

#[derive(Debug)]
pub struct ExecError {
    pub line: usize,
    pub msg: String,
}

#[derive(Debug)]
pub enum Error {
    Parse(ParseError),
    Exec(ExecError),
}

impl Error {
    pub fn to_string(self) -> String {
        match self {
            Error::Parse(e) => format!("line {}: {}", e.line, e.msg),
            Error::Exec(e) => format!("line {}: {}", e.line, e.msg),
        }
    }
}

pub struct ExecContext {
    pub sheet_name: String,
    pub workbook: Workbook,
}

impl Default for ExecContext {
    fn default() -> Self {
        Self {
            sheet_name: String::from("Sheet1"),
            workbook: Default::default(),
        }
    }
}

fn execute(statements: Vec<Statement>) -> Option<ExecError> {
    let mut ctx = ExecContext::default();
    for s in statements {
        let line = s.line;
        let res = match s.op {
            Operator::Switch(switch) => exec_switch(&mut ctx, switch, line),
            Operator::Input(input) => exec_input(&mut ctx, input, line),
            Operator::CheckNum(check_num) => exec_check_num(&mut ctx, check_num, line),
            Operator::CheckString(check_str) => exec_check_string(&mut ctx, check_str, line),
            Operator::CheckError(check_err) => exec_check_error(&mut ctx, check_err, line),
            Operator::InsertRow(data) => exec_shift_row(&mut ctx, data, line, true),
            Operator::InsertCol(data) => exec_shift_col(&mut ctx, data, line, true),
            Operator::DeleteRow(data) => exec_shift_row(&mut ctx, data, line, false),
            Operator::DeleteCol(data) => exec_shift_col(&mut ctx, data, line, false),
        };
        if res.is_some() {
            return res;
        }
    }
    None
}

fn exec_shift_row(
    ctx: &mut ExecContext,
    data: ShiftData,
    line: usize,
    insert: bool,
) -> Option<ExecError> {
    let sheet = ctx.workbook.get_sheet_idx_by_name(&ctx.sheet_name);
    if let Err(_) = sheet {
        return Some(ExecError {
            line,
            msg: format!("Sheet {} is not found", ctx.sheet_name),
        });
    }
    let sheet_idx = sheet.unwrap();
    ctx.workbook
        .handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::RowShift(RowShift {
                sheet_idx,
                row: data.from as usize,
                count: data.cnt as usize,
                insert,
            })],
            undoable: false,
        }));
    None
}

fn exec_shift_col(
    ctx: &mut ExecContext,
    data: ShiftData,
    line: usize,
    insert: bool,
) -> Option<ExecError> {
    let sheet = ctx.workbook.get_sheet_idx_by_name(&ctx.sheet_name);
    if let Err(_) = sheet {
        return Some(ExecError {
            line,
            msg: format!("Sheet {} is not found", ctx.sheet_name),
        });
    }
    let sheet_idx = sheet.unwrap();
    ctx.workbook
        .handle_action(EditAction::Payloads(PayloadsAction {
            payloads: vec![EditPayload::ColShift(ColShift {
                sheet_idx,
                col: data.from as usize,
                count: data.cnt as usize,
                insert,
            })],
            undoable: false,
        }));
    None
}

fn exec_switch(ctx: &mut ExecContext, switch: Switch, _line: usize) -> Option<ExecError> {
    match ctx.workbook.get_sheet_by_name(&switch.sheet) {
        Ok(_) => (),
        Err(_) => ctx
            .workbook
            .handle_action(EditAction::Payloads(PayloadsAction {
                undoable: false,
                payloads: vec![
                    EditPayload::SheetShift(SheetShift {
                        idx: 0,
                        insert: true,
                    }),
                    EditPayload::SheetRename(SheetRename {
                        old_name: String::from("Sheet2"),
                        new_name: switch.sheet.clone(),
                    }),
                ],
            })),
    };
    ctx.sheet_name = switch.sheet;
    None
}

fn exec_input(ctx: &mut ExecContext, input: Input, line: usize) -> Option<ExecError> {
    let sheet = ctx.workbook.get_sheet_idx_by_name(&ctx.sheet_name);
    if let Err(_) = sheet {
        return Some(ExecError {
            line,
            msg: format!("Sheet {} is not found", ctx.sheet_name),
        });
    }
    let sheet_idx = sheet.unwrap();
    ctx.workbook
        .handle_action(EditAction::Payloads(PayloadsAction {
            undoable: false,
            payloads: vec![EditPayload::CellInput(CellInput {
                sheet_idx,
                row: input.row as usize,
                col: input.col as usize,
                content: input.content,
            })],
        }));
    None
}

fn exec_check_num(ctx: &mut ExecContext, check_num: CheckNum, line: usize) -> Option<ExecError> {
    let row = check_num.row;
    let col = check_num.col;
    match ctx.workbook.get_sheet_by_name(&ctx.sheet_name) {
        Ok(mut ws) => {
            let v = ws.get_value(row as usize, col as usize).unwrap();
            match v {
                Value::Str(_) => Some(ExecError {
                    line,
                    msg: "expect number, found string".to_string(),
                }),
                Value::Bool(_) => Some(ExecError {
                    line,
                    msg: "bool is found".to_string(),
                }),
                Value::Number(num) => {
                    if (num - check_num.expect).abs() < 10e-4 {
                        None
                    } else {
                        Some(ExecError {
                            line,
                            msg: format!("find: {}, expect: {}", num, check_num.expect),
                        })
                    }
                }
                Value::Error(e) => Some(ExecError {
                    line,
                    msg: format!("expect number, found error: {}", e),
                }),
                Value::Empty => Some(ExecError {
                    line,
                    msg: "empty is found".to_string(),
                }),
            }
        }
        Err(_) => Some(ExecError {
            line,
            msg: format!("Sheet {} is not found", &ctx.sheet_name),
        }),
    }
}

fn exec_check_string(
    ctx: &mut ExecContext,
    check_str: CheckString,
    line: usize,
) -> Option<ExecError> {
    let row = check_str.row;
    let col = check_str.col;
    match ctx.workbook.get_sheet_by_name(&ctx.sheet_name) {
        Ok(mut ws) => {
            let v = ws.get_value(row as usize, col as usize).unwrap();
            match v {
                Value::Str(s) => {
                    if s != check_str.expect {
                        Some(ExecError {
                            line,
                            msg: format!("expect {}, found {}", check_str.expect, s),
                        })
                    } else {
                        None
                    }
                }
                Value::Bool(b) => {
                    let actual = if b { "TRUE" } else { "FALSE" };
                    if actual != check_str.expect {
                        Some(ExecError {
                            line,
                            msg: format!("expect {} , found {}", check_str.expect, actual),
                        })
                    } else {
                        None
                    }
                }
                Value::Number(_) => Some(ExecError {
                    line,
                    msg: "expect string, found number".to_string(),
                }),
                Value::Error(_) => Some(ExecError {
                    line,
                    msg: "expect string, found error".to_string(),
                }),
                Value::Empty => Some(ExecError {
                    line,
                    msg: "empty is found".to_string(),
                }),
            }
        }
        Err(_) => Some(ExecError {
            line,
            msg: format!("Sheet {} is not found", &ctx.sheet_name),
        }),
    }
}

fn exec_check_error(
    ctx: &mut ExecContext,
    check_err: CheckError,
    line: usize,
) -> Option<ExecError> {
    let row = check_err.row;
    let col = check_err.col;
    match ctx.workbook.get_sheet_by_name(&ctx.sheet_name) {
        Ok(mut ws) => {
            let v = ws.get_value(row as usize, col as usize).unwrap();
            match v {
                Value::Error(e) => {
                    if e != check_err.expect {
                        Some(ExecError {
                            line,
                            msg: format!("expect {}, found {}", check_err.expect, e),
                        })
                    } else {
                        None
                    }
                }
                _ => Some(ExecError {
                    line,
                    msg: "not an error!".to_string(),
                }),
            }
        }
        Err(_) => Some(ExecError {
            line,
            msg: format!("Sheet {} is not found", &ctx.sheet_name),
        }),
    }
}

pub fn execute_script(script: &str) -> Option<Error> {
    let statements = parse(script);
    if let Err(e) = statements {
        return Some(Error::Parse(e));
    }
    let statements = statements.unwrap();
    if let Some(e) = execute(statements) {
        return Some(Error::Exec(e));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::execute_script;

    #[test]
    fn script_test1() {
        let script = r#"
INPUT    A1  2.3
CHECKNUM A1  2.3
"#;
        if let Some(err) = execute_script(script) {
            panic!("{}", err.to_string())
        }
    }

    #[test]
    fn script_test2() {
        let script = r#"
INPUT    A1  =SUM(1+2)
CHECKNUM A1  3
"#;
        if let Some(err) = execute_script(script) {
            panic!("{}", err.to_string())
        }
    }

    #[test]
    fn script_test3() {
        let script = r#"
# comment
SWITCH ssss
INPUT A1 3
SWITCH Sheet1
INPUT B2 =ssss!A1+3
CHECKNUM B2 6
"#;
        if let Some(err) = execute_script(script) {
            panic!("{}", err.to_string())
        }
    }

    #[test]
    fn script_test4() {
        let script = r#"
INPUT A1 =2/0
CHECKERR A1 #DIV/0!
"#;
        if let Some(err) = execute_script(script) {
            panic!("{}", err.to_string())
        }
    }
}
