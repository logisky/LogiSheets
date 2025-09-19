use pest::Parser;
use pest_derive::Parser;
use tracing::error;

mod fmt;

pub use fmt::{lex_and_fmt, CellRef, FormulaDisplayInfo, TokenType, TokenUnit};

#[derive(Parser)]
#[grammar = "grammar.pest"]
pub struct FormulaParser;

pub fn lex(s: &str) -> Option<pest::iterators::Pair<Rule>> {
    let result = FormulaParser::parse(Rule::start, s);
    match result {
        Ok(mut r) => {
            let tokens = r.next().unwrap();
            Some(tokens)
        }
        Err(e) => {
            error!("parse formula failed: {}\nMeet error: {}", s, e);
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::lex;

    #[test]
    fn constant() {
        let r1 = lex("2");
        assert_ne!(r1, None);
        let r2 = lex("10.01");
        assert_ne!(r2, None);
        let r3 = lex("-3.14");
        assert_ne!(r3, None);
        let r4 = lex("-3e+10");
        assert_ne!(r4, None);
        let r5 = lex("+3e+10");
        assert_ne!(r5, None);
    }

    #[test]
    fn reference() {
        let r1 = lex("B2").unwrap();
        println!("{:?}", r1);
        let r2 = lex("B$2").unwrap();
        println!("{:?}", r2);
        let r3 = lex("$B$2").unwrap();
        println!("{:?}", r3);
        let r = lex("B2:A$3").unwrap();
        println!("{:?}", r);
        let r = lex("Sheet1!#REF!").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn ref_with_preifx() {
        let r = lex("'sheet1'!B2").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn func_call() {
        let r = lex("B2+1").unwrap();
        println!("{:?}", r);
        let r = lex("SUM(B2,1)").unwrap();
        println!("{:?}", r);
        let r = lex("SUM($B2,1)").unwrap();
        println!("{:?}", r);
        let r = lex("SUM(A2:B4)").unwrap();
        println!("{:?}", r);
        let r = lex("SUM(A2:B4)*SUM($A2:B$4)").unwrap();
        println!("{:?}", r);
        let r = lex("5%").unwrap();
        println!("{:?}", r);
        let r = lex("SUM(1:2)").unwrap();
        println!("{:?}", r);
        let r = lex("_xll.VDATA(1:2)").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn str_op() {
        let r = lex("\"string\"").unwrap();
        println!("{:?}", r);
        let r = lex("\"string\"&\"string\"").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn comma_node() {
        let r = lex("INDEX( (A5:B2, D6), 3)").unwrap();
        println!("{:?}", r);
        let r = lex("SUM( (A5:B2, D6, (A1, B3)), 3)").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn bracket() {
        let r = lex("1+(2-3)").unwrap();
        println!("{:?}", r);
        let r = lex("1+ ( 2 - 3)").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn infix_op() {
        let r = lex("1/-2");
        println!("{:?}", r);
    }

    #[test]
    fn func_with_bool_arg() {
        let r = lex("NORM.S.DIST(2,TRUE)").unwrap();
        println!("{:?}", r)
    }

    #[test]
    fn func_name_has_num() {
        let r = lex("LOG10(10)").unwrap();
        println!("{:?}", r)
    }

    #[test]
    fn func_empty_arg() {
        let r = lex("WEEKDAY(,2)").unwrap();
        println!("{:?}", r);
        let r = lex("WEEKDAY( ,2)").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn error_constant() {
        let r = lex("#PLACEHOLDER").unwrap();
        println!("{:?}", r);
        let r = lex("#DIV/0!").unwrap();
        println!("{:?}", r);
        let r = lex("#N/A").unwrap();
        println!("{:?}", r);
        let r = lex("#NAME?").unwrap();
        println!("{:?}", r);
        let r = lex("#NULL!").unwrap();
        println!("{:?}", r);
        let r = lex("#NUM!").unwrap();
        println!("{:?}", r);
        let r = lex("#REF!").unwrap();
        println!("{:?}", r);
        let r = lex("#VALUE!").unwrap();
        println!("{:?}", r);
        let r = lex("#GETTING_DATA").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn lower_case_cell_reference() {
        let r = lex("a1").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn sheet_name_coordinate() {
        let r = lex("a1!a1").unwrap();
        println!("{:?}", r);
    }

    #[test]
    fn row_range_cell_reference() {
        let r = lex("1+2:3").unwrap();
        println!("{:?}", r);
        let r = lex("1+2-3").unwrap();
        println!("{:?}", r);
    }
}
