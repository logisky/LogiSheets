use pest::iterators::Pair;
use pest::Parser;
use pest_derive::Parser;

use crate::operator::{
    CheckError, CheckNum, CheckString, Input, Operator, ShiftData, Statement, Switch,
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
