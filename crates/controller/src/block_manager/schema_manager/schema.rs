use logisheets_base::{BlockCellId, BlockFieldId, BlockId, ColId, RowId};

use super::field_type::{FieldAggregate, FieldType, FieldWritePolicy, PivotColumn};
use crate::navigator::BlockPlace;

/// Position of a single block-cell within a schema. Used by the dependency
/// graph to know which virtual node to dirty when a cell value changes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockCellRole {
    /// The cell holds a key value. Editing it must dirty the block's key
    /// virtual node (any BlockRef that filters by key value can be affected).
    Key,
    /// The cell holds a value for a specific field, identified by `field_id`.
    Field(BlockFieldId),
    /// The cell holds a FIELD NAME rather than a record's value: it sits on
    /// the line the schema declares as its header.
    ///
    /// A block is only "there is a thing here, at this position"; the schema
    /// is how to read it. Which line is names rather than data is a matter of
    /// reading, so it lives here — and having it here is what lets this
    /// classification happen without asking the navigator anything.
    Header,
    /// The cell does not participate in the schema (e.g., outside the
    /// described columns/rows). No virtual-node update needed.
    None,
}

pub type RowSchema = FormSchema<ColId, RowId, true>;
pub type ColSchema = FormSchema<RowId, ColId, false>;
pub type RenderId = String;

/// Per-field schema entry. Stores everything the schema knows about a
/// single field: its axis id, its render id, and three optional formula
/// templates that materialize per-row at insert / bind time.
///
/// All three templates use the same placeholder substitution rules:
///   `#FIELD("name")` → reference to the same row's cell at field `name`
///   `#KEY`           → this row's key column value, quoted as a literal
///   `#PLACEHOLDER`   → reference to the cell itself (validation /
///                      editability only — value_formula doesn't use it)
///
/// Template wiring:
///   - `value_formula`        → written as the cell's main formula
///   - `validation_formula`   → installed as a `ShadowKind::Validation`
///                              shadow on the cell (advisory red marker)
///   - `editability_formula`  → installed as a `ShadowKind::UserEditable`
///                              shadow on the cell (host edit gate)
/// Alongside the templates, the field's *declaration*: what it is, what it is
/// for, and the two non-formula constraints. These used to live only in the
/// host, keyed by `render_id` and persisted as opaque JSON, which is why no
/// headless host had field semantics and `describe_block` could not report a
/// type in any host. See `design/block-field-semantics.md`.
///
/// `required` and `unique` are declarations, not enforcement: they say what the
/// schema means, and the rule that enforces them is derived from them. Keeping
/// the declaration and its lowering apart is the point — a derived rule can be
/// regenerated (on a field rename, say), a baked-in formula string cannot.
#[derive(Debug, Clone)]
pub struct FieldEntry<F> {
    pub field_axis_id: F,
    pub render_id: RenderId,
    pub value_formula: Option<String>,
    pub validation_formula: Option<String>,
    pub editability_formula: Option<String>,
    /// What kind of value belongs here. `Unspecified` for a field nobody has
    /// claimed a type for — a block from before this existed, or one converted
    /// from plain cells.
    pub field_type: FieldType,
    /// What the field means, in prose, for whoever reads the block next —
    /// a person or an agent. The place for a unit ("amount, in units of 10k"),
    /// a convention, or a warning.
    pub description: Option<String>,
    /// Every record must carry a value here.
    pub required: bool,
    /// No two records may carry the same value here.
    pub unique: bool,
    /// What a newly-added record starts with.
    pub default_value: Option<String>,
    /// Who may write to this field's cells. A declaration the host decides
    /// with — the engine does not know who is writing. `Inherit` falls back to
    /// the block's own owner / policy rules.
    pub write_policy: FieldWritePolicy,
    /// When this block analyses another one, how this field aggregates it.
    ///
    /// The `value_formula` is GENERATED from this, not stored — so renaming the
    /// source field or the source block rebuilds it instead of leaving a rule
    /// naming something that no longer exists. `None` is an ordinary field:
    /// that is what the label column of a total row is, and what a user can
    /// type into. See `design/block-analysis.md`.
    pub aggregate: Option<FieldAggregate>,
    /// When the block is a PIVOT and this column was hand-declared rather than
    /// derived from the column dimension's values: what it filters on, and
    /// optionally its own measure and function.
    ///
    /// `None` is the ordinary derived column — the field's name is the
    /// dimension value and the block's recipe supplies the rest. A column with
    /// an override is left alone by a refresh, because it was not derived from
    /// the data in the first place. See `design/block-pivot.md` §9.
    pub pivot_column: Option<PivotColumn>,
}

impl<F> FieldEntry<F> {
    pub fn new(field_axis_id: F, render_id: RenderId) -> Self {
        Self {
            field_axis_id,
            render_id,
            value_formula: None,
            validation_formula: None,
            editability_formula: None,
            field_type: FieldType::Unspecified,
            description: None,
            required: false,
            unique: false,
            default_value: None,
            write_policy: FieldWritePolicy::Inherit,
            aggregate: None,
            pivot_column: None,
        }
    }

    pub fn with_field_type(mut self, t: FieldType) -> Self {
        self.field_type = t;
        self
    }

    pub fn with_description(mut self, d: Option<String>) -> Self {
        self.description = d;
        self
    }

    pub fn with_required(mut self, r: bool) -> Self {
        self.required = r;
        self
    }

    pub fn with_unique(mut self, u: bool) -> Self {
        self.unique = u;
        self
    }

    pub fn with_default_value(mut self, v: Option<String>) -> Self {
        self.default_value = v;
        self
    }

    pub fn with_write_policy(mut self, p: FieldWritePolicy) -> Self {
        self.write_policy = p;
        self
    }

    pub fn with_aggregate(mut self, a: Option<FieldAggregate>) -> Self {
        self.aggregate = a;
        self
    }

    pub fn with_pivot_column(mut self, c: Option<PivotColumn>) -> Self {
        self.pivot_column = c;
        self
    }

    pub fn with_value_formula(mut self, f: Option<String>) -> Self {
        self.value_formula = f;
        self
    }

    pub fn with_validation_formula(mut self, f: Option<String>) -> Self {
        self.validation_formula = f;
        self
    }

    pub fn with_editability_formula(mut self, f: Option<String>) -> Self {
        self.editability_formula = f;
        self
    }
}

#[derive(Debug, Clone)]
pub struct FormSchema<F, K, const IS_ROW: bool> {
    /// Per-field entries; index alignment matches the original
    /// `BindFormSchema.fields` order.
    pub fields: Vec<(Field, FieldEntry<F>)>,
    pub name: String,
    pub key: K,
    /// The RECORD-axis line holding field names instead of a record — a row
    /// for a row schema, a column for a column schema. `None` for a block
    /// whose names live only in the schema, which is every block bound before
    /// this existed.
    ///
    /// A line id, not a flag, for the same reason `key` is one: it makes the
    /// classification pure schema knowledge, so `cell_role` can answer
    /// "header?" without the navigator. It also cannot be lost by a reorder.
    ///
    /// Excel decides the other half: `headerRowCount="1"` can only mean the
    /// FIRST line of a table, so the saver emits a real table header only
    /// when this is the first line, and otherwise keeps names in the table
    /// definition as before.
    pub header: Option<u32>,
    /// Field groups whose values, TAKEN TOGETHER, must not repeat across
    /// records.
    ///
    /// The first rule a block can state about itself rather than about one of
    /// its cells. Everything else here is per-field or per-record: `required`,
    /// `unique`, a validation formula — all of them judge one value, or one
    /// record's values against each other. None can say anything about the
    /// table AS A WHOLE, which is the shape of mistake an agent makes: not a
    /// wrong value, a wrong structure, with every cell individually legal.
    ///
    /// `unique` is the single-field case and stays where it is; this is the
    /// composite one, which nothing could express. It matters most for a fact
    /// table feeding a pivot — duplicated (region, quarter) there is not an
    /// error anywhere, it just makes every total quietly count twice.
    pub unique_together: Vec<Vec<Field>>,
}

impl<F: Copy + PartialEq, K, const IS_ROW: bool> FormSchema<F, K, IS_ROW> {
    /// Lookup the value-formula template for the field whose field-axis id
    /// is `id`. Returns `None` if the field doesn't exist or has no
    /// template (free-form column).
    pub fn formula_for_field_axis(&self, id: F) -> Option<&str> {
        self.fields
            .iter()
            .find(|(_, e)| e.field_axis_id == id)
            .and_then(|(_, e)| e.value_formula.as_deref())
    }

    /// Lookup the validation-formula template for the field whose
    /// field-axis id is `id`. Returns `None` for fields with no rule.
    pub fn validation_for_field_axis(&self, id: F) -> Option<&str> {
        self.fields
            .iter()
            .find(|(_, e)| e.field_axis_id == id)
            .and_then(|(_, e)| e.validation_formula.as_deref())
    }

    /// Lookup the editability-formula template for the field whose
    /// field-axis id is `id`. Returns `None` for fields with no rule.
    pub fn editability_for_field_axis(&self, id: F) -> Option<&str> {
        self.fields
            .iter()
            .find(|(_, e)| e.field_axis_id == id)
            .and_then(|(_, e)| e.editability_formula.as_deref())
    }

    /// Resolve a `#FIELD("name")` reference back to the field-axis id
    /// of the referenced sibling field. Returns `None` if the name
    /// isn't a field in this schema.
    pub fn field_axis_by_name(&self, name: &str) -> Option<F> {
        self.fields
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, e)| e.field_axis_id)
    }
}

pub type Field = String;
pub type Key = String;

#[derive(Debug, Clone)]
pub struct RandomSchema {
    pub key_field: Vec<(Key, RowId, ColId, RenderId)>,
    pub name: String,
}

#[derive(Debug, Clone)]
pub enum Schema {
    RowSchema(RowSchema),
    ColSchema(ColSchema),
    RandomSchema(RandomSchema),
}

impl SchemaTrait for Schema {
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId> {
        match self {
            Schema::RowSchema(schema) => schema.get_render_id(row, col),
            Schema::ColSchema(schema) => schema.get_render_id(row, col),
            Schema::RandomSchema(schema) => schema.get_render_id(row, col),
        }
    }

    fn get_ref_name(&self) -> String {
        match self {
            Schema::RowSchema(schema) => schema.get_ref_name(),
            Schema::ColSchema(schema) => schema.get_ref_name(),
            Schema::RandomSchema(schema) => schema.get_ref_name(),
        }
    }

    fn get_all_fields(&self) -> Vec<Field> {
        match self {
            Schema::RowSchema(schema) => schema.get_all_fields(),
            Schema::ColSchema(schema) => schema.get_all_fields(),
            Schema::RandomSchema(schema) => schema.get_all_fields(),
        }
    }

    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        match self {
            Schema::RowSchema(schema) => schema.get_all_field_ids(),
            Schema::ColSchema(schema) => schema.get_all_field_ids(),
            Schema::RandomSchema(schema) => schema.get_all_field_ids(),
        }
    }

    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId> {
        match self {
            Schema::RowSchema(schema) => schema.resolve_field_id(field),
            Schema::ColSchema(schema) => schema.resolve_field_id(field),
            Schema::RandomSchema(schema) => schema.resolve_field_id(field),
        }
    }

    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String> {
        match self {
            Schema::RowSchema(schema) => schema.fetch_field_name(field_id),
            Schema::ColSchema(schema) => schema.fetch_field_name(field_id),
            Schema::RandomSchema(schema) => schema.fetch_field_name(field_id),
        }
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => form_schema.get_all_key_cell_ids(block_id, bp),
            Schema::ColSchema(form_schema) => form_schema.get_all_key_cell_ids(block_id, bp),
            Schema::RandomSchema(random_schema) => random_schema.get_all_key_cell_ids(block_id, bp),
        }
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => form_schema.partially_resolve(key, field),
            Schema::ColSchema(form_schema) => form_schema.partially_resolve(key, field),
            Schema::RandomSchema(random_schema) => random_schema.partially_resolve(key, field),
        }
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        match self {
            Schema::RowSchema(form_schema) => {
                form_schema.partially_resolve_by_field_id(key, field_id)
            }
            Schema::ColSchema(form_schema) => {
                form_schema.partially_resolve_by_field_id(key, field_id)
            }
            Schema::RandomSchema(random_schema) => {
                random_schema.partially_resolve_by_field_id(key, field_id)
            }
        }
    }

    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole {
        match self {
            Schema::RowSchema(s) => s.cell_role(cell),
            Schema::ColSchema(s) => s.cell_role(cell),
            Schema::RandomSchema(s) => s.cell_role(cell),
        }
    }

    fn header_line(&self) -> Option<u32> {
        match self {
            Schema::RowSchema(s) => s.header_line(),
            Schema::ColSchema(s) => s.header_line(),
            Schema::RandomSchema(s) => s.header_line(),
        }
    }

    fn unique_together(&self) -> &[Vec<Field>] {
        match self {
            Schema::RowSchema(s) => s.unique_together(),
            Schema::ColSchema(s) => s.unique_together(),
            Schema::RandomSchema(s) => s.unique_together(),
        }
    }
}

pub trait SchemaTrait {
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId>;
    fn get_ref_name(&self) -> String;
    fn get_all_fields(&self) -> Vec<Field>;
    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)>;
    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId>;
    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String>;
    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId>;
    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId>;
    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId>;
    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole;
    /// The record-axis line that holds field names, if the schema declares
    /// one. See [`FormSchema::header`].
    fn header_line(&self) -> Option<u32>;
    /// Field groups that must be unique in combination. See
    /// [`FormSchema::unique_together`].
    fn unique_together(&self) -> &[Vec<Field>];
}

impl SchemaTrait for RowSchema {
    fn get_render_id(&self, _row: RowId, col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, e)| e.field_axis_id == col)
            .map(|(_, e)| e.render_id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.fields.iter().map(|(f, _)| f.clone()).collect()
    }

    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        self.fields
            .iter()
            .map(|(name, e)| (name.clone(), e.field_axis_id as BlockFieldId))
            .collect()
    }

    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId> {
        self.fields
            .iter()
            .find(|(name, _)| name == field)
            .map(|(_, e)| e.field_axis_id as BlockFieldId)
    }

    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String> {
        self.fields
            .iter()
            .find(|(_, e)| e.field_axis_id as BlockFieldId == field_id)
            .map(|(name, _)| name.clone())
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId> {
        let key = self.key;
        // The header line is not a record, so it has no key. Excluding it
        // HERE is what keeps it out of everything downstream at once:
        // `BLOCKREFS`' matrices, the key-uniqueness guard, a pivot's current
        // shape, the sort order, and the `BLOCKREF` resolution the saver does.
        bp.rows
            .iter()
            .filter(|r| Some(**r) != self.header)
            .map(|r| BlockCellId {
                block_id,
                row: *r,
                col: key,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        let row = key.row;
        let col = self
            .fields
            .iter()
            .find(|(f, _)| f == field)
            .map(|(_, e)| e.field_axis_id);
        col.map(|col| BlockCellId {
            row,
            col,
            block_id: key.block_id,
        })
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        // For RowSchema, fields run along columns and the field id is the
        // ColId. Verify the id is actually one of this schema's fields before
        // returning, so callers don't synthesize cells from arbitrary ids.
        if self
            .fields
            .iter()
            .any(|(_, e)| e.field_axis_id as BlockFieldId == field_id)
        {
            Some(BlockCellId {
                block_id: key.block_id,
                row: key.row,
                col: field_id as ColId,
            })
        } else {
            None
        }
    }

    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole {
        // Header first, and on the RECORD axis: the whole line is names,
        // whichever field's column it sits under.
        if Some(cell.row) == self.header {
            BlockCellRole::Header
        } else if cell.col == self.key {
            BlockCellRole::Key
        } else if self.fields.iter().any(|(_, e)| e.field_axis_id == cell.col) {
            BlockCellRole::Field(cell.col as BlockFieldId)
        } else {
            BlockCellRole::None
        }
    }

    fn header_line(&self) -> Option<u32> {
        self.header
    }

    fn unique_together(&self) -> &[Vec<Field>] {
        &self.unique_together
    }
}

impl SchemaTrait for ColSchema {
    fn get_render_id(&self, row: RowId, _col: ColId) -> Option<RenderId> {
        self.fields
            .iter()
            .find(|(_, e)| e.field_axis_id == row)
            .map(|(_, e)| e.render_id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.fields.iter().map(|(f, _)| f.clone()).collect()
    }

    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        self.fields
            .iter()
            .map(|(name, e)| (name.clone(), e.field_axis_id as BlockFieldId))
            .collect()
    }

    fn resolve_field_id(&self, field: &str) -> Option<BlockFieldId> {
        self.fields
            .iter()
            .find(|(name, _)| name == field)
            .map(|(_, e)| e.field_axis_id as BlockFieldId)
    }

    fn fetch_field_name(&self, field_id: BlockFieldId) -> Option<String> {
        self.fields
            .iter()
            .find(|(_, e)| e.field_axis_id as BlockFieldId == field_id)
            .map(|(name, _)| name.clone())
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, bp: &BlockPlace) -> Vec<BlockCellId> {
        let key = self.key;
        // A column schema's records are COLUMNS, so its header is a column.
        bp.cols
            .iter()
            .filter(|c| Some(**c) != self.header)
            .map(|c| BlockCellId {
                block_id,
                row: key,
                col: *c,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, field: &String) -> Option<BlockCellId> {
        self.fields
            .iter()
            .find(|(f, _)| f == field)
            .map(|(_, e)| BlockCellId {
                block_id: key.block_id,
                row: e.field_axis_id,
                col: key.col,
            })
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        if self
            .fields
            .iter()
            .any(|(_, e)| e.field_axis_id as BlockFieldId == field_id)
        {
            Some(BlockCellId {
                block_id: key.block_id,
                row: field_id as RowId,
                col: key.col,
            })
        } else {
            None
        }
    }

    fn cell_role(&self, cell: &BlockCellId) -> BlockCellRole {
        if Some(cell.col) == self.header {
            BlockCellRole::Header
        } else if cell.row == self.key {
            BlockCellRole::Key
        } else if self.fields.iter().any(|(_, e)| e.field_axis_id == cell.row) {
            BlockCellRole::Field(cell.row as BlockFieldId)
        } else {
            BlockCellRole::None
        }
    }

    fn header_line(&self) -> Option<u32> {
        self.header
    }

    fn unique_together(&self) -> &[Vec<Field>] {
        &self.unique_together
    }
}

impl SchemaTrait for RandomSchema {
    fn get_render_id(&self, row: RowId, col: ColId) -> Option<RenderId> {
        self.key_field
            .iter()
            .find(|(_, r, c, _)| r == &row && c == &col)
            .map(|(_, _, _, id)| id.clone())
    }

    fn get_ref_name(&self) -> String {
        self.name.clone()
    }

    fn get_all_fields(&self) -> Vec<Field> {
        self.key_field
            .iter()
            .map(|(f, _, _, _)| f.clone())
            .collect()
    }

    // RandomSchema has no separate field axis — every entry is a (key, value)
    // pair. The id-keyed dependency vertex is intentionally coarse: any cell
    // change inside a RandomSchema block goes through `BlockAll`, so these id
    // helpers stay no-ops.
    fn get_all_field_ids(&self) -> Vec<(Field, BlockFieldId)> {
        Vec::new()
    }

    fn resolve_field_id(&self, _field: &str) -> Option<BlockFieldId> {
        None
    }

    fn fetch_field_name(&self, _field_id: BlockFieldId) -> Option<String> {
        None
    }

    fn get_all_key_cell_ids(&self, block_id: BlockId, _bp: &BlockPlace) -> Vec<BlockCellId> {
        self.key_field
            .iter()
            .map(|(_, r, c, _)| BlockCellId {
                block_id,
                row: *r,
                col: *c,
            })
            .collect()
    }

    fn partially_resolve(&self, key: BlockCellId, _field: &String) -> Option<BlockCellId> {
        Some(key)
    }

    fn partially_resolve_by_field_id(
        &self,
        key: BlockCellId,
        _field_id: BlockFieldId,
    ) -> Option<BlockCellId> {
        Some(key)
    }

    fn cell_role(&self, _cell: &BlockCellId) -> BlockCellRole {
        // Conservative: never claim a cell is a Key/Field for random schemas
        // because dirty propagation falls back to BlockAll for them.
        BlockCellRole::None
    }

    /// A random schema names its cells individually, so there is no line of
    /// names to declare.
    fn header_line(&self) -> Option<u32> {
        None
    }

    /// Nor records to be unique across.
    fn unique_together(&self) -> &[Vec<Field>] {
        &[]
    }
}
