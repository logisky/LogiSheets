use crate::calc_engine::connector::Connector;

use super::{CalcValue, CalcVertex, Value};

use logisheets_parser::ast;

/// `HYPERLINK(link_location, [friendly_name])` — the cell shows
/// `friendly_name`, or `link_location` when it is omitted. Following the link
/// is the host's job: `Workbook::get_hyperlink` evaluates `link_location` on
/// demand, so the value here is only what to display.
///
/// An error in `link_location` is the result even when a friendly name is
/// given, as in Excel: a link that cannot be resolved should not look fine.
pub fn calc<C>(args: Vec<CalcVertex>, fetcher: &mut C) -> CalcVertex
where
    C: Connector,
{
    assert_or_return!(args.len() == 1 || args.len() == 2, ast::Error::Unspecified);
    let mut args = args.into_iter();
    let Some(link) = args.next() else {
        return CalcVertex::from_error(ast::Error::Unspecified);
    };
    let link = match fetcher.get_calc_value(link) {
        CalcValue::Scalar(v) => v,
        _ => return CalcVertex::from_error(ast::Error::Value),
    };
    if let Value::Error(e) = link {
        return CalcVertex::from_error(e);
    }
    let shown = match args.next() {
        None => link,
        Some(name) => match fetcher.get_calc_value(name) {
            CalcValue::Scalar(v) => v,
            _ => return CalcVertex::from_error(ast::Error::Value),
        },
    };
    CalcVertex::Value(CalcValue::Scalar(shown))
}
