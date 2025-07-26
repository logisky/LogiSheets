use logisheets_controller::edit_action::{CreateBlock, MoveBlock, RemoveBlock, ResizeBlock};
use pest::iterators::Pair;
use pest::Parser;
use pest_derive::Parser;

use crate::operator::{
    BlockShiftData, CheckEmpty, CheckError, CheckFormula, CheckNum, CheckString, Input, Operator,
    ShiftData, Statement, Switch,
};

#[derive(Parser)]
#[grammar = "grammar.pest"]
pub struct ScriptParser;

#[derive(Debug)]
pub struct ParseError {
    pub line: usize,
    pub msg: String,
}

fn lex(s: &str) -> Option<pest::iterators::Pair<Rule>> {
    let result = ScriptParser::parse(Rule::start, s);
    match result {
        Ok(mut r) => {
            let tokens = r.next().unwrap();
            Some(tokens)
        }
        Err(e) => {
            println!("{}", e);
            None
        }
    }
}

fn parse_op(s: Pair<Rule>) -> Result<Operator, ParseError> {
    match s.as_rule() {
        Rule::input_op => {
            let mut iter = s.into_inner();
            let position = iter.next().unwrap();
            let (row, col) = parse_position(position).unwrap();
            let content = iter.next().unwrap().as_str().to_string();
            Ok(Operator::Input(Input { row, col, content }))
        }
        Rule::switch_op => {
            let mut iter = s.into_inner();
            let sheet_name = iter.next().unwrap();
            Ok(Operator::Switch(Switch {
                sheet: sheet_name.as_str().to_string(),
            }))
        }
        Rule::checkerr_op => {
            let mut iter = s.into_inner();
            let position = iter.next().unwrap();
            let (row, col) = parse_position(position).unwrap();
            let expect = iter.next().unwrap().as_str().to_string();
            Ok(Operator::CheckError(CheckError { row, col, expect }))
        }
        Rule::checknum_op => {
            let mut iter = s.into_inner();
            let position = iter.next().unwrap();
            let (row, col) = parse_position(position).unwrap();
            let expect = iter.next().unwrap().as_str().parse::<f64>().unwrap();
            Ok(Operator::CheckNum(CheckNum { row, col, expect }))
        }
        Rule::checkstr_op => {
            let mut iter = s.into_inner();
            let position = iter.next().unwrap();
            let (row, col) = parse_position(position).unwrap();
            let expect = iter.next().unwrap().as_str().to_string();
            Ok(Operator::CheckString(CheckString { row, col, expect }))
        }
        Rule::checkformula_op => {
            let mut iter = s.into_inner();
            let position = iter.next().unwrap();
            let (row, col) = parse_position(position).unwrap();
            let expect = iter.next().unwrap().as_str().to_string();
            Ok(Operator::CheckFormula(CheckFormula { row, col, expect }))
        }
        Rule::checkempty_op => {
            let mut iter = s.into_inner();
            let position = iter.next().unwrap();
            let (row, col) = parse_position(position).unwrap();
            Ok(Operator::CheckEmpty(CheckEmpty { row, col }))
        }
        Rule::insert_row => {
            let mut iter = s.into_inner();
            let row = iter.next().unwrap();
            let from = row.as_str().parse::<u32>().unwrap() - 1;
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::InsertRow(ShiftData { from, cnt }))
        }
        Rule::insert_col => {
            let mut iter = s.into_inner();
            let col = iter.next().unwrap();
            let from = column_label_to_index(col.as_str());
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::InsertCol(ShiftData { from, cnt }))
        }
        Rule::delete_row => {
            let mut iter = s.into_inner();
            let row = iter.next().unwrap();
            let from = row.as_str().parse::<u32>().unwrap() - 1;
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::DeleteRow(ShiftData { from, cnt }))
        }
        Rule::delete_col => {
            let mut iter = s.into_inner();
            let col = iter.next().unwrap();
            let from = column_label_to_index(col.as_str());
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::DeleteCol(ShiftData { from, cnt }))
        }
        Rule::block_create => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let range_pair = iter.next().unwrap();
            let ((start_row, start_col), (end_row, end_col)) = parse_range(range_pair).unwrap();
            let start_row = start_row as usize;
            let start_col = start_col as usize;
            let end_row = end_row as usize;
            let end_col = end_col as usize;
            Ok(Operator::CreateBlock(CreateBlock {
                sheet_idx: 1, // dummy sheet_idx
                id,
                master_row: start_row,
                master_col: start_col,
                row_cnt: end_row - start_row + 1,
                col_cnt: end_col - start_col + 1,
            }))
        }
        Rule::block_move => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let position_pair = iter.next().unwrap();
            let (row, col) = parse_position(position_pair).unwrap();
            Ok(Operator::MoveBlock(MoveBlock {
                sheet_idx: 1, // dummy sheet_idx
                id,
                new_master_row: row as usize,
                new_master_col: col as usize,
            }))
        }
        Rule::block_remove => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            // dummy sheet_idx
            Ok(Operator::RemoveBlock(RemoveBlock { sheet_idx: 1, id }))
        }
        Rule::block_resize => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let row_cnt = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let col_cnt = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            Ok(Operator::ResizeBlock(ResizeBlock {
                sheet_idx: 1, // dummy sheet_idx
                id,
                new_row_cnt: row_cnt,
                new_col_cnt: col_cnt,
            }))
        }
        Rule::block_insert_row => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let idx = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::BlockInsertRow(BlockShiftData {
                block_id: id,
                from: idx,
                cnt,
            }))
        }
        Rule::block_insert_col => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let idx = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::BlockInsertCol(BlockShiftData {
                block_id: id,
                from: idx,
                cnt,
            }))
        }
        Rule::block_delete_row => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let idx = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::BlockDeleteRow(BlockShiftData {
                block_id: id,
                from: idx,
                cnt,
            }))
        }
        Rule::block_delete_col => {
            let mut iter = s.into_inner();
            let id = iter.next().unwrap().as_str().parse::<usize>().unwrap();
            let idx = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            let cnt = iter.next().unwrap().as_str().parse::<u32>().unwrap();
            Ok(Operator::BlockDeleteCol(BlockShiftData {
                block_id: id,
                from: idx,
                cnt,
            }))
        }
        _ => unreachable!(),
    }
}

fn column_label_to_index(label: &str) -> u32 {
    let mut result: u32 = 0;
    for (i, c) in label.chars().rev().enumerate() {
        result += (c as u32 - 64) * 26u32.pow(i as u32);
    }
    result - 1
}

fn parse_range(p: Pair<Rule>) -> Option<((u32, u32), (u32, u32))> {
    let mut p = p.into_inner();
    let start = parse_position(p.next().unwrap())?;
    let end = parse_position(p.next().unwrap())?;
    Some((start, end))
}

fn parse_position(p: Pair<Rule>) -> Option<(u32, u32)> {
    let mut p = p.into_inner();
    let col = p.next().unwrap().as_str();
    let col = column_label_to_index(col);
    let row = p.next().unwrap().as_str();
    let row = row.parse::<u32>().unwrap() - 1;
    Some((row, col))
}

pub fn parse(s: &str) -> Result<Vec<Statement>, ParseError> {
    let mut result = Vec::<Statement>::new();
    let lines = s.lines().collect::<Vec<_>>();
    for (idx, line) in lines.into_iter().enumerate() {
        let line = line.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if let Some(token) = lex(line) {
            let op = parse_op(token)?;
            result.push(Statement { op, line: idx + 1 });
        } else {
            return Err(ParseError {
                line: idx + 1,
                msg: String::from(format!("parse failed: {}", s)),
            });
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::lex;

    #[test]
    fn test1() {
        let script = r#"INPUT A1 3"#;
        let operator = lex(script).unwrap();
        println!("{:?}", operator);
        let script = r#"INPUT A1 3.2"#;
        let _ = lex(script).unwrap();
    }

    #[test]
    fn test2() {
        let script = r#"SWITCH Sheet1"#;
        let _ = lex(script).unwrap();
        let script = "INPUT A2 3.44";
        let _ = lex(script).unwrap();
        let script = "CHECKNUM A2 3.44";
        let _ = lex(script).unwrap();
    }
}
