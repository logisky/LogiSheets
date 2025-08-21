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
            next_id: 0,
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
        match range {
            Range::Normal(normal_range) => match self.normal_range_to_id.get(normal_range) {
                Some(id) => *id,
                None => {
                    let r = normal_range.clone();
                    let id = self.next_id;
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
                    let id = self.next_id;
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
