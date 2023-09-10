use crate::calc_engine::calculator::calc_vertex::Value;

#[derive(Debug, Clone)]
pub enum Condition<'a> {
    Logical(LogicalCondition),
    TextPattern(&'a str),
}
#[derive(Debug, Clone)]
pub struct LogicalCondition {
    pub op: Op,
    pub value: ConditionValue,
}

#[derive(Debug, Clone)]
pub enum Op {
    Eq,
    Ge,
    Gt,
    Le,
    Lt,
    Neq,
}

#[derive(Debug, Clone)]
pub enum ConditionValue {
    Number(f64),
    Text(String), // todo if using reference is available
}

pub fn parse_condition(text: &str) -> Option<Condition> {
    let text = text.trim();
    let mut chars = text.chars().peekable();
    let first = chars.next()?;
    let op: Option<Op> = match first {
        '>' => {
            if let Some('=') = chars.peek() {
                chars.next();
                Some(Op::Ge)
            } else {
                Some(Op::Gt)
            }
        }
        '<' => {
            let next = chars.peek();
            if let Some('=') = next {
                chars.next();
                Some(Op::Le)
            } else if let Some('>') = next {
                chars.next();
                Some(Op::Neq)
            } else {
                Some(Op::Lt)
            }
        }
        '=' => Some(Op::Eq),
        _ => None,
    };
    if let Some(op) = op {
        let s = chars.collect::<String>();
        let num = s.parse::<f64>();
        match num {
            Ok(n) => Some(Condition::Logical(LogicalCondition {
                op,
                value: ConditionValue::Number(n),
            })),
            Err(_) => Some(Condition::Logical(LogicalCondition {
                op,
                value: ConditionValue::Text(s),
            })),
        }
    } else {
        Some(Condition::TextPattern(&text))
    }
}

pub fn get_condition_value(value: &Value) -> ConditionValue {
    match value {
        Value::Blank => ConditionValue::Text(String::from("")),
        Value::Number(n) => ConditionValue::Number(n.clone()),
        Value::Text(t) => ConditionValue::Text(t.clone()),
        Value::Boolean(b) => {
            let value = if *b {
                String::from("TRUE")
            } else {
                String::from("FALSE")
            };
            ConditionValue::Text(value)
        }
        Value::Error(e) => ConditionValue::Text(e.get_err_str().to_string()),
    }
}

pub fn match_condition(cond: &Condition, value: &Value) -> bool {
    let v = get_condition_value(value);
    match (cond, v) {
        (Condition::Logical(l), ConditionValue::Number(lhs)) => match &l.value {
            ConditionValue::Number(rhs) => match &l.op {
                Op::Eq => lhs == *rhs,
                Op::Ge => lhs >= *rhs,
                Op::Gt => lhs > *rhs,
                Op::Le => lhs <= *rhs,
                Op::Lt => lhs < *rhs,
                Op::Neq => lhs != *rhs,
            },
            ConditionValue::Text(_) => match l.op {
                Op::Neq => true,
                _ => false,
            },
        },
        (Condition::Logical(l), ConditionValue::Text(lhs)) => match &l.value {
            ConditionValue::Number(_) => match &l.op {
                Op::Neq => true,
                _ => false,
            },
            ConditionValue::Text(rhs) => match &l.op {
                Op::Eq => match_text_pattern(rhs, &lhs),
                Op::Neq => !match_text_pattern(&rhs, &lhs),
                Op::Ge => lhs >= *rhs,
                Op::Gt => lhs > *rhs,
                Op::Le => lhs <= *rhs,
                Op::Lt => lhs < *rhs,
            },
        },
        (Condition::TextPattern(_), ConditionValue::Number(_)) => false,
        (Condition::TextPattern(p), ConditionValue::Text(t)) => match_text_pattern(p, &t),
    }
}

pub fn match_text_pattern(pattern: &str, text: &str) -> bool {
    let pattern = wildescape::WildMatch::new(pattern);
    pattern.matches(text)
}

#[cfg(test)]
mod tests {
    use super::{
        match_condition, match_text_pattern, parse_condition, Condition, ConditionValue,
        LogicalCondition, Op,
    };
    use crate::calc_engine::calculator::calc_vertex::Value;

    #[test]
    fn parse_number_condition_test1() {
        let text = ">5.4";
        let res = parse_condition(text);
        if let Some(Condition::Logical(LogicalCondition { op, value })) = res {
            assert!(matches!(op, Op::Gt));
            if let ConditionValue::Number(num) = value {
                assert!((num - 5.4).abs() < 1e-10);
            } else {
                panic!()
            }
        } else {
            panic!()
        }
    }

    #[test]
    fn parse_number_condition_test2() {
        let text = ">=5.4";
        let res = parse_condition(text);
        if let Some(Condition::Logical(LogicalCondition { op, value })) = res {
            assert!(matches!(op, Op::Ge));
            if let ConditionValue::Number(num) = value {
                assert!((num - 5.4).abs() < 1e-10);
            } else {
                panic!()
            }
        } else {
            panic!()
        }
    }

    #[test]
    fn parse_number_condition_test3() {
        let text = "=5";
        let res = parse_condition(text);
        if let Some(Condition::Logical(LogicalCondition { op, value })) = res {
            assert!(matches!(op, Op::Eq));
            if let ConditionValue::Number(num) = value {
                assert!((num - 5_f64).abs() < 1e-10);
            } else {
                panic!()
            }
        } else {
            panic!()
        }
    }

    #[test]
    fn parse_number_condition_test4() {
        let text = "<5";
        let res = parse_condition(text);
        if let Some(Condition::Logical(LogicalCondition { op, value })) = res {
            assert!(matches!(op, Op::Lt));
            if let ConditionValue::Number(num) = value {
                assert!((num - 5_f64).abs() < 1e-10);
            } else {
                panic!()
            }
        } else {
            panic!()
        }
    }

    #[test]
    fn parse_number_condition_test5() {
        let text = "<=5";
        let res = parse_condition(text);
        if let Some(Condition::Logical(LogicalCondition { op, value })) = res {
            assert!(matches!(op, Op::Le));
            if let ConditionValue::Number(num) = value {
                assert!((num - 5_f64).abs() < 1e-10);
            } else {
                panic!()
            }
        } else {
            panic!()
        }
    }

    #[test]
    fn parse_number_condition_test6() {
        let text = "<>5";
        let res = parse_condition(text);
        if let Some(Condition::Logical(LogicalCondition { op, value })) = res {
            assert!(matches!(op, Op::Neq));
            if let ConditionValue::Number(num) = value {
                assert!((num - 5_f64).abs() < 1e-10);
            } else {
                panic!()
            }
        } else {
            panic!()
        }
    }

    #[test]
    fn match_text_pattern_test1() {
        let p = "*123?5";
        let t = "44412365";
        let r = match_text_pattern(p, t);
        assert!(r);
        let t = "444123657";
        let r = match_text_pattern(p, t);
        assert!(!r);
    }

    #[test]
    fn match_condition_test1() {
        let cond = ">5";
        let condition = parse_condition(cond).unwrap();
        assert!(match_condition(&condition, &Value::Number(8_f64)));
    }
}
