#[cfg(test)]
mod funcs {
    use std::fs;

    use glob::glob;
    use logiscript::execute_script;

    #[test]
    fn test_funcs() {
        let scripts = glob("tests/funcs/*.script").expect("");
        scripts.into_iter().for_each(|p| {
            let path = p.unwrap();
            println!("testing script: {:?}", path.display());
            let script = fs::read_to_string(path).unwrap();
            match execute_script(&script) {
                Some(error) => panic!("{:?}", error.to_string()),
                None => (),
            };
        });
    }
}
#[cfg(test)]
mod shift;

#[cfg(test)]
mod test_builtin_style {
    #[test]
    fn test_builtin1() {
        use logisheets::Workbook;
        use logisheets_controller::Fill;
        use std::fs;
        let mut buf = fs::read("tests/builtin_style.xlsx").unwrap();
        let mut wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let mut ws = wb.get_sheet_by_idx(0).unwrap();
        let s = ws.get_style(3, 1).unwrap();
        match s.fill {
            Fill::PatternFill(f) => {
                if let Some(_) = f.fg_color {
                } else {
                    panic!()
                }
            }
            Fill::GradientFill(_) => todo!(),
        }
    }
}

#[cfg(test)]
mod test_6 {
    #[test]
    fn test_value1() {
        use logisheets::{Value, Workbook};
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let mut wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let mut ws = wb.get_sheet_by_idx(0).unwrap();
        let v = ws.get_value(9, 1).unwrap();
        match v {
            Value::Number(f) => assert_eq!(f, 32.0),
            _ => panic!(),
        }
        let v = ws.get_value(8, 1).unwrap();
        match v {
            Value::Str(f) => assert_eq!(f, "Q1"),
            _ => panic!(),
        }
        let v = ws.get_value(100, 1).unwrap();
        match v {
            Value::Empty => {}
            _ => panic!(),
        };
        let buf = wb.save().unwrap();
        fs::write("tests/6_save.xlsx", buf).unwrap()
    }

    #[test]
    fn test_formula1() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let mut wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let mut ws = wb.get_sheet_by_idx(0).unwrap();
        let f = ws.get_formula(9, 1).unwrap();
        assert_eq!(f, "B18")
    }

    #[test]
    fn test_style1() {
        use logisheets::{StUnderlineValues, Workbook};
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let mut wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let mut ws = wb.get_sheet_by_idx(0).unwrap();
        let style = ws.get_style(9, 1).unwrap();
        let underline = style.font.underline.unwrap().val;
        assert!(matches!(underline, StUnderlineValues::Single));
        let (row_cnt, col_cnt) = ws.get_sheet_dimension();
        for r in 0..row_cnt {
            for c in 0..col_cnt {
                let _ = ws.get_style(r, c).unwrap();
            }
        }
    }

    #[test]
    fn test_style2() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/builtin_style.xlsx").unwrap();
        let mut wb = Workbook::from_file(&mut buf, String::from("builtin_style")).unwrap();
        let mut ws = wb.get_sheet_by_idx(0).unwrap();
        let (row_cnt, col_cnt) = ws.get_sheet_dimension();
        for r in 0..row_cnt {
            for c in 0..col_cnt {
                let _ = ws.get_style(r, c).unwrap();
            }
        }
    }
}

#[cfg(test)]
mod calc_test {
    use logisheets::Workbook;
    use std::fs;
    #[test]
    fn test_calc_test() {
        let mut buf = fs::read("tests/calc_test.xlsx").unwrap();
        let _ = Workbook::from_file(&mut buf, String::from("calc_test")).unwrap();
    }
}
