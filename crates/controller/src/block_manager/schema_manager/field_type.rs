//! What a block field *is*, as opposed to what rules currently guard it.
//!
//! Until now this lived only in the host (`packages/engine/.../field_manager.ts`),
//! persisted as an opaque JSON blob the engine stored and never read — so a
//! headless host had no field semantics at all, and `describe_block` could not
//! report a type in any host. See `design/block-field-semantics.md`.
//!
//! Deliberately narrow. A field type carries only what is intrinsic to the
//! type; three neighbouring concerns stay where they already live, and each
//! omission is the reason this enum stays small:
//!
//!   - **Validation formulas** are not here. The host's `FieldTypeEnum` embeds
//!     a composed `validation` string inside several variants; that string is
//!     the *lowering* of the declaration, and keeping both would be the
//!     duplication this work exists to remove. The user's own rule lives in
//!     `FieldEntry::validation_formula`; the derived one is generated from the
//!     declaration.
//!   - **Number / date formatters** are not here. They are already persisted
//!     per render id by `FieldRenderManager`, which is a rendering concern.
//!   - **Enum variant colours** are not here. Ids and labels are the engine's
//!     business because a membership check needs them; colour is presentation
//!     and stays in the host's `EnumSetManager`, keyed by variant id.

use gents_derives::TS;
use logisheets_base::{BlockId, SheetId};

/// The declared type of a block field — strong in Rust, flat on the wire.
///
/// `Unspecified` is the explicit "not decided" state, not an error: a block
/// bound before this existed, or converted from plain cells, has fields whose
/// type nobody has claimed. It reads as free-form.
///
/// The TS-binding derive supports only unit and newtype enum variants, and a
/// newtype variant would nest the payload under `value` anyway — so this type
/// deliberately carries no `TS` derive. It crosses both boundaries (the wasm
/// RPC and `logisheets/data.xml`) as [`FieldTypeParts`], which means there is
/// exactly ONE flat representation to reason about rather than a wire shape and
/// a separate on-disk shape, and the conversion is checked in one place.
#[derive(Debug, Clone, PartialEq)]
pub enum FieldType {
    Unspecified,
    /// Free text. `string` on the wire, matching the host's long-standing tag.
    Text,
    Number,
    Boolean,
    Datetime,
    Image,
    /// One value out of a named set. `set_id` names an entry in the workbook's
    /// enum table.
    Enum {
        set_id: String,
    },
    /// Several values out of a named set, stored comma-separated in the cell.
    MultiSelect {
        set_id: String,
    },
    /// One value drawn from another block's field — a foreign key in all but
    /// name. Left as an ordinary field type for now; promoting it to a
    /// first-class relation (and surfacing the workbook's schema graph) is a
    /// separate decision, recorded in the design note.
    FieldRef {
        sheet_id: SheetId,
        block_id: BlockId,
        field_name: String,
    },
    /// The multi-valued form of [`FieldType::FieldRef`].
    MultiSelectRef {
        sheet_id: SheetId,
        block_id: BlockId,
        field_name: String,
    },
}

impl Default for FieldType {
    fn default() -> Self {
        FieldType::Unspecified
    }
}

impl FieldType {
    /// The wire tag, and the `kind` attribute this type is persisted under.
    pub fn kind(&self) -> &'static str {
        match self {
            FieldType::Unspecified => "unspecified",
            FieldType::Text => "string",
            FieldType::Number => "number",
            FieldType::Boolean => "boolean",
            FieldType::Datetime => "datetime",
            FieldType::Image => "image",
            FieldType::Enum { .. } => "enum",
            FieldType::MultiSelect { .. } => "multiSelect",
            FieldType::FieldRef { .. } => "fieldRef",
            FieldType::MultiSelectRef { .. } => "multiSelectRef",
        }
    }

    /// Whether this type constrains a cell's value to a set of options —
    /// `enum`, `multiSelect`, and the two reference forms. The membership
    /// check that stage 2 derives applies to exactly these.
    pub fn is_membership(&self) -> bool {
        matches!(
            self,
            FieldType::Enum { .. }
                | FieldType::MultiSelect { .. }
                | FieldType::FieldRef { .. }
                | FieldType::MultiSelectRef { .. }
        )
    }

    /// The enum set this type draws its options from, if any.
    pub fn enum_set_id(&self) -> Option<&str> {
        match self {
            FieldType::Enum { set_id } | FieldType::MultiSelect { set_id } => Some(set_id),
            _ => None,
        }
    }

    /// The block field this type points at, if any.
    pub fn ref_target(&self) -> Option<(SheetId, BlockId, &str)> {
        match self {
            FieldType::FieldRef {
                sheet_id,
                block_id,
                field_name,
            }
            | FieldType::MultiSelectRef {
                sheet_id,
                block_id,
                field_name,
            } => Some((*sheet_id, *block_id, field_name)),
            _ => None,
        }
    }

    /// Rebuild from the flat attribute set used on disk. Anything that does
    /// not name a known kind, or names one whose payload is missing, reads as
    /// `Unspecified` — a file written by a newer build must still open.
    pub fn from_parts(
        kind: Option<&str>,
        set_id: Option<&str>,
        ref_sheet_id: Option<SheetId>,
        ref_block_id: Option<BlockId>,
        ref_field_name: Option<&str>,
    ) -> Self {
        let named_set = |ctor: fn(String) -> FieldType| {
            set_id
                .map(|s| ctor(s.to_string()))
                .unwrap_or(FieldType::Unspecified)
        };
        let reference = |ctor: fn(SheetId, BlockId, String) -> FieldType| match (
            ref_sheet_id,
            ref_block_id,
            ref_field_name,
        ) {
            (Some(s), Some(b), Some(f)) => ctor(s, b, f.to_string()),
            _ => FieldType::Unspecified,
        };
        match kind {
            Some("string") => FieldType::Text,
            Some("number") => FieldType::Number,
            Some("boolean") => FieldType::Boolean,
            Some("datetime") => FieldType::Datetime,
            Some("image") => FieldType::Image,
            Some("enum") => named_set(|set_id| FieldType::Enum { set_id }),
            Some("multiSelect") => named_set(|set_id| FieldType::MultiSelect { set_id }),
            Some("fieldRef") => reference(|sheet_id, block_id, field_name| FieldType::FieldRef {
                sheet_id,
                block_id,
                field_name,
            }),
            Some("multiSelectRef") => {
                reference(|sheet_id, block_id, field_name| FieldType::MultiSelectRef {
                    sheet_id,
                    block_id,
                    field_name,
                })
            }
            _ => FieldType::Unspecified,
        }
    }
}

/// [`FieldType`] flattened for transport: a `kind` plus whichever payload
/// attributes that kind needs. Every field is optional, so a reader that meets
/// a kind it does not know — a file from a newer build — degrades to
/// `Unspecified` instead of failing to load.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "block_field_type.ts", rename_all = "camelCase")]
pub struct FieldTypeParts {
    /// `unspecified` | `string` | `number` | `boolean` | `datetime` | `image`
    /// | `enum` | `multiSelect` | `fieldRef` | `multiSelectRef`.
    pub kind: Option<String>,
    /// Set to draw options from, for `enum` / `multiSelect`.
    pub enum_set_id: Option<String>,
    /// Target of a `fieldRef` / `multiSelectRef`.
    pub ref_sheet_id: Option<SheetId>,
    pub ref_block_id: Option<BlockId>,
    pub ref_field_name: Option<String>,
}

impl FieldType {
    /// Flatten for transport. `Unspecified` flattens to all-`None` so it costs
    /// nothing on the wire or on disk.
    pub fn to_parts(&self) -> FieldTypeParts {
        if matches!(self, FieldType::Unspecified) {
            return FieldTypeParts::default();
        }
        let target = self.ref_target();
        FieldTypeParts {
            kind: Some(self.kind().to_string()),
            enum_set_id: self.enum_set_id().map(|s| s.to_string()),
            ref_sheet_id: target.map(|(s, _, _)| s),
            ref_block_id: target.map(|(_, b, _)| b),
            ref_field_name: target.map(|(_, _, f)| f.to_string()),
        }
    }
}

impl From<FieldTypeParts> for FieldType {
    fn from(p: FieldTypeParts) -> Self {
        FieldType::from_parts(
            p.kind.as_deref(),
            p.enum_set_id.as_deref(),
            p.ref_sheet_id,
            p.ref_block_id,
            p.ref_field_name.as_deref(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_type_survives_being_flattened_to_attributes_and_back() {
        let cases = vec![
            FieldType::Unspecified,
            FieldType::Text,
            FieldType::Number,
            FieldType::Boolean,
            FieldType::Datetime,
            FieldType::Image,
            FieldType::Enum {
                set_id: "status".into(),
            },
            FieldType::MultiSelect {
                set_id: "tags".into(),
            },
            FieldType::FieldRef {
                sheet_id: 2,
                block_id: 5,
                field_name: "customer".into(),
            },
            FieldType::MultiSelectRef {
                sheet_id: 2,
                block_id: 5,
                field_name: "customer".into(),
            },
        ];
        for ty in cases {
            let round_tripped: FieldType = ty.to_parts().into();
            assert_eq!(round_tripped, ty, "{:?} did not survive the round trip", ty);
        }
    }

    #[test]
    fn an_unknown_or_incomplete_type_reads_as_unspecified() {
        // A file written by a newer build, or one whose payload attributes went
        // missing, must still open — as free-form, not as a load failure.
        assert_eq!(
            FieldType::from_parts(Some("someFutureKind"), None, None, None, None),
            FieldType::Unspecified
        );
        assert_eq!(
            FieldType::from_parts(Some("enum"), None, None, None, None),
            FieldType::Unspecified,
            "an enum with no set to draw from is not an enum"
        );
        assert_eq!(
            FieldType::from_parts(Some("fieldRef"), None, Some(1), None, Some("f")),
            FieldType::Unspecified,
            "a reference missing half its target is not a reference"
        );
        assert_eq!(
            FieldType::from_parts(None, None, None, None, None),
            FieldType::Unspecified
        );
    }
}

/// Who may write to a field's cells, declared on the field.
///
/// This lived only in the host as a tri-state `userEditable?: boolean` on
/// `FieldInfo` — the last thing the host store was authoritative for, and
/// therefore the last field-level rule a headless host could not see. Named
/// rather than tri-state boolean because `undefined` carrying a third meaning
/// is exactly the sort of thing every reader has to be told; see
/// `design/block-field-semantics.md`.
///
/// Like the block-level [`ModifyPolicy`](crate::edit_action::ModifyPolicy),
/// this is a DECLARATION the engine persists and answers questions about — not
/// something it enforces. The engine does not know who is writing; the host
/// does, so the host decides with this in hand. (The per-record editability
/// FORMULA is different: it *is* enforced, through a `UserEditable` shadow the
/// host permission layer reads.)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum FieldWritePolicy {
    /// Nobody said. Falls back to the block's own owner / policy rules — which
    /// is what a field with no declaration has always done.
    #[default]
    Inherit,
    /// Closed to anyone but the block's owner.
    OwnerOnly,
    /// Open to anyone, overriding the block's owner rules.
    Anyone,
}

impl FieldWritePolicy {
    pub fn as_str(&self) -> &'static str {
        match self {
            FieldWritePolicy::Inherit => "inherit",
            FieldWritePolicy::OwnerOnly => "ownerOnly",
            FieldWritePolicy::Anyone => "anyone",
        }
    }

    /// Anything unrecognized reads as `Inherit` — a policy a newer build
    /// introduced must not stop this one from opening the file, and falling
    /// back to the block's rules is the safe reading rather than the open one.
    pub fn from_str(s: Option<&str>) -> Self {
        match s {
            Some("ownerOnly") => FieldWritePolicy::OwnerOnly,
            Some("anyone") => FieldWritePolicy::Anyone,
            _ => FieldWritePolicy::Inherit,
        }
    }

    /// The host's legacy tri-state flag, for the migration that adopts it.
    /// `false` locked the field, `true` opened it, absent inherited.
    pub fn from_legacy_flag(flag: Option<bool>) -> Self {
        match flag {
            Some(false) => FieldWritePolicy::OwnerOnly,
            Some(true) => FieldWritePolicy::Anyone,
            None => FieldWritePolicy::Inherit,
        }
    }
}

#[cfg(test)]
mod write_policy_tests {
    use super::*;

    #[test]
    fn a_policy_round_trips_through_its_wire_name() {
        for p in [
            FieldWritePolicy::Inherit,
            FieldWritePolicy::OwnerOnly,
            FieldWritePolicy::Anyone,
        ] {
            assert_eq!(FieldWritePolicy::from_str(Some(p.as_str())), p);
        }
    }

    #[test]
    fn an_unknown_policy_inherits_rather_than_opening_up() {
        // A file from a newer build must open, and the safe reading of a policy
        // this build cannot interpret is the block's own rules — not "anyone".
        assert_eq!(
            FieldWritePolicy::from_str(Some("somethingNew")),
            FieldWritePolicy::Inherit
        );
        assert_eq!(FieldWritePolicy::from_str(None), FieldWritePolicy::Inherit);
    }

    #[test]
    fn the_hosts_tri_state_flag_maps_onto_the_three_policies() {
        assert_eq!(
            FieldWritePolicy::from_legacy_flag(Some(false)),
            FieldWritePolicy::OwnerOnly
        );
        assert_eq!(
            FieldWritePolicy::from_legacy_flag(Some(true)),
            FieldWritePolicy::Anyone
        );
        assert_eq!(
            FieldWritePolicy::from_legacy_flag(None),
            FieldWritePolicy::Inherit
        );
    }
}

/// How an analysis field aggregates its source.
///
/// Deliberately a closed set rather than a free-form formula. A declared
/// function can be REGENERATED — rename the source field or the source block
/// and the engine rebuilds the formula from the current names; a stored string
/// cannot, and goes stale silently (see
/// `a_blockrefs_naming_a_field_that_does_not_exist_matches_nothing`). An escape
/// hatch for arbitrary expressions is deliberately the last thing to add, not
/// the first.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AggFunc {
    Sum,
    /// Numeric count — blanks and text are not counted.
    Count,
    /// Non-empty count, of any type. Genuinely different from [`AggFunc::Count`]
    /// wherever a column holds text or gaps: over `10, 20, "n/a", <blank>`
    /// COUNT says 2 and COUNTA says 3.
    ///
    /// It is the one aggregate with no `*IFS` form — there is no `COUNTAIFS` —
    /// so a pivot lowers it to `COUNTIFS` with the measure tested for
    /// non-blankness as a criteria pair. See `analysis::pivot_formula`.
    CountA,
    Average,
    Min,
    Max,
}

impl AggFunc {
    /// The spreadsheet function this lowers to, and the name it goes by on the
    /// wire and on disk.
    pub fn as_str(&self) -> &'static str {
        match self {
            AggFunc::Sum => "SUM",
            AggFunc::Count => "COUNT",
            AggFunc::CountA => "COUNTA",
            AggFunc::Average => "AVERAGE",
            AggFunc::Min => "MIN",
            AggFunc::Max => "MAX",
        }
    }

    /// `None` for anything unrecognized — a function a newer build introduced
    /// must not stop this one from opening the file, and a field whose
    /// aggregate cannot be interpreted is better left with no formula than
    /// with a guess.
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "SUM" => Some(AggFunc::Sum),
            "COUNT" => Some(AggFunc::Count),
            "COUNTA" => Some(AggFunc::CountA),
            "AVERAGE" => Some(AggFunc::Average),
            "MIN" => Some(AggFunc::Min),
            "MAX" => Some(AggFunc::Max),
            _ => None,
        }
    }
}

/// One analysis field's declaration: which function, over which field of the
/// block being analysed.
///
/// The source field is named, not id-referenced, because the generated formula
/// reaches it through `BLOCKREFSB`'s field filter, which matches on names. That
/// is also why re-materialization has to be triggered when the source block is
/// re-bound — see `design/block-analysis.md` §4.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FieldAggregate {
    pub func: AggFunc,
    pub source_field: String,
}

/// How a pivot orders the distinct values it turns into rows and columns.
///
/// It has to be deterministic, or every refresh reshuffles the sheet and its
/// diffs become noise.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DimOrder {
    /// Sorted with the same typed comparison as `sort_block` — numbers
    /// numerically, text lexicographically, blanks last — so "sorted" means one
    /// thing across the product. The default.
    Ascending,
    /// The order the values first occur in the source. For dimensions where
    /// sorting is wrong (month names, size ladders). Stable only while the
    /// source is not reordered, which is why it is not the default.
    FirstSeen,
    /// A caller-given sequence, in `PivotSpec::order_values`. For the case
    /// neither of the others can express — month names, size ladders, a
    /// reporting order the business just has.
    ///
    /// Values NOT in the list are not dropped: they follow, in ascending
    /// order. A custom order that silently hid a new group would be the
    /// staleness bug this whole design exists to prevent.
    Custom,
}

impl DimOrder {
    pub fn as_str(&self) -> &'static str {
        match self {
            DimOrder::Ascending => "ascending",
            DimOrder::FirstSeen => "firstSeen",
            DimOrder::Custom => "custom",
        }
    }

    /// Unrecognized reads as the default, for the same reason `AggFunc` reads
    /// as `None`: an order a newer build introduces must not stop this one from
    /// opening the file. Falling back to a deterministic order is safe here —
    /// unlike an aggregate function, where guessing would invent a number.
    pub fn from_str(s: &str) -> Self {
        match s {
            "firstSeen" => DimOrder::FirstSeen,
            "custom" => DimOrder::Custom,
            _ => DimOrder::Ascending,
        }
    }
}

impl Default for DimOrder {
    fn default() -> Self {
        DimOrder::Ascending
    }
}

/// A pivot: the recipe that a block's cells AND its shape are both derived
/// from. Lives beside `analyzes` on the block, not on its fields, because
/// every value cell of a pivot computes the same thing — only the two
/// dimension values differ, and those come from the cell's own row and column.
///
/// The block's KEYS are `distinct(source[row_dim])` and its FIELDS are
/// `distinct(source[col_dim])`, which is why the shape cannot be a formula:
/// no formula adds a row. The engine computes the shape (`pivot_plan`) and a
/// host applies it. See `design/block-pivot.md`.
///
/// Field names are dimension VALUES, so nothing per-field is stored: a cell's
/// column filter is its field's name and its row filter is `#KEY`. Renaming a
/// pivot column therefore changes what it filters on, coherently.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PivotSpec {
    /// Source field whose distinct values become this block's keys (rows).
    pub row_dim: String,
    /// Source field whose distinct values become this block's fields
    /// (columns). `None` is the degenerate pivot: a plain group-by with a
    /// single value column and no column filter.
    pub col_dim: Option<String>,
    /// The source field being aggregated.
    pub measure: String,
    pub func: AggFunc,
    pub order: DimOrder,
    /// The sequence for [`DimOrder::Custom`]; ignored otherwise.
    pub order_values: Vec<String>,
    /// Which source records this pivot counts at all. Empty means every one.
    ///
    /// Applied in BOTH places or the pivot lies: as extra criteria pairs in
    /// each cell's formula, AND when the plan collects distinct values — or a
    /// filtered-out group would still get a row, showing a confident 0.
    pub filters: Vec<PivotFilter>,
}

/// One condition a source record must meet to be counted by a pivot.
///
/// `criteria` is the spreadsheet's own condition syntax — `">100"`, `"East"`,
/// `"<>closed"` — because that is what `SUMIFS` takes and what
/// `match_condition` evaluates. Using one syntax for the formula and for the
/// plan is what keeps the rows a pivot shows and the numbers in them agreeing.
#[derive(Debug, Clone, Default, PartialEq, Eq, TS)]
#[ts(file_name = "pivot_filter.ts", rename_all = "camelCase")]
pub struct PivotFilter {
    pub field: String,
    /// Spreadsheet condition syntax: `">100"`, `"East"`, `"<>closed"`.
    pub criteria: String,
}

impl PivotSpec {
    /// Every source field this pivot reads, for callers that need to know
    /// whether a rename or a re-bind of the source affects it.
    pub fn source_fields(&self) -> Vec<&str> {
        let mut out = vec![self.row_dim.as_str(), self.measure.as_str()];
        if let Some(c) = &self.col_dim {
            out.push(c.as_str());
        }
        out.extend(self.filters.iter().map(|f| f.field.as_str()));
        out
    }

    /// The measure and function a given column computes with: its own
    /// override when it has one, the block's otherwise.
    pub fn effective<'a>(&'a self, column: Option<&'a PivotColumn>) -> (&'a str, AggFunc) {
        match column {
            Some(c) => (
                c.measure.as_deref().unwrap_or(&self.measure),
                c.func.unwrap_or(self.func),
            ),
            None => (&self.measure, self.func),
        }
    }
}

/// One pivot COLUMN's own declaration, overriding the block-level recipe.
///
/// A pivot's columns are normally derived: the field's name is the column
/// dimension's value, and the measure and function come from the block. That
/// covers a plain cross-tab and needs nothing stored per field.
///
/// Two things it cannot express, and this is what they need:
///
/// - a **row total** — a column that spans every value of the column
///   dimension rather than one of them (`col_value: None`);
/// - a **second measure** — `SUM of amt` beside `COUNT of orders`, both
///   against the same rows (`measure` / `func` set).
///
/// Every field is `None` by default, which is exactly today's behaviour, so a
/// pivot built before this existed keeps deriving everything.
///
/// **A column carrying any of these is hand-declared, so a refresh leaves it
/// alone** — the plan manages only the columns it derives. That is what stops
/// a total column being dropped as "a value the source no longer has".
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PivotColumn {
    /// The column-dimension value this column filters on. `None` spans every
    /// value — a row total.
    pub col_value: Option<String>,
    /// Aggregate this source field instead of the block's `measure`.
    pub measure: Option<String>,
    /// Aggregate with this function instead of the block's `func`.
    pub func: Option<AggFunc>,
}

/// The wildcard that means "every value of the column dimension" on the wire
/// and on disk, since a flat `Option<String>` cannot distinguish "no override"
/// from "override with no value".
///
/// Deliberately the same `*` the `BLOCKREF` family already uses for "any key"
/// / "any field", so it reads the same everywhere. A dimension whose value is
/// literally `*` cannot be addressed this way — the same limitation
/// `BLOCKREFS` has had all along.
pub const PIVOT_COL_ALL: &str = "*";

impl PivotColumn {
    /// Read a column override from its three flat parts. `None` when none of
    /// them is set, which is the ordinary derived column.
    pub fn from_parts(
        col_value: Option<&str>,
        measure: Option<&str>,
        func: Option<&str>,
    ) -> Option<Self> {
        if col_value.is_none() && measure.is_none() && func.is_none() {
            return None;
        }
        Some(PivotColumn {
            col_value: match col_value {
                Some(PIVOT_COL_ALL) => None,
                Some(v) if !v.is_empty() => Some(v.to_string()),
                _ => None,
            },
            measure: measure.filter(|m| !m.is_empty()).map(String::from),
            // An unrecognized function drops to the block's own, rather than
            // inventing one — the same trade `AggFunc::from_str` makes.
            func: func.and_then(AggFunc::from_str),
        })
    }

    /// The `col_value` as it goes on the wire: `*` for "every value".
    pub fn col_value_str(&self) -> String {
        self.col_value
            .clone()
            .unwrap_or_else(|| PIVOT_COL_ALL.to_string())
    }
}

/// [`PivotSpec`] flattened for transport — the wire and on-disk form, in one
/// shape, the way [`FieldTypeParts`] is for a field type.
///
/// `func` and `order` are free strings for the same reason: a function or an
/// ordering a newer build introduces must not stop this one from opening the
/// file. An unrecognized `func` drops the pivot entirely (a guessed aggregate
/// would invent a number); an unrecognized `order` falls back to the default
/// (a different sequence of the right numbers is harmless).
#[derive(Debug, Clone, Default, PartialEq, Eq, TS)]
#[ts(file_name = "pivot_spec.ts", rename_all = "camelCase")]
pub struct PivotSpecParts {
    pub row_dim: String,
    pub col_dim: Option<String>,
    pub measure: String,
    /// `SUM` | `COUNT` | `AVERAGE` | `MIN` | `MAX`.
    pub func: String,
    /// `ascending` (default) | `firstSeen` | `custom`.
    pub order: Option<String>,
    /// The sequence for `custom`. Values missing from it are not dropped —
    /// they follow in ascending order.
    ///
    /// `Option` rather than a bare `Vec` so that a caller which omits it — a
    /// host built before this existed, or any of the many pivots that need
    /// neither — still deserializes. An absent list is an empty one.
    pub order_values: Option<Vec<String>>,
    /// Which source records the pivot counts at all. Absent or empty means
    /// every one.
    pub filters: Option<Vec<PivotFilter>>,
}

impl PivotSpec {
    pub fn to_parts(&self) -> PivotSpecParts {
        PivotSpecParts {
            row_dim: self.row_dim.clone(),
            col_dim: self.col_dim.clone(),
            measure: self.measure.clone(),
            func: self.func.as_str().to_string(),
            order: Some(self.order.as_str().to_string()),
            order_values: Some(self.order_values.clone()),
            filters: Some(self.filters.clone()),
        }
    }

    /// `None` when the parts do not describe a usable pivot: no row dimension,
    /// no measure, or a function this build does not know. Refusing beats
    /// guessing — a pivot with a wrong aggregate reads as data, not as an error.
    pub fn from_parts(p: &PivotSpecParts) -> Option<Self> {
        if p.row_dim.is_empty() || p.measure.is_empty() {
            return None;
        }
        Some(PivotSpec {
            row_dim: p.row_dim.clone(),
            col_dim: p.col_dim.clone().filter(|c| !c.is_empty()),
            measure: p.measure.clone(),
            func: AggFunc::from_str(&p.func)?,
            order: p
                .order
                .as_deref()
                .map(DimOrder::from_str)
                .unwrap_or_default(),
            order_values: p.order_values.clone().unwrap_or_default(),
            filters: p
                .filters
                .as_deref()
                .unwrap_or_default()
                .iter()
                // A filter naming no field, or with no criteria, would either
                // do nothing or match nothing; dropping it beats guessing.
                .filter(|f| !f.field.is_empty() && !f.criteria.is_empty())
                .cloned()
                .collect(),
        })
    }
}

#[cfg(test)]
mod pivot_tests {
    use super::*;

    #[test]
    fn an_unknown_order_reads_as_the_deterministic_default() {
        // A file written by a newer build must still open, and falling back to
        // a deterministic order cannot invent a wrong number — it can only
        // present the right ones in an unexpected sequence.
        assert_eq!(DimOrder::from_str("ascending"), DimOrder::Ascending);
        assert_eq!(DimOrder::from_str("firstSeen"), DimOrder::FirstSeen);
        assert_eq!(DimOrder::from_str("byMonthName"), DimOrder::Ascending);
        assert_eq!(DimOrder::from_str(""), DimOrder::Ascending);
    }

    #[test]
    fn every_order_round_trips_through_its_wire_name() {
        for o in [DimOrder::Ascending, DimOrder::FirstSeen] {
            assert_eq!(DimOrder::from_str(o.as_str()), o);
        }
    }

    fn sample() -> PivotSpec {
        PivotSpec {
            row_dim: "region".into(),
            col_dim: Some("quarter".into()),
            measure: "amt".into(),
            func: AggFunc::Sum,
            order: DimOrder::FirstSeen,
            order_values: vec![],
            filters: vec![],
        }
    }

    #[test]
    fn a_pivot_round_trips_through_its_flat_form() {
        let parts = sample().to_parts();
        assert_eq!(PivotSpec::from_parts(&parts), Some(sample()));
    }

    #[test]
    fn a_grouped_pivot_round_trips_with_no_column_dimension() {
        let spec = PivotSpec {
            col_dim: None,
            ..sample()
        };
        assert_eq!(PivotSpec::from_parts(&spec.to_parts()), Some(spec));
        // An empty string reads the same as absent, so a host that sends "" is
        // not silently given a column dimension named "".
        let parts = PivotSpecParts {
            col_dim: Some(String::new()),
            ..sample().to_parts()
        };
        assert_eq!(PivotSpec::from_parts(&parts).unwrap().col_dim, None);
    }

    #[test]
    fn an_unknown_function_drops_the_pivot_rather_than_guessing() {
        // The asymmetry with `order` is deliberate: a wrong aggregate produces
        // a number that looks right, an unexpected order does not.
        let parts = PivotSpecParts {
            func: "MEDIAN".into(),
            ..sample().to_parts()
        };
        assert_eq!(PivotSpec::from_parts(&parts), None);
    }

    #[test]
    fn an_incomplete_pivot_is_not_a_pivot() {
        for parts in [
            PivotSpecParts {
                row_dim: String::new(),
                ..sample().to_parts()
            },
            PivotSpecParts {
                measure: String::new(),
                ..sample().to_parts()
            },
        ] {
            assert_eq!(PivotSpec::from_parts(&parts), None);
        }
    }

    #[test]
    fn a_pivot_names_every_source_field_it_reads() {
        // What a re-bind of the source has to check against.
        let two_dim = PivotSpec {
            row_dim: "region".into(),
            col_dim: Some("quarter".into()),
            measure: "amt".into(),
            func: AggFunc::Sum,
            order: DimOrder::Ascending,
            order_values: vec![],
            filters: vec![],
        };
        assert_eq!(two_dim.source_fields(), vec!["region", "amt", "quarter"]);

        let grouped = PivotSpec {
            col_dim: None,
            ..two_dim
        };
        assert_eq!(grouped.source_fields(), vec!["region", "amt"]);
    }
}

#[cfg(test)]
mod agg_tests {
    use super::*;

    #[test]
    fn every_function_round_trips_through_its_wire_name() {
        for f in [
            AggFunc::Sum,
            AggFunc::Count,
            AggFunc::Average,
            AggFunc::Min,
            AggFunc::Max,
        ] {
            assert_eq!(AggFunc::from_str(f.as_str()), Some(f));
        }
    }

    #[test]
    fn an_unknown_function_is_none_rather_than_a_guess() {
        // A file from a newer build must open. A field whose aggregate this
        // build cannot interpret gets no formula, which reads as empty — not
        // as some other function's answer.
        assert_eq!(AggFunc::from_str("MEDIAN"), None);
        assert_eq!(AggFunc::from_str(""), None);
    }
}
