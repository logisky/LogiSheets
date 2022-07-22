use std::collections::HashMap;

use logisheets_base::FuncId;
use logisheets_parser::ast::{self, Node};

pub struct AstChecker {
    registry: HashMap<FuncId, FuncSignature>,
}

impl AstChecker {
    pub fn func_check(&self, node: &ast::Node) -> Result<(), FuncCheckError> {
        match &node.pure {
            ast::PureNode::Func(f) => match &f.op {
                ast::Operator::Function(id) => {
                    if let Some(sign) = self.registry.get(id) {
                        let args = &f.args;
                        args_check(sign, args)
                    } else {
                        Ok(())
                    }
                }
                _ => Ok(()),
            },
            ast::PureNode::Value(_) => Ok(()),
            ast::PureNode::Reference(_) => Ok(()),
        }
    }
}

pub struct ArgDefIter<'a> {
    data: &'a Vec<ArgDef>,
    idx: usize,
    has_repeated: Option<usize>,
}

impl<'a> From<&'a Vec<ArgDef>> for ArgDefIter<'a> {
    fn from(data: &'a Vec<ArgDef>) -> Self {
        ArgDefIter {
            data,
            idx: 0,
            has_repeated: None,
        }
    }
}

impl<'a> Iterator for ArgDefIter<'a> {
    type Item = &'a ArgDef;

    fn next(&mut self) -> Option<Self::Item> {
        if self.idx < self.data.len() {
            let arg = self.data.get(self.idx).unwrap();
            if arg.start_repeated.unwrap_or(false) {
                self.has_repeated = Some(self.idx);
            }
            self.idx += 1;
            Some(arg)
        } else {
            if let Some(repeated) = self.has_repeated {
                self.idx = repeated + 1;
                Some(self.data.get(repeated).unwrap())
            } else {
                None
            }
        }
    }
}

#[derive(Debug)]
pub struct FuncSignature {
    pub id: FuncId,
    pub arg_count: ArgCount,
    pub args: Vec<ArgDef>,
}

#[derive(Debug, Clone)]
pub struct ArgCount {
    pub le: Option<u8>,
    pub ge: Option<u8>,
    pub eq: Option<u8>,
    pub odd: Option<bool>,
    pub even: Option<bool>,
}

fn arg_count_check(count_rule: &ArgCount, count: u8) -> bool {
    if let Some(limit) = count_rule.le {
        if !(count <= limit) {
            return false;
        }
    }
    if let Some(limit) = count_rule.ge {
        if !(count >= limit) {
            return false;
        }
    }
    if let Some(limit) = count_rule.eq {
        if !(count == limit) {
            return false;
        }
    }
    if let Some(b) = count_rule.odd {
        if b && count % 2 != 1 {
            return false;
        }
    }
    if let Some(b) = count_rule.even {
        if b && count % 2 != 0 {
            return false;
        }
    }
    true
}

#[derive(Debug, Clone)]
pub struct ArgDef {
    pub arg_name: String,
    pub ref_only: Option<bool>,
    pub start_repeated: Option<bool>,
}

impl ArgDef {
    pub fn unexpected_arg() -> Self {
        ArgDef {
            arg_name: String::from("Unexpected"),
            ref_only: None,
            start_repeated: None,
        }
    }
}

#[derive(Debug)]
pub struct FuncCheckError {
    pub id: FuncId,
    pub break_arg_count: Option<ArgCount>,
    pub break_args: Option<(usize, ArgDef)>,
}

fn args_check(sign: &FuncSignature, args: &Vec<Node>) -> Result<(), FuncCheckError> {
    let count_rule = &sign.arg_count;
    let count = args.len() as u8;
    if !arg_count_check(count_rule, count) {
        return Err(FuncCheckError {
            id: sign.id,
            break_args: None,
            break_arg_count: Some(count_rule.clone()),
        });
    }
    let mut args_iter = args.iter();
    let mut arg_rule_iter = ArgDefIter::from(&sign.args);
    let mut idx = 0usize;
    while let Some(arg) = args_iter.next() {
        let rule = arg_rule_iter.next();
        if rule.is_none() {
            return Err(FuncCheckError {
                id: sign.id,
                break_arg_count: None,
                break_args: Some((idx, ArgDef::unexpected_arg())),
            });
        }
        let arg_def = rule.unwrap();
        if !arg_def_check(arg_def, arg) {
            return Err(FuncCheckError {
                id: sign.id,
                break_arg_count: None,
                break_args: Some((idx, arg_def.clone())),
            });
        }
        idx += 1;
    }
    todo!()
}

fn arg_def_check(arg_def: &ArgDef, arg: &Node) -> bool {
    if arg_def.ref_only.unwrap_or(false) {
        match &arg.pure {
            ast::PureNode::Value(_) => return false,
            _ => {}
        };
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arg_count_check_test1() {
        let arg_count_rule = ArgCount {
            le: Some(5),
            ge: Some(2),
            eq: None,
            odd: None,
            even: None,
        };
        assert!(arg_count_check(&arg_count_rule, 3));
        assert!(arg_count_check(&arg_count_rule, 4));
        assert!(!arg_count_check(&arg_count_rule, 6));
        assert!(!arg_count_check(&arg_count_rule, 1));
    }

    #[test]
    fn arg_count_check_test2() {
        let arg_count_rule = ArgCount {
            le: None,
            ge: None,
            eq: Some(3),
            odd: None,
            even: None,
        };
        assert!(arg_count_check(&arg_count_rule, 3));
        assert!(!arg_count_check(&arg_count_rule, 4));
    }

    #[test]
    fn arg_count_check_test3() {
        let arg_count_rule = ArgCount {
            le: None,
            ge: None,
            eq: None,
            odd: Some(true),
            even: None,
        };
        assert!(arg_count_check(&arg_count_rule, 3));
        assert!(!arg_count_check(&arg_count_rule, 4));
        assert!(arg_count_check(&arg_count_rule, 5));
    }

    #[test]
    fn arg_count_check_test4() {
        let arg_count_rule = ArgCount {
            le: None,
            ge: None,
            eq: None,
            odd: None,
            even: Some(true),
        };
        assert!(!arg_count_check(&arg_count_rule, 3));
        assert!(arg_count_check(&arg_count_rule, 4));
        assert!(!arg_count_check(&arg_count_rule, 5));
        assert!(arg_count_check(&arg_count_rule, 6));
    }

    #[test]
    fn arg_def_iter_check() {
        let arg_def1 = ArgDef {
            arg_name: String::from("arg1"),
            ref_only: None,
            start_repeated: None,
        };
        let arg_def2 = ArgDef {
            arg_name: String::from("arg2"),
            ref_only: None,
            start_repeated: None,
        };
        let arg_def3 = ArgDef {
            arg_name: String::from("arg3"),
            ref_only: None,
            start_repeated: Some(true),
        };
        let arg_def4 = ArgDef {
            arg_name: String::from("arg4"),
            ref_only: None,
            start_repeated: None,
        };
        let arg_defs = vec![arg_def1, arg_def2, arg_def3, arg_def4];
        let mut iter = ArgDefIter::from(&arg_defs);
        assert_eq!(iter.next().unwrap().arg_name, "arg1");
        assert_eq!(iter.next().unwrap().arg_name, "arg2");
        assert_eq!(iter.next().unwrap().arg_name, "arg3");
        assert_eq!(iter.next().unwrap().arg_name, "arg4");
        assert_eq!(iter.next().unwrap().arg_name, "arg3");
        assert_eq!(iter.next().unwrap().arg_name, "arg4");
        assert_eq!(iter.next().unwrap().arg_name, "arg3");
        assert_eq!(iter.next().unwrap().arg_name, "arg4");
    }
}
