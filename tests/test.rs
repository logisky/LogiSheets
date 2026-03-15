use std::fs;

use logiscript::execute_script;
use logisheets::Workbook;

pub fn test_script(path: &str) {
    println!("testing script: {:?}", path);
    let script = fs::read_to_string(path).unwrap();
    match execute_script(&script) {
        Some(error) => panic!("{:?}", error.to_string()),
        None => (),
    }
}

pub fn load_script(path: &str) -> Workbook {
    let script = fs::read_to_string(path).unwrap();
    logiscript::load_from_script(&script).unwrap()
}

#[cfg(test)]
mod block;

#[cfg(test)]
mod common;

#[cfg(test)]
mod funcs {

    use glob::glob;
    use logisheets::EditAction;

    use crate::{load_script, test_script};
    use logisheets_controller::edit_action::{BindFormSchema, CellInput, PayloadsAction};

    #[test]
    fn test_funcs() {
        let scripts = glob("tests/funcs/*.script").expect("");
        scripts.into_iter().for_each(|p| {
            let path = p.unwrap();
            let path = path.to_str().unwrap();
            test_script(path)
        });
    }

    #[test]
    fn test_block_ref() {
        let mut wb = load_script("tests/funcs/block_ref_data.script");
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new()
                .add_payload(BindFormSchema {
                    ref_name: "test_ref".to_string(),
                    sheet_idx: 0,
                    block_id: 1, // check it in the script
                    field_from: 1,
                    key_idx: 0,
                    fields: vec![String::from("field1"), String::from("field2")],
                    render_ids: vec![String::from("render1"), String::from("render2")],
                    row: true,
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 10,
                    col: 10,
                    content: String::from(r#"=BLOCKREF("test_ref", "key2", "field2")"#),
                })
                .add_payload(CellInput {
                    sheet_idx: 0,
                    row: 11,
                    col: 11,
                    content: String::from(r#"=SUM(BLOCKREFS("test_ref", "key*", "field2"))"#),
                }),
        ));
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(10, 10).unwrap();
        match v {
            logisheets::Value::Number(v) => assert_eq!(v, 8.0),
            _ => panic!("wrong result in blockref"),
        }
        let v = wb.get_sheet_by_idx(0).unwrap().get_value(11, 11).unwrap();
        match v {
            logisheets::Value::Number(v) => assert_eq!(v, 24.0),
            _ => panic!("wrong result in blockrefs"),
        }
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
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
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
    use logisheets::SheetDimension;

    #[test]
    fn test_value1() {
        use logisheets::{Value, Workbook};
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
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
    }

    #[ignore]
    #[test]
    fn test_save() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();

        let buf = wb.save().unwrap();
        fs::write("tests/6_save.xlsx", buf).unwrap()
    }

    #[test]
    fn test_formula1() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let f = ws.get_formula(9, 1).unwrap();
        assert_eq!(f, "B18")
    }

    #[test]
    fn test_style1() {
        use logisheets::{StUnderlineValues, Workbook};
        use std::fs;
        let mut buf = fs::read("tests/6.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("6")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let style = ws.get_style(9, 1).unwrap();
        let underline = style.font.underline.unwrap().val;
        assert!(matches!(underline, StUnderlineValues::Single));
        let SheetDimension {
            max_row: row_cnt,
            max_col: col_cnt,
            height: _,
            width: _,
        } = ws.get_sheet_dimension().unwrap();
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
        let wb = Workbook::from_file(&mut buf, String::from("builtin_style")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        let SheetDimension {
            max_row: row_cnt,
            max_col: col_cnt,
            height: _,
            width: _,
        } = ws.get_sheet_dimension().unwrap();
        for r in 0..row_cnt {
            for c in 0..col_cnt {
                let _ = ws.get_style(r, c).unwrap();
            }
        }
    }
}

#[cfg(test)]
mod test_7 {

    #[test]
    fn test_style() {
        use logisheets::Workbook;
        use std::fs;
        let mut buf = fs::read("tests/7.xlsx").unwrap();
        let wb = Workbook::from_file(&mut buf, String::from("7")).unwrap();
        let ws = wb.get_sheet_by_idx(0).unwrap();
        ws.get_display_window_response(0., 0., 100., 100.).unwrap();

        let a1_info = ws.get_cell_info(0, 0).unwrap();
        let s = a1_info.style;
        let f_color = s.font.color.unwrap();
        assert_eq!(f_color.red.unwrap(), 0.);
        assert_eq!(f_color.green.unwrap(), 0.);
        assert_eq!(f_color.blue.unwrap(), 0.);
        let c5_info = ws.get_cell_info(4, 2).unwrap();
        let _s = c5_info.style;
        // println!("{:?}", s.font.color);
        let row1 = ws.get_row_info(0).unwrap();
        assert!(row1.height > 70.);
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
