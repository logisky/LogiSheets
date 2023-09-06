use super::{CalcValue, CalcVertex, Value};
use crate::calc_engine::{
    calculator::calc_vertex::{CalcReference, Reference},
    connector::Connector,
};
use logisheets_base::{column_label_to_index, Addr};
use logisheets_parser::ast;
use regex::Regex;

pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() >= 1 && args.len() <= 2, ast::Error::Unspecified);
    let mut args_iter = args.into_iter();
    let first = fetcher.get_calc_value(args_iter.next().unwrap());
    assert_text_from_calc_value!(r, first);
    let a1_ref = if let Some(arg) = args_iter.next() {
        assert_bool_from_calc_value!(b, fetcher.get_calc_value(arg));
        b
    } else {
        true
    };
    let result = if a1_ref {
        parse_a1_ref(&r)
    } else {
        parse_r1c1_ref(&r)
    };
    assert_or_return!(result.is_some(), ast::Error::Value);

    let (sheet_name, row_idx, col_idx) = result.unwrap();
    let mut sheet_id = fetcher.get_active_sheet();
    if let Some(name) = sheet_name {
        if let Ok(id) = fetcher.get_sheet_id_by_name(&name) {
            sheet_id = id;
        }
    };
    CalcVertex::Reference(CalcReference {
        from_sheet: None,
        sheet: sheet_id,
        reference: Reference::Addr(Addr {
            row: row_idx,
            col: col_idx,
        }),
    })
}

fn parse_a1_ref(s: &str) -> Option<(Option<String>, usize, usize)> {
    let r = Regex::new(r#"((.+)!)?\$?([A-Z]+)\$?([0-9]+)"#).unwrap();
    let capture = r.captures_iter(s).next()?;
    let sheet_name = if let Some(s) = capture.get(2) {
        Some(s.as_str().to_string())
    } else {
        None
    };
    let col_str = capture.get(3)?;
    let row_str = capture.get(4)?;
    let col = column_label_to_index(col_str.as_str());
    let row = row_str.as_str().parse::<usize>().ok()? - 1;
    Some((sheet_name, row, col))
}

fn parse_r1c1_ref(s: &str) -> Option<(Option<String>, usize, usize)> {
    let r = Regex::new(r#"((.+?)!)[Rr]([0-9]+)[Cc]([0-9]+)"#).unwrap();
    let capture = r.captures_iter(s).next()?;
    let sheet_name = if let Some(s) = capture.get(2) {
        Some(s.as_str().to_string())
    } else {
        None
    };
    let row_str = capture.get(3)?;
    let col_str = capture.get(4)?;
    let row = row_str.as_str().parse::<usize>().ok()? - 1;
    let col = col_str.as_str().parse::<usize>().ok()? - 1;
    Some((sheet_name, row, col))
}

#[cfg(test)]
mod tests {
    use super::parse_a1_ref;

    #[test]
    fn test_a1_ref() {
        let r1 = "L2";
        parse_a1_ref(r1).unwrap();
        let r2 = "$L2";
        parse_a1_ref(r2).unwrap();
        let r3 = "$L$2";
        parse_a1_ref(r3).unwrap();
        let r4 = "L$2";
        parse_a1_ref(r4).unwrap();
        let r5 = "Sheet1!L$2";
        let (s, _, _) = parse_a1_ref(r5).unwrap();
        assert_eq!(s.unwrap(), "Sheet1");
    }
}
