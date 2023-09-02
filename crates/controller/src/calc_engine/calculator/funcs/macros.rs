macro_rules! assert_or_return {
    ($cond:expr, $error:expr) => {
        if !$cond {
            return CalcVertex::from_error($error);
        }
    };
}

macro_rules! assert_f64_from_calc_value {
    ($var:ident, $value:expr) => {
        let _v = match $value {
            CalcValue::Scalar(v) => Some(v),
            _ => None,
        };
        if _v.is_none() {
            return CalcVertex::from_error(ast::Error::Num);
        }
        let _value = _v.unwrap();
        let _res = match _value {
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
        };
        if let Err(e) = _res {
            return CalcVertex::from_error(e);
        }
        let $var = _res.unwrap();
    };
}

macro_rules! assert_date_serial_num_from_calc_value {
    ($var:ident, $value:expr) => {
        use logisheets_base::datetime::parse_date_time;
        let _v = match $value {
            CalcValue::Scalar(v) => Some(v),
            _ => None,
        };
        if _v.is_none() {
            return CalcVertex::from_error(ast::Error::Num);
        }
        let _value = _v.unwrap();
        let _res = match _value {
            Value::Blank => Ok(0_f64),
            Value::Number(n) => Ok(n),
            Value::Text(t) => match t.parse::<f64>() {
                Ok(n) => Ok(n),
                Err(_) => match parse_date_time(&t) {
                    Some(f) => Ok(f),
                    None => Err(ast::Error::Value),
                },
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
        };
        if let Err(e) = _res {
            return CalcVertex::from_error(e);
        }
        let $var = _res.unwrap();
    };
}

macro_rules! assert_text_from_calc_value {
    ($var:ident, $value:expr) => {
        let _v = match $value {
            CalcValue::Scalar(v) => Some(v),
            _ => None,
        };
        if _v.is_none() {
            return CalcVertex::from_error(ast::Error::Num);
        }
        let _value = _v.unwrap();
        let _res = match _value {
            Value::Blank => Ok(String::from("")),
            Value::Number(n) => Ok(n.to_string()),
            Value::Text(t) => Ok(t),
            Value::Boolean(b) => {
                if b {
                    Ok(String::from("TRUE"))
                } else {
                    Ok(String::from("FALSE"))
                }
            }
            Value::Error(e) => Err(e),
            Value::Date(_) => todo!(),
        };
        if let Err(e) = _res {
            return CalcVertex::from_error(e);
        }
        let $var = _res.unwrap();
    };
}

macro_rules! assert_bool_from_calc_value {
    ($var:ident, $value:expr) => {
        let _v = match $value {
            CalcValue::Scalar(v) => Some(v),
            _ => None,
        };
        if _v.is_none() {
            return CalcVertex::from_error(ast::Error::Num);
        }
        let _value = _v.unwrap();
        let _res = match _value {
            Value::Boolean(b) => Ok(b),
            _ => Err(ast::Error::Num),
        };
        if let Err(e) = _res {
            return CalcVertex::from_error(e);
        }
        let $var = _res.unwrap();
    };
}
