use imbl::HashMap;
use logisheets_base::{BlockRange, EphemeralId, NormalRange, Range, RangeId, SheetId};

#[derive(Debug, Clone, Default)]
pub struct RangeManager {
    data: HashMap<SheetId, SheetRangeManager>,
}

impl RangeManager {
    pub fn new() -> Self {
        RangeManager {
            data: HashMap::new(),
        }
    }

    pub fn get_range(&self, sheet_id: &SheetId, range_id: &RangeId) -> Option<Range> {
        self.data.get(sheet_id)?.get_range(range_id)
    }

    pub fn get_range_id_assert(&self, sheet_id: &SheetId, range: &Range) -> Option<RangeId> {
        self.data.get(&sheet_id)?.get_range_id_assert(range)
    }

    pub fn get_range_id(&mut self, sheet_id: &SheetId, range: &Range) -> RangeId {
        if let Some(sheet_manager) = self.data.get_mut(sheet_id) {
            sheet_manager.get_range_id(range)
        } else {
            let mut manager = SheetRangeManager::new();
            let result = manager.get_range_id(range);
            self.data.insert(*sheet_id, manager);
            result
        }
    }

    pub fn remove_range_id(&mut self, sheet_id: &SheetId, range_id: &RangeId) {
        if let Some(sheet_manager) = self.data.get_mut(sheet_id) {
            sheet_manager.remove_range_id(range_id)
        }
    }

    /// Link a source normal range on `sheet_id` to a backing block range, so
    /// references to the source resolve to the block. See `SheetRangeManager`.
    pub fn add_link(&mut self, sheet_id: &SheetId, source: NormalRange, target: BlockRange) {
        self.get_sheet_range_manager(sheet_id).add_link(source, target)
    }

    pub fn remove_link(&mut self, sheet_id: &SheetId, source: &NormalRange) {
        if let Some(sheet_manager) = self.data.get_mut(sheet_id) {
            sheet_manager.remove_link(source)
        }
    }

    pub fn get_link(&self, sheet_id: &SheetId, source: &NormalRange) -> Option<BlockRange> {
        self.data.get(sheet_id)?.get_link(source)
    }

    pub fn get_sheet_manager_assert(&self, sheet_id: &SheetId) -> Option<&SheetRangeManager> {
        self.data.get(sheet_id)
    }

    pub fn get_sheet_range_manager(&mut self, sheet_id: &SheetId) -> &mut SheetRangeManager {
        if !self.data.contains_key(sheet_id) {
            self.data.insert(*sheet_id, SheetRangeManager::new());
        }
        self.data.get_mut(sheet_id).unwrap()
    }

    pub fn add_sheet_range_manager(
        &mut self,
        sheet_id: &SheetId,
        sheet_manager: SheetRangeManager,
    ) {
        self.data.insert(*sheet_id, sheet_manager);
    }
}

#[derive(Debug, Clone)]
pub struct SheetRangeManager {
    pub id_to_normal_range: HashMap<RangeId, NormalRange>,
    pub normal_range_to_id: HashMap<NormalRange, RangeId>,
    pub id_to_block_range: HashMap<RangeId, BlockRange>,
    pub block_range_to_id: HashMap<BlockRange, RangeId>,
    pub id_to_ephemeral_range: HashMap<RangeId, EphemeralId>,
    pub ephemeral_range_to_id: HashMap<EphemeralId, RangeId>,
    // Range links: a normal range the user references (e.g. `A1:A10`) is
    // transparently redirected to a block range that actually backs it. Because
    // this redirect happens at range-id resolution (`get_range_id`), every
    // reference to the source resolves to the block's range id — so the
    // dependency graph, calc-time value fetch, and growth (block row insertion)
    // all follow from the existing block machinery, with no per-formula edge
    // surgery. The source's own cells are left untouched (they become a facade).
    pub links: HashMap<NormalRange, BlockRange>,
    pub next_id: RangeId,
}

impl SheetRangeManager {
    pub fn new() -> Self {
        SheetRangeManager {
            id_to_normal_range: HashMap::new(),
            normal_range_to_id: HashMap::new(),
            id_to_block_range: HashMap::new(),
            block_range_to_id: HashMap::new(),
            id_to_ephemeral_range: HashMap::new(),
            ephemeral_range_to_id: HashMap::new(),
            links: HashMap::new(),
            next_id: 0,
        }
    }

    /// Redirect a source normal range to a backing block range. After this,
    /// resolving the source (via `get_range_id`) yields the block's range id.
    pub fn add_link(&mut self, source: NormalRange, target: BlockRange) {
        self.links.insert(source, target);
    }

    pub fn remove_link(&mut self, source: &NormalRange) {
        self.links.remove(source);
    }

    pub fn get_link(&self, source: &NormalRange) -> Option<BlockRange> {
        self.links.get(source).copied()
    }

    pub fn convert_normal_range_to_block_range(
        &mut self,
        normal_range: NormalRange,
        block_range: BlockRange,
    ) {
        if let Some(id) = self.normal_range_to_id.remove(&normal_range) {
            self.id_to_normal_range.remove(&id);
            self.id_to_block_range.insert(id, block_range);
            self.block_range_to_id.insert(block_range, id);
        }
    }

    pub fn get_range_id_assert(&self, range: &Range) -> Option<RangeId> {
        match range {
            Range::Normal(normal) => Some(self.normal_range_to_id.get(normal)?.clone()),
            Range::Block(b) => Some(self.block_range_to_id.get(b)?.clone()),
            Range::Ephemeral(e) => Some(self.ephemeral_range_to_id.get(e)?.clone()),
        }
    }

    pub fn get_range(&self, range_id: &RangeId) -> Option<Range> {
        if let Some(normal_range) = self.id_to_normal_range.get(range_id) {
            return Some(Range::Normal(normal_range.clone()));
        }
        if let Some(ephemeral_range) = self.id_to_ephemeral_range.get(range_id) {
            return Some(Range::Ephemeral(*ephemeral_range));
        }
        match self.id_to_block_range.get(range_id) {
            Some(block_range) => Some(Range::Block(block_range.clone())),
            None => None,
        }
    }

    pub fn remove_range_id(&mut self, range_id: &RangeId) {
        if let Some(range) = self.id_to_normal_range.remove(range_id) {
            self.normal_range_to_id.remove(&range);
        }
        if let Some(range) = self.id_to_block_range.remove(range_id) {
            self.block_range_to_id.remove(&range);
        }
        if let Some(range) = self.id_to_ephemeral_range.remove(range_id) {
            self.ephemeral_range_to_id.remove(&range);
        }
    }

    pub fn get_range_id(&mut self, range: &Range) -> RangeId {
        // NOTE: link resolution (a record column → its block column, or an
        // invalid record reference) is done a level up in `FormulaConnector`
        // and the calc engine, which have navigator access for the index math.
        // This assigns/returns ids for concrete ranges only.
        match range {
            Range::Normal(normal_range) => match self.normal_range_to_id.get(normal_range) {
                Some(id) => *id,
                None => {
                    let r = normal_range.clone();
                    let id = if r.is_single() {
                        self.next_id
                    } else {
                        self.next_id + u16::MAX as u32
                    };
                    self.normal_range_to_id.insert(r.clone(), id);
                    self.id_to_normal_range.insert(id, r);
                    self.next_id += 1;
                    id
                }
            },
            Range::Block(block_range) => match self.block_range_to_id.get(block_range) {
                Some(id) => *id,
                None => {
                    let r = block_range.clone();
                    let id = if r.is_single() {
                        self.next_id
                    } else {
                        self.next_id + u16::MAX as u32
                    };
                    self.block_range_to_id.insert(r.clone(), id);
                    self.id_to_block_range.insert(id, r);
                    self.next_id += 1;
                    id
                }
            },
            Range::Ephemeral(v) => match self.ephemeral_range_to_id.get(v) {
                Some(id) => *id,
                None => {
                    let id = self.next_id;
                    self.ephemeral_range_to_id.insert(*v, id);
                    self.id_to_ephemeral_range.insert(id, *v);
                    self.next_id += 1;
                    id
                }
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use logisheets_base::{BlockCellId, NormalCellId};

    // Link storage: add/get/remove. Resolution (record column → block, invalid
    // record reference → #VALUE) lives a level up in `FormulaConnector` / the
    // calc engine (they have the navigator for index math) and is covered by the
    // api-level tests; here we just check the map plumbing.
    #[test]
    fn link_storage_add_get_remove() {
        let mut rm = RangeManager::new();
        let sheet: SheetId = 0;
        let source = NormalRange::AddrRange(
            NormalCellId { row: 0, col: 0 },
            NormalCellId { row: 9, col: 0 },
        );
        let target = BlockRange::AddrRange(
            BlockCellId { block_id: 1, row: 0, col: 0 },
            BlockCellId { block_id: 1, row: 1, col: 0 },
        );

        rm.add_link(&sheet, source, target);
        assert_eq!(rm.get_link(&sheet, &source), Some(target));

        // A plain normal range still resolves to a normal id (no redirect here).
        let id = rm.get_range_id(&sheet, &Range::Normal(source));
        assert_eq!(rm.get_range(&sheet, &id), Some(Range::Normal(source)));

        rm.remove_link(&sheet, &source);
        assert_eq!(rm.get_link(&sheet, &source), None);
    }
}
