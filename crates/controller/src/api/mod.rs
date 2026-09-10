pub use crate::{
    Comment, MergeCell, Style, Value,
    controller::display::{ColInfo, RowInfo},
    edit_action::EditAction,
    errors::{Error, ErrorMessage, Result},
};
mod block_policy;
mod cell_positioner;
mod duplicate_keys;
mod enum_sets;
mod field_validation;
mod fill;
mod pivot_plan;
mod sort_block;
mod types;
mod workbook;
mod worksheet;

#[cfg(test)]
mod test;
/// A pivot's recipe in its flat form. Re-exported here because `block_manager`
/// is private to this crate, and both the RPC layer and any embedder need to
/// name the type to declare a pivot.
pub use crate::block_manager::schema_manager::field_type::PivotSpecParts;
pub use block_policy::{BlockOpForPayload, BlockOpPolicy};
pub use duplicate_keys::DuplicateBlockKey;
pub use enum_sets::{EnumSetInfo, EnumVariantInfo};
pub use field_validation::FieldValidationVerdict;
pub use fill::FillRange;
pub use logisheets_base::BlockId;
pub use pivot_plan::{PivotExcelNote, PivotPlan};
pub use sort_block::BlockSortOrder;
pub use types::*;
pub use workbook::Workbook;
pub use worksheet::Worksheet;
