use gents_derives::TS;
use logisheets_base::{CellId, SheetId};
use std::collections::HashMap;

/// What a shadow cell is FOR. A single (sheet, cell) can now own multiple
/// shadow ephemeral cells, one per kind — letting different host-side
/// concerns (validation warnings, dynamic editability, future widgets)
/// each register their own derived formula without colliding.
///
/// Backward compatibility note: every pre-existing call site (validation
/// in particular) maps to `ShadowKind::Validation`, which is also the
/// default the RPC layer fills in when callers omit it.
#[derive(Debug, Clone, Copy, Eq, PartialEq, Hash, TS)]
#[ts(file_name = "shadow_kind.ts", rename_all = "camelCase")]
pub enum ShadowKind {
    /// Validation formula — used by ValidationCell in block-interface.
    /// Default kind for callers that don't specify.
    Validation,
    /// Per-cell editability formula — used by the permission patch to
    /// gate writes dynamically based on the row's current state.
    UserEditable,
}

impl Default for ShadowKind {
    fn default() -> Self {
        ShadowKind::Validation
    }
}

#[derive(Debug)]
pub struct ShadowIdAssigner {
    next_id: u64,

    eid_to_cell_kind: HashMap<u64, (SheetId, CellId, ShadowKind)>,
    cell_kind_to_eid: HashMap<(SheetId, CellId, ShadowKind), u64>,
}

impl ShadowIdAssigner {
    pub fn new() -> Self {
        Self {
            next_id: u32::MAX as u64,
            eid_to_cell_kind: HashMap::new(),
            cell_kind_to_eid: HashMap::new(),
        }
    }

    /// Look up an existing shadow id for (sheet, cell, kind). Returns
    /// `None` when none has been allocated yet.
    pub fn find_shadow_id(
        &self,
        sheet_id: SheetId,
        cell_id: CellId,
        kind: ShadowKind,
    ) -> Option<u64> {
        self.cell_kind_to_eid
            .get(&(sheet_id, cell_id, kind))
            .cloned()
    }

    /// Get-or-create the shadow id for (sheet, cell, kind). Allocates a
    /// fresh id on first request.
    pub fn get_shawdow_id(&mut self, sheet_id: SheetId, cell_id: CellId, kind: ShadowKind) -> u64 {
        if let Some(id) = self.cell_kind_to_eid.get(&(sheet_id, cell_id, kind)) {
            *id
        } else {
            let id = self.next_id;
            self.next_id += 1;
            self.eid_to_cell_kind.insert(id, (sheet_id, cell_id, kind));
            self.cell_kind_to_eid.insert((sheet_id, cell_id, kind), id);
            id
        }
    }

    /// Reverse-lookup for ephemeral cell routing. Drops the `kind` —
    /// formula_manager only needs to know which real cell to dirty when
    /// the shadow's value changes; the kind doesn't affect that.
    pub fn get_cell_id(&self, eid: u64) -> Option<(SheetId, CellId)> {
        self.eid_to_cell_kind.get(&eid).map(|(s, c, _k)| (*s, *c))
    }

    /// Full reverse lookup including the shadow's kind. Used when the
    /// caller needs to route based on which derived computation this
    /// shadow represents.
    pub fn get_cell_kind(&self, eid: u64) -> Option<(SheetId, CellId, ShadowKind)> {
        self.eid_to_cell_kind.get(&eid).cloned()
    }
}
