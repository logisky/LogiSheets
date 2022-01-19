extern crate pest;
#[macro_use]
extern crate pest_derive;
#[macro_use]
extern crate logiutils;

use pest::Parser;

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
            log!("{:?}", e);
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
        log!("{:?}", r1);
        let r2 = lex("B$2").unwrap();
        log!("{:?}", r2);
        let r3 = lex("$B$2").unwrap();
        log!("{:?}", r3);
        let r = lex("B2:A$3").unwrap();
        log!("{:?}", r);
        // let r = lex("SUM(Sheet1!#REF!)").unwrap();
        // log!("{:?}", r);
    }

    #[test]
    fn ref_with_preifx() {
        let r = lex("'sheet1'!B2").unwrap();
        log!("{:?}", r);
    }

    #[test]
    fn func_call() {
        let r = lex("B2+1").unwrap();
        log!("{:?}", r);
        let r = lex("SUM(B2,1)").unwrap();
        log!("{:?}", r);
        let r = lex("SUM($B2,1)").unwrap();
        log!("{:?}", r);
        let r = lex("SUM(A2:B4)").unwrap();
        log!("{:?}", r);
        let r = lex("SUM(A2:B4)*SUM($A2:B$4)").unwrap();
        log!("{:?}", r);
        let r = lex("5%").unwrap();
        log!("{:?}", r);
        let r = lex("SUM(1:2)").unwrap();
        log!("{:?}", r);
        let r = lex("_xll.VDATA(1:2)").unwrap();
        log!("{:?}", r);
    }

    #[test]
    fn str_op() {
        let r = lex("\"string\"").unwrap();
        log!("{:?}", r);
        let r = lex("\"string\"&\"string\"").unwrap();
        log!("{:?}", r);
    }

    #[test]
    fn comma_node() {
        let r = lex("INDEX( (A5:B2, D6), 3)").unwrap();
        log!("{:?}", r);
        let r = lex("SUM( (A5:B2, D6, (A1, B3)), 3)").unwrap();
        log!("{:?}", r);
    }

    #[test]
    fn bracket() {
        let r = lex("1+(2-3)").unwrap();
        log!("{:?}", r);
        let r = lex("1+ ( 2 - 3)").unwrap();
        log!("{:?}", r);
    }

    #[test]
    fn infix_op() {
        let r = lex("1/-2");
        log!("{:?}", r);
    }
}
