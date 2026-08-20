pub use logisheets_controller::{SerdeErr, api::*, lex_success};

pub use logisheets_workbook::prelude::*;

// Both globs above carry a `Worksheet`: the controller's borrowed view of a live
// sheet, and the workbook crate's owned OOXML part. Which one a consumer got
// depended on the order of those two lines. The engine API is what this crate is
// for, so name that one — an explicit re-export beats a glob, which settles the
// ambiguity instead of muting it. The OOXML struct stays reachable as
// `logisheets_workbook::workbook::Worksheet`.
pub use logisheets_controller::api::Worksheet;
