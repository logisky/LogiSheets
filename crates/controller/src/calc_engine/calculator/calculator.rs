use logisheets_parser::ast;

use super::calc_vertex::{CalcValue, CalcVertex, Value};

use super::super::connector::Connector;
use super::funcs;
use super::infix;

pub fn calc<C>(ast: &ast::Node, fetcher: &mut C) -> CalcValue
where
    C: Connector,
{
    let v = calc_node(ast, fetcher);
    fetcher.get_calc_value(v)
}

fn calc_node<C>(node: &ast::Node, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    match &node.pure {
        ast::PureNode::Value(v) => CalcVertex::Value(CalcValue::Scalar(Value::from_ast_value(v))),
        ast::PureNode::Func(f) => calc_func(f, fetcher),
        ast::PureNode::Reference(r) => fetcher.convert(r),
    }
}

fn calc_func<C>(func: &ast::Func, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    let args = func
        .args
        .iter()
        .map(|arg| calc_node(arg, fetcher))
        .collect::<Vec<_>>();
    let op = &func.op;
    match op {
        ast::Operator::Infix(op) => {
            let mut iter = args.into_iter();
            let lhs = iter.next().unwrap();
            let rhs = iter.next().unwrap();
            infix::calc_infix(lhs, op, rhs, fetcher)
        }
        ast::Operator::Prefix(p) => {
            let lhs = CalcVertex::Value(CalcValue::Scalar(Value::Number(0_f64)));
            let mut iter = args.into_iter();
            let rhs = iter.next().unwrap();
            let op = match p {
                ast::PrefixOperator::Minus => ast::InfixOperator::Minus,
                ast::PrefixOperator::Plus => ast::InfixOperator::Plus,
            };
            infix::calc_infix(lhs, &op, rhs, fetcher)
        }
        ast::Operator::Postfix(_) => {
            let mut iter = args.into_iter();
            let lhs = iter.next().unwrap();
            let rhs = CalcVertex::Value(CalcValue::Scalar(Value::Number(100_f64)));
            let op = ast::InfixOperator::Divide;
            infix::calc_infix(lhs, &op, rhs, fetcher)
        }
        ast::Operator::Function(fid) => {
            let name = fetcher.get_func_name(fid);
            match name {
                Some(func) => funcs::function_calculate(&func, args, fetcher),
                None => CalcVertex::from_error(ast::Error::Unspecified),
            }
        }
        ast::Operator::Comma => {
            let mut new_args = Vec::new();
            args.into_iter().for_each(|cv| match cv {
                CalcVertex::Union(cvs) => {
                    new_args.extend(cvs);
                }
                _ => new_args.push(Box::new(cv)),
            });
            CalcVertex::Union(new_args)
        }
    }
}
