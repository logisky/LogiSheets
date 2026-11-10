use imbl::HashMap;
use logisheets_base::{CellId, SheetId};

/// A link stored on a cell — OOXML `CT_Hyperlink`. At least one of `url` and
/// `location` is set.
///
/// Keyed by [`CellId`], so it follows its cell through row and column inserts
/// and disappears with it. A `=HYPERLINK(...)` formula is not one of these:
/// its target is computed, see `Workbook::get_hyperlink`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hyperlink {
    /// An external target: a web address, `mailto:`, or file path. On disk it
    /// lives in the sheet's `.rels` as an external relationship.
    pub url: Option<String>,
    /// A place in this workbook, e.g. `Sheet2!A1` or a defined name. With
    /// `url` also set it is the fragment within that target.
    pub location: Option<String>,
    pub tooltip: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct Hyperlinks {
    pub data: HashMap<SheetId, HashMap<CellId, Hyperlink>>,
}

impl Hyperlinks {
    pub fn get(&self, sheet_id: &SheetId, cell_id: &CellId) -> Option<&Hyperlink> {
        self.data.get(sheet_id)?.get(cell_id)
    }

    pub fn set(&mut self, sheet_id: SheetId, cell_id: CellId, link: Hyperlink) {
        self.data
            .entry(sheet_id)
            .or_insert_with(HashMap::new)
            .insert(cell_id, link);
    }

    /// Whether a link was there to remove.
    pub fn remove(&mut self, sheet_id: &SheetId, cell_id: &CellId) -> bool {
        self.data
            .get_mut(sheet_id)
            .map(|links| links.remove(cell_id).is_some())
            .unwrap_or(false)
    }
}
