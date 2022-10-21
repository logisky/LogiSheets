pub mod ast;
mod climber;
pub mod context;
mod reference;
#[cfg(test)]
mod test_utils;
pub mod unparse;
mod update;
pub mod walker;

#[macro_use]
extern crate lazy_static;
use crate::climber::{Assoc, Climber, ClimberBuilder, Operator};
use context::ContextTrait;
use logisheets_base::id_fetcher::IdFetcherTrait;
use logisheets_lexer::*;
use pest::iterators::Pair;
use reference::build_cell_reference;
use regex::Regex;

lazy_static! {
    static ref CLIMBER: Climber<Rule> = ClimberBuilder::new()
        .op(Operator::new(Rule::comma, Assoc::Left))
        .op(Operator::new(Rule::ge_op, Assoc::Left))
        .op(Operator::new(Rule::gt_op, Assoc::Left))
        .op(Operator::new(Rule::le_op, Assoc::Left))
        .op(Operator::new(Rule::lt_op, Assoc::Left))
        .op(Operator::new(Rule::neq_op, Assoc::Left))
        .op(Operator::new(Rule::eq_op, Assoc::Left))
        .op(Operator::new(Rule::concat_op, Assoc::Left))
        .op(Operator::new(Rule::minus_op, Assoc::Left))
        .op(Operator::new(Rule::plus_op, Assoc::Left))
        .op(Operator::new(Rule::div_op, Assoc::Left))
        .op(Operator::new(Rule::multiply_op, Assoc::Left))
        .op(Operator::new(Rule::exp_op, Assoc::Left))
        .op(Operator::new(Rule::postfix_op, Assoc::Postfix))
        .op(Operator::new(Rule::prefix_op, Assoc::Prefix))
        .op(Operator::new(Rule::space_op, Assoc::Left))
        .op(Operator::new(Rule::colon_op, Assoc::Left))
        .build();
    static ref NUM_REGEX: Regex =
        Regex::new(r#"([0-9]+)?(\.?([0-9]+))?([Ee]([+-]?[0-9]+))?"#).unwrap();
    static ref WORKSHEET_PREIFX_REGEX: Regex =
        Regex::new(r#"'?(\[(.+?)\])?((.+?):)?(.+?)'?!"#).unwrap();
    static ref COLUMN_REGEX: Regex = Regex::new(r#"(\$)?([A-Z]+)"#).unwrap();
    static ref ROW_REGEX: Regex = Regex::new(r#"(\$)?([0-9]+)"#).unwrap();
}

pub struct Parser {}

impl Parser {
    pub fn parse<T>(&self, formula: &str, context: &mut T) -> Option<ast::Node>
    where
        T: ContextTrait,
    {
        let pair = lex(formula.trim())?;
        let formula = pair.into_inner().next()?;
        Some(self.parse_from_pair(formula, context, false))
    }

    fn parse_from_pair<T>(&self, formula: Pair<Rule>, context: &mut T, bracket: bool) -> ast::Node
    where
        T: ContextTrait,
    {
        let ast = CLIMBER.climb(
            formula.into_inner(),
            |pair: Pair<Rule>| self.primary(pair, context),
            |lhs: ast::Node, pair: Pair<Rule>, rhs: ast::Node| -> ast::Node {
                let infix_op = match pair.as_rule() {
                    Rule::colon_op => ast::InfixOperator::Colon,
                    Rule::space_op => ast::InfixOperator::Space,
                    Rule::exp_op => ast::InfixOperator::Exp,
                    Rule::multiply_op => ast::InfixOperator::Multiply,
                    Rule::div_op => ast::InfixOperator::Divide,
                    Rule::plus_op => ast::InfixOperator::Plus,
                    Rule::minus_op => ast::InfixOperator::Minus,
                    Rule::concat_op => ast::InfixOperator::Concat,
                    Rule::eq_op => ast::InfixOperator::Eq,
                    Rule::neq_op => ast::InfixOperator::Neq,
                    Rule::lt_op => ast::InfixOperator::Lt,
                    Rule::le_op => ast::InfixOperator::Le,
                    Rule::gt_op => ast::InfixOperator::Gt,
                    Rule::ge_op => ast::InfixOperator::Ge,
                    _ => unreachable!(),
                };
                let op = ast::Operator::Infix(infix_op);
                let args = vec![lhs, rhs];
                let pure = ast::PureNode::Func(ast::Func { op, args });
                ast::Node { pure, bracket }
            },
            |pair: Pair<Rule>, rhs: ast::Node| -> ast::Node {
                match pair.as_rule() {
                    Rule::prefix_op => {
                        let op = match pair.as_str().trim() {
                            "-" => ast::Operator::Prefix(ast::PrefixOperator::Minus),
                            "+" => ast::Operator::Prefix(ast::PrefixOperator::Plus),
                            _ => ast::Operator::Prefix(ast::PrefixOperator::Minus),
                        };
                        let args = vec![rhs];
                        let func = ast::Func { op, args };
                        let pure = ast::PureNode::Func(func);
                        ast::Node { pure, bracket }
                    }
                    _ => unreachable!(),
                }
            },
            |lhs: ast::Node, pair: Pair<Rule>| -> ast::Node {
                match pair.as_rule() {
                    Rule::postfix_op => {
                        let op = ast::Operator::Postfix(ast::PostfixOperator::Percent);
                        let args = vec![lhs];
                        let func = ast::Func { op, args };
                        let pure = ast::PureNode::Func(func);
                        ast::Node { pure, bracket }
                    }
                    _ => unreachable!(),
                }
            },
        );
        ast
    }

    fn primary<T>(&self, pair: Pair<Rule>, context: &mut T) -> ast::Node
    where
        T: ContextTrait,
    {
        match pair.as_rule() {
            Rule::expression => self.parse_from_pair(pair, context, false),
            Rule::logical_constant => {
                let pure = build_bool(pair);
                ast::Node {
                    pure,
                    bracket: false,
                }
            }
            Rule::error_constant => {
                let pure = build_error(pair);
                ast::Node {
                    pure,
                    bracket: false,
                }
            }
            Rule::string_constant => {
                let pure = build_string_constant(pair);
                ast::Node {
                    pure,
                    bracket: false,
                }
            }
            Rule::numerical_constant => {
                let pure = build_numerical_constant(pair);
                ast::Node {
                    pure,
                    bracket: false,
                }
            }
            Rule::cell_reference => {
                let pure = build_cell_reference(pair, context)
                    .unwrap_or(ast::PureNode::Value(ast::Value::Error(ast::Error::Ref)));
                ast::Node {
                    pure,
                    bracket: false,
                }
            }
            Rule::expression_bracket => {
                let rule = pair.into_inner().next().unwrap();
                self.parse_from_pair(rule, context, true)
            }
            Rule::function_call => {
                let pure = self.build_func_call(pair, context);
                ast::Node {
                    pure,
                    bracket: false,
                }
            }
            Rule::name => {
                let n = build_name_with_prefix(pair, context);
                let pure = match n {
                    Some(r) => ast::PureNode::Reference(r),
                    None => ast::PureNode::Value(ast::Value::Error(ast::Error::Ref)),
                };
                ast::Node {
                    pure,
                    bracket: false,
                }
            }
            _ => unimplemented!(),
        }
    }

    fn build_func_call<T>(&self, pair: Pair<Rule>, context: &mut T) -> ast::PureNode
    where
        T: ContextTrait,
    {
        let mut iter = pair.into_inner();
        let func_name = iter.next().unwrap().as_str().to_string();
        let mut args: Vec<ast::Node> = vec![];
        while iter.peek().is_some() {
            let arg = iter.next().unwrap();
            let arg_node = self.build_arg(arg, context);
            args.push(arg_node);
        }
        let op = ast::Operator::Function(context.fetch_func_id(&func_name));
        let func = ast::Func { op, args };
        ast::PureNode::Func(func)
    }

    fn build_arg<T>(&self, pair: Pair<Rule>, context: &mut T) -> ast::Node
    where
        T: ContextTrait,
    {
        match pair.as_rule() {
            Rule::expression => self.parse_from_pair(pair, context, false),
            Rule::comma_node => {
                let mut args = Vec::<ast::Node>::new();
                pair.into_inner().for_each(|p| match p.as_rule() {
                    Rule::expression => {
                        let n = self.build_arg(p, context);
                        args.push(n);
                    }
                    Rule::comma_node => {
                        let n = self.build_arg(p, context);
                        args.push(n);
                    }
                    _ => {}
                });
                let op = ast::Operator::Comma;
                let func = ast::Func { op, args };
                ast::Node {
                    pure: ast::PureNode::Func(func),
                    bracket: false,
                }
            }
            _ => unreachable!(),
        }
    }
}

fn parse_number(s: &str) -> Option<f64> {
    let caps = NUM_REGEX.captures_iter(s.trim()).next()?;
    let integer = caps
        .get(1)
        .map_or(0, |s| s.as_str().parse::<i32>().unwrap_or(0));
    let frac = caps.get(2).map_or(0_f64, |m| -> f64 {
        let str_f64 = m.as_str();
        str_f64.parse::<f64>().unwrap_or(0_f64)
    });
    let exponent = caps
        .get(5)
        .map_or(0, |s| s.as_str().parse::<i32>().unwrap_or(0));
    let result = ((integer as f64) + frac) * 10_f64.powi(exponent);
    Some(result)
}

fn build_name_with_prefix<T>(pair: Pair<Rule>, id_fetcher: &mut T) -> Option<ast::CellReference>
where
    T: IdFetcherTrait,
{
    let mut p_iter = pair.into_inner();
    let first = p_iter.next().unwrap();
    match first.as_rule() {
        Rule::workbook_name => {
            let book_name = &Some(first.as_str());
            let second = p_iter.next().unwrap().as_str();
            let name_id = id_fetcher.fetch_name_id(book_name, second);
            Some(ast::CellReference::Name(name_id))
        }
        Rule::name_characters => {
            let n = first.as_str();
            let name_id = id_fetcher.fetch_name_id(&None, n);
            Some(ast::CellReference::Name(name_id))
        }
        _ => unreachable!(),
    }
}

fn build_bool(pair: Pair<Rule>) -> ast::PureNode {
    let v = pair.as_str().parse::<String>().unwrap();
    if v == "TRUE" {
        let value = ast::Value::Boolean(true);
        ast::PureNode::Value(value)
    } else {
        let value = ast::Value::Boolean(false);
        ast::PureNode::Value(value)
    }
}

fn build_error(pair: Pair<Rule>) -> ast::PureNode {
    let error = match pair.as_str() {
        "#DIV/0!" => ast::Error::Div0,
        "#N/A" => ast::Error::Na,
        "#NAME?" => ast::Error::Name,
        "#NULL!" => ast::Error::Null,
        "#NUM!" => ast::Error::Num,
        "#REF!" => ast::Error::Ref,
        "#VALUE!" => ast::Error::Value,
        "#GETTING_DATA" => ast::Error::GettingData,
        _ => unreachable!(),
    };
    ast::PureNode::Value(ast::Value::Error(error))
}

fn build_string_constant(pair: Pair<Rule>) -> ast::PureNode {
    let v = pair.as_str().trim_matches('"').to_string();
    ast::PureNode::Value(ast::Value::Text(v))
}

fn build_numerical_constant(pair: Pair<Rule>) -> ast::PureNode {
    let num = parse_number(pair.as_str());
    num.map_or(
        ast::PureNode::Value(ast::Value::Error(ast::Error::Unspecified)),
        |v| ast::PureNode::Value(ast::Value::Number(v)),
    )
}

#[cfg(test)]
mod tests {
    use super::ast;
    use super::parse_number;
    use super::Parser;
    use crate::context::Context;
    use crate::test_utils::TestFetcher;
    use logisheets_base::CellId;
    use logisheets_base::{ExtBookId, NormalCellId, SheetId};

    // Need more tests
    #[test]
    fn parse_number_test() {
        let input = "3.14";
        let output = parse_number(input).unwrap();
        assert!((output - 3.14).abs() < 1e-10);
        let input = "3.14e+11";
        let output = parse_number(input).unwrap();
        assert!((output - 3.14e+11).abs() < 1e-10);
        let input = "3e+11";
        let output = parse_number(input).unwrap();
        assert!((output - 3e+11).abs() < 1e-10);
        let input = ".3";
        let output = parse_number(input).unwrap();
        assert!((output - 0.3).abs() < 1e-10);
        let input = "3";
        let output = parse_number(input).unwrap();
        assert!((output - 3.0).abs() < 1e-10);
        let input = "3.2";
        let output = parse_number(input).unwrap();
        assert!((output - 3.2).abs() < 1e-10);
    }

    #[test]
    fn parse_index_func_test() {
        let parser = Parser {};
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let f1 = "INDEX((A1:B2, C3:D4), 1, 2, 2)";
        let r1 = parser.parse(f1, &mut context).unwrap().pure;
        match r1 {
            ast::PureNode::Func(f) => {
                assert_eq!(f.args.len(), 4);
                let arg1 = f.args.get(0).unwrap();
                match &arg1.pure {
                    ast::PureNode::Func(comma) => match &comma.op {
                        ast::Operator::Comma => {
                            assert_eq!(comma.args.len(), 2);
                        }
                        _ => panic!(),
                    },
                    _ => panic!(),
                }
            }
            _ => panic!(),
        }
    }

    #[test]
    fn parse_prefix_op() {
        let parser = Parser {};
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let f1 = "-A1:B$2";
        let r1 = parser.parse(f1, &mut context).unwrap().pure;
        assert!(matches!(r1, ast::PureNode::Func(_)));
        let f1 = "-A1:B$2+2";
        let r1 = parser.parse(f1, &mut context).unwrap().pure;
        match r1 {
            ast::PureNode::Func(func) => {
                assert!(matches!(
                    func.op,
                    ast::Operator::Infix(ast::InfixOperator::Plus),
                ));
            }
            _ => panic!(),
        };
    }

    #[test]
    fn parse_prefix_op2() {
        let parser = Parser {};
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let f1 = "+K96-K97";
        let r1 = parser.parse(f1, &mut context).unwrap().pure;
        match r1 {
            ast::PureNode::Func(func) => {
                assert!(matches!(
                    func.op,
                    ast::Operator::Infix(ast::InfixOperator::Minus)
                ))
            }
            _ => panic!(),
        }
        let f1 = "BD199/+BD5";
        let r1 = parser.parse(f1, &mut context).unwrap().pure;
        match r1 {
            ast::PureNode::Func(func) => {
                assert!(matches!(
                    func.op,
                    ast::Operator::Infix(ast::InfixOperator::Divide)
                ));
                let mut args = func.args.into_iter();
                args.next().unwrap();
                let second = args.next().unwrap();
                match second.pure {
                    ast::PureNode::Func(_) => {}
                    _ => panic!(),
                }
            }
            _ => panic!(),
        }
    }

    #[test]
    fn parse_postfix_op() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f1 = "3.14%";
        let r1 = parser.parse(f1, &mut context).unwrap().pure;
        assert!(matches!(r1, ast::PureNode::Func(_)));
    }

    #[test]
    fn parse_infix_op() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "3+3.2";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
        let f = "3-3.2";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
        let f = "3*3.2";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
        let f = "3/3.2";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
        let f = "A1:B2 B2:C3";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
    }

    #[test]
    fn func_call() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "SUM(1,2)";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
        let f = "SUM(1,)";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
        let f = "SUM(1:2)";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Func(f) => {
                assert_eq!(f.args.len(), 1);
                let arg = f.args.into_iter().next().unwrap();
                assert!(matches!(arg.pure, ast::PureNode::Reference(_)))
            }
            _ => panic!(),
        }
    }

    #[test]
    fn prec() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "1+2*3";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Func(op) => {
                assert!(matches!(
                    op.op,
                    ast::Operator::Infix(ast::InfixOperator::Plus)
                ));
            }
            _ => panic!(),
        };
        let f = "(1+2)*3";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Func(op) => {
                assert!(matches!(
                    op.op,
                    ast::Operator::Infix(ast::InfixOperator::Multiply)
                ));
            }
            _ => panic!(),
        };
    }

    #[test]
    fn implicit_whitespace() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "1 + 2 * 3";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Func(op) => {
                assert!(matches!(
                    op.op,
                    ast::Operator::Infix(ast::InfixOperator::Plus)
                ));
            }
            _ => panic!(),
        };
        let f = "B2 : B3";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Reference(_)));
        let f = "B2  B3";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
        let f = "SUM( 1  , 2, 3 )";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Func(_)));
    }

    #[test]
    fn composite() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "-1 + SUM(1+3.14, 2)% * 3e-4";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Func(func) => {
                let ast::Func { op, args: _ } = func;
                assert!(matches!(op, ast::Operator::Infix(ast::InfixOperator::Plus)))
            }
            _ => panic!(),
        };
        let f = "1*(2-3)";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Func(func) => {
                let ast::Func { op, args: _ } = func;
                assert!(matches!(
                    op,
                    ast::Operator::Infix(ast::InfixOperator::Multiply)
                ))
            }
            _ => panic!(),
        };
    }

    #[test]
    fn name() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "\\costum_name.1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(
            r,
            ast::PureNode::Reference(ast::CellReference::Name(_)),
        ));
        let f = "workbook.xlsx!\\costum_name.1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(
            r,
            ast::PureNode::Reference(ast::CellReference::Name(_)),
        ));
    }

    #[test]
    fn constant() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "#N/A";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(
            r,
            ast::PureNode::Value(ast::Value::Error(ast::Error::Na))
        ));
        let f = "FALSE";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(
            r,
            ast::PureNode::Value(ast::Value::Boolean(false))
        ));
        let f = "FALSE";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(
            r,
            ast::PureNode::Value(ast::Value::Boolean(false))
        ));
        let f = "123.e-10";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Value(ast::Value::Number(_))));
        let f = ".123e-10";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Value(ast::Value::Number(_))));
        let f = "\"a\"\"b\"";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Value(ast::Value::Text(_))));
        let f = "1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(r, ast::PureNode::Value(ast::Value::Number(_))));
    }

    #[test]
    fn reference() {
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let parser = Parser {};
        let f = "sheet!A1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Reference(ast::CellReference::Mut(a1_ref)) => {
                assert_eq!(a1_ref.sheet_id, 5);
            }
            _ => panic!(),
        };
        let f = "[wb.xlsx]sheet!A1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Reference(ast::CellReference::UnMut(ast::UnMutRefWithPrefix {
                prefix: ast::UnMutRefPrefix::External(ast::ExternalUnMutRefPrefix::Sheet(s)),
                reference: _,
            })) => {
                assert_eq!(s.sheet, "sheet".len() as SheetId);
                assert_eq!(s.workbook, "wb.xlsx".len() as ExtBookId);
            }
            _ => panic!(),
        };
        let f = "[book]sheet!A1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Reference(ast::CellReference::Mut(a1_ref)) => {
                assert_eq!(a1_ref.sheet_id, 5);
            }
            _ => panic!(),
        };
        let f = "'[w,b.xlsx]sheet1:she,et2'!A1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Reference(ast::CellReference::UnMut(ast::UnMutRefWithPrefix {
                prefix:
                    ast::UnMutRefPrefix::External(ast::ExternalUnMutRefPrefix::SheetToSheet(sts)),
                reference: _,
            })) => {
                assert_eq!(sts.from_sheet, "sheet1".len() as SheetId);
                assert_eq!(sts.to_sheet, "she,et2".len() as SheetId);
                assert_eq!(sts.workbook, "w,b.xlsx".len() as ExtBookId);
            }
            _ => panic!(),
        };
        let f = "sheet:sheet2!A1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Reference(ast::CellReference::UnMut(ast::UnMutRefWithPrefix {
                prefix: ast::UnMutRefPrefix::Local(ast::LocalUnMutRefPrefix::SheetToSheet(sts)),
                reference: _,
            })) => {
                assert_eq!(sts.from_sheet, 5);
                assert_eq!(sts.to_sheet, 6);
            }
            _ => panic!(),
        };
        let f = "[book]sheet:sheet2!A1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Reference(ast::CellReference::UnMut(ast::UnMutRefWithPrefix {
                prefix: ast::UnMutRefPrefix::Local(ast::LocalUnMutRefPrefix::SheetToSheet(sts)),
                reference: _,
            })) => {
                assert_eq!(sts.from_sheet, 5);
                assert_eq!(sts.to_sheet, 6);
            }
            _ => panic!(),
        };
        let f = "'sh''eet'!A1";
        let r = parser.parse(f, &mut context).unwrap().pure;
        match r {
            ast::PureNode::Reference(ast::CellReference::Mut(a1_ref)) => {
                assert_eq!(a1_ref.sheet_id, 7);
            }
            _ => panic!(),
        };
        let f = "sh,eet!A1";
        let r = parser.parse(f, &mut context);
        assert!(matches!(r, None));
        let f = "$A1:B:$D";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(
            r,
            ast::PureNode::Reference(ast::CellReference::Mut(ast::MutRefWithPrefix {
                sheet_id: 1,
                reference: ast::MutRef::A1ReferenceRange(ast::A1ReferenceRange {
                    start: ast::A1Reference::Addr(ast::Address {
                        cell_id: CellId::NormalCell(NormalCellId {
                            row: 0,
                            col: 0,
                            follow_row: None,
                            follow_col: None,
                        }),
                        col_abs: true,
                        row_abs: false,
                    }),
                    end: ast::A1Reference::A1ColumnRange(ast::ColRange {
                        start: 2,
                        start_abs: false,
                        end: 4,
                        end_abs: true,
                    }),
                })
            }))
        ));
        let f = "$1:$2:$D3";
        let r = parser.parse(f, &mut context).unwrap().pure;
        assert!(matches!(
            r,
            ast::PureNode::Reference(ast::CellReference::Mut(ast::MutRefWithPrefix {
                sheet_id: 1,
                reference: ast::MutRef::A1ReferenceRange(ast::A1ReferenceRange {
                    start: ast::A1Reference::A1RowRange(ast::RowRange {
                        start: 1,
                        start_abs: true,
                        end: 2,
                        end_abs: true,
                    }),
                    end: ast::A1Reference::Addr(ast::Address {
                        cell_id: CellId::NormalCell(NormalCellId {
                            row: 2,
                            col: 3,
                            follow_row: None,
                            follow_col: None,
                        }),
                        col_abs: true,
                        row_abs: false,
                    }),
                })
            }))
        ));
    }

    #[test]
    fn func_with_bool_arg() {
        let parser = Parser {};
        let mut id_fetcher = TestFetcher {};
        let mut context = Context {
            sheet_id: 1,
            book_name: "book",
            id_fetcher: &mut id_fetcher,
        };
        let f = "NORM.S.DIST(2,TRUE)";
        let _ = parser.parse(f, &mut context).unwrap().pure;
    }
}
