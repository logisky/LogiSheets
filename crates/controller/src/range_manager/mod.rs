mod executors;

use im::{HashMap, HashSet};
use logisheets_base::{
    block_affect::BlockAffectTrait, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
    BlockRange, NormalRange, Range, RangeId, SheetId,
};

use crate::{
    errors::Error,
    payloads::sheet_process::{
        block::BlockPayload,
        cell::CellChange,
        shift::{Direction, ShiftPayload, ShiftType},
        SheetPayload, SheetProcess,
    },
};

use self::executors::{
    delete_block_line, delete_line, input, insert_block_line, insert_line, occupy_addr_range,
    remove_block,
};

type Result<T> = std::result::Result<T, Error>;

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

    pub fn execute_sheet_proc<C>(self, proc: SheetProcess, ctx: &mut C) -> Result<RangeExecContext>
    where
        C: IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait,
    {
        let mut result = self.clone();
        let SheetRangeExecContext {
            sheet_id,
            manager,
            calc_updates,
        } = self.sheet_exec(proc, ctx);
        result.data.insert(sheet_id, manager);
        Ok(RangeExecContext {
            manager: result,
            dirty_ranges: calc_updates
                .dirty_ranges
                .into_iter()
                .map(|d| (sheet_id, d))
                .collect(),
            removed_ranges: calc_updates
                .removed_ranges
                .into_iter()
                .map(|d| (sheet_id, d))
                .collect(),
        })
    }

    fn sheet_exec<C>(self, proc: SheetProcess, ctx: &mut C) -> SheetRangeExecContext
    where
        C: IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait,
    {
        let sheet_id = proc.sheet_id;
        let exec_ctx = self.get_exec_context(&sheet_id);
        match proc.payload {
            SheetPayload::Shift(sp) => match sp {
                ShiftPayload::Line(shift) => {
                    let start = shift.start;
                    let cnt = shift.cnt;
                    match (shift.ty, shift.direction) {
                        (ShiftType::Delete, Direction::Horizontal) => {
                            delete_line(exec_ctx, sheet_id, true, start, cnt, ctx)
                        }
                        (ShiftType::Delete, Direction::Vertical) => {
                            delete_line(exec_ctx, sheet_id, false, start, cnt, ctx)
                        }
                        (ShiftType::Insert, Direction::Horizontal) => {
                            insert_line(exec_ctx, sheet_id, true, start, cnt, ctx)
                        }
                        (ShiftType::Insert, Direction::Vertical) => {
                            insert_line(exec_ctx, sheet_id, false, start, cnt, ctx)
                        }
                    }
                }
                ShiftPayload::Range(_) => unreachable!(),
            },
            SheetPayload::Formula(fp) => input(exec_ctx, sheet_id, fp.row, fp.col, ctx),
            SheetPayload::Cell(cp) => match cp.change {
                CellChange::Recalc => exec_ctx,
                CellChange::Value(_) => input(exec_ctx, sheet_id, cp.row, cp.col, ctx),
                CellChange::DiffStyle(_) => exec_ctx,
            },
            SheetPayload::Block(bp) => match bp {
                BlockPayload::Create(create) => {
                    let start = ctx
                        .fetch_norm_cell_id(&sheet_id, create.master_row, create.master_col)
                        .unwrap();
                    let end = ctx
                        .fetch_norm_cell_id(
                            &sheet_id,
                            create.master_row + create.row_cnt - 1,
                            create.master_col + create.col_cnt - 1,
                        )
                        .unwrap();
                    occupy_addr_range(exec_ctx, sheet_id, start, end, ctx)
                }
                BlockPayload::DeleteCols(dc) => delete_block_line(
                    exec_ctx,
                    sheet_id,
                    dc.block_id,
                    false,
                    dc.idx as u32,
                    dc.delete_cnt as u32,
                    ctx,
                ),
                BlockPayload::DeleteRows(dr) => delete_block_line(
                    exec_ctx,
                    sheet_id,
                    dr.block_id,
                    true,
                    dr.idx as u32,
                    dr.delete_cnt as u32,
                    ctx,
                ),
                BlockPayload::InsertCols(ic) => insert_block_line(
                    exec_ctx,
                    sheet_id,
                    ic.block_id,
                    false,
                    ic.idx as u32,
                    ic.insert_cnt as u32,
                    ctx,
                ),
                BlockPayload::InsertRows(ir) => insert_block_line(
                    exec_ctx,
                    sheet_id,
                    ir.block_id,
                    true,
                    ir.idx as u32,
                    ir.insert_cnt as u32,
                    ctx,
                ),
                BlockPayload::Move(mv) => {
                    let (row_cnt, col_cnt) = ctx.get_block_size(sheet_id, mv.block_id).unwrap();
                    if ctx.any_other_blocks_in(
                        sheet_id,
                        mv.block_id,
                        mv.new_master_row,
                        mv.new_master_col,
                        row_cnt + mv.new_master_row - 1,
                        col_cnt + mv.new_master_col - 1,
                    ) {
                        exec_ctx
                    } else {
                        let start = ctx
                            .fetch_norm_cell_id(&sheet_id, mv.new_master_row, mv.new_master_col)
                            .unwrap();
                        let end = ctx
                            .fetch_norm_cell_id(
                                &sheet_id,
                                mv.new_master_row + row_cnt - 1,
                                mv.new_master_col + col_cnt - 1,
                            )
                            .unwrap();
                        occupy_addr_range(exec_ctx, sheet_id, start, end, ctx)
                    }
                }
                BlockPayload::Remove(rb) => remove_block(exec_ctx, rb.block_id),
            },
            _ => exec_ctx,
        }
    }

    pub fn add_sheet_range_manager(
        &mut self,
        sheet_id: &SheetId,
        sheet_manager: SheetRangeManager,
    ) {
        self.data.insert(*sheet_id, sheet_manager);
    }

    fn get_exec_context(&self, sheet_id: &SheetId) -> SheetRangeExecContext {
        let manager = match self.data.get(sheet_id) {
            Some(m) => m.clone(),
            None => SheetRangeManager::new(),
        };
        SheetRangeExecContext {
            sheet_id: *sheet_id,
            manager,
            calc_updates: CalcUpdates::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SheetRangeManager {
    id_to_normal_range: HashMap<RangeId, NormalRange>,
    normal_range_to_id: HashMap<NormalRange, RangeId>,
    id_to_block_range: HashMap<RangeId, BlockRange>,
    block_range_to_id: HashMap<BlockRange, RangeId>,
    next_id: RangeId,
}

impl SheetRangeManager {
    pub fn new() -> Self {
        SheetRangeManager {
            id_to_normal_range: HashMap::new(),
            normal_range_to_id: HashMap::new(),
            id_to_block_range: HashMap::new(),
            block_range_to_id: HashMap::new(),
            next_id: 0,
        }
    }

    pub fn get_range_id_assert(&self, range: &Range) -> Option<RangeId> {
        match range {
            Range::Normal(normal) => Some(self.normal_range_to_id.get(normal)?.clone()),
            Range::Block(b) => Some(self.block_range_to_id.get(b)?.clone()),
        }
    }

    pub fn get_range(&self, range_id: &RangeId) -> Option<Range> {
        if let Some(normal_range) = self.id_to_normal_range.get(range_id) {
            return Some(Range::Normal(normal_range.clone()));
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
        }
    }
}

pub struct RangeExecContext {
    pub manager: RangeManager,
    pub dirty_ranges: std::collections::HashSet<(SheetId, RangeId)>,
    pub removed_ranges: std::collections::HashSet<(SheetId, RangeId)>,
}

impl RangeExecContext {
    pub fn new(manager: RangeManager) -> Self {
        RangeExecContext {
            manager,
            dirty_ranges: std::collections::HashSet::new(),
            removed_ranges: std::collections::HashSet::new(),
        }
    }
    pub fn execute_sheet_proc<C>(self, proc: SheetProcess, ctx: &mut C) -> Result<RangeExecContext>
    where
        C: IdFetcherTrait + IndexFetcherTrait + BlockAffectTrait,
    {
        let RangeExecContext {
            manager,
            dirty_ranges: dirties,
            removed_ranges: removes,
        } = self;
        let RangeExecContext {
            manager,
            mut dirty_ranges,
            mut removed_ranges,
        } = manager.execute_sheet_proc(proc, ctx)?;
        dirty_ranges.extend(&dirties);
        removed_ranges.extend(&removes);
        Ok(RangeExecContext {
            manager,
            dirty_ranges,
            removed_ranges,
        })
    }
}

pub struct SheetRangeExecContext {
    pub sheet_id: SheetId,
    pub manager: SheetRangeManager,
    pub calc_updates: CalcUpdates,
}

/// Deliver the updates to the calc system. Telling it some calculation should be occured
/// because of updating or removal of some ranges.
#[derive(Default)]
pub struct CalcUpdates {
    pub dirty_ranges: HashSet<RangeId>,
    pub removed_ranges: HashSet<RangeId>,
}

impl CalcUpdates {
    pub fn new() -> Self {
        CalcUpdates {
            dirty_ranges: HashSet::new(),
            removed_ranges: HashSet::new(),
        }
    }

    pub fn add_dirty_range(&mut self, range_id: RangeId) {
        self.dirty_ranges.insert(range_id);
    }

    pub fn add_removed_range(&mut self, range_id: RangeId) {
        self.removed_ranges.insert(range_id);
    }
}

impl SheetRangeExecContext {
    pub fn normal_range_update<F>(self, func: &mut F) -> Self
    where
        F: FnMut(&NormalRange, &RangeId) -> RangeUpdateType,
    {
        let mut calc_updates = self.calc_updates;
        let mut to_update = HashSet::new();
        let mut to_remove = HashSet::new();
        let mut manager = self.manager;
        manager
            .normal_range_to_id
            .iter()
            .for_each(|(range, range_id)| match func(range, range_id) {
                RangeUpdateType::Dirty => {
                    calc_updates.add_dirty_range(range_id.clone());
                }
                RangeUpdateType::UpdateTo(new_range) => {
                    calc_updates.add_dirty_range(new_range.id);
                    to_update.insert(new_range);
                }
                RangeUpdateType::None => {}
                RangeUpdateType::Removed => {
                    to_remove.insert(range_id.clone());
                    calc_updates.add_dirty_range(range_id.clone());
                }
            });
        to_update.into_iter().for_each(|new_range| {
            if let Range::Normal(range) = new_range.range {
                manager
                    .id_to_normal_range
                    .insert(new_range.id, range.clone());
                manager.normal_range_to_id.insert(range, new_range.id);
            }
        });
        to_remove.into_iter().for_each(|range_id| {
            if let Some(data) = manager.id_to_normal_range.get(&range_id) {
                manager.normal_range_to_id.remove(data);
                manager.id_to_normal_range.remove(&range_id);
                calc_updates.add_removed_range(range_id);
            }
        });
        SheetRangeExecContext {
            manager,
            sheet_id: self.sheet_id,
            calc_updates,
        }
    }

    pub fn block_range_update<F>(self, func: &mut F) -> Self
    where
        F: FnMut(&BlockRange, &RangeId) -> RangeUpdateType,
    {
        let mut calc_updates = self.calc_updates;
        let mut to_update = HashSet::new();
        let mut to_remove = HashSet::new();
        let mut manager = self.manager;
        manager
            .block_range_to_id
            .iter()
            .for_each(|(range, range_id)| match func(range, range_id) {
                RangeUpdateType::Dirty => {
                    calc_updates.add_dirty_range(range_id.clone());
                }
                RangeUpdateType::UpdateTo(new_range) => {
                    calc_updates.add_dirty_range(new_range.id);
                    to_update.insert(new_range);
                }
                RangeUpdateType::None => {}
                RangeUpdateType::Removed => {
                    to_remove.insert(range_id.clone());
                    calc_updates.add_dirty_range(range_id.clone());
                }
            });
        to_update.into_iter().for_each(|new_range| {
            if let Range::Block(range) = new_range.range {
                manager
                    .id_to_block_range
                    .insert(new_range.id, range.clone());
                manager.block_range_to_id.insert(range, new_range.id);
            }
        });
        to_remove.into_iter().for_each(|range_id| {
            if let Some(data) = manager.id_to_normal_range.get(&range_id) {
                manager.normal_range_to_id.remove(data);
                manager.id_to_normal_range.remove(&range_id);
                calc_updates.add_removed_range(range_id);
            }
        });
        SheetRangeExecContext {
            manager,
            sheet_id: self.sheet_id,
            calc_updates,
        }
    }
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct NewRange {
    pub id: RangeId,
    pub range: Range,
}

pub enum RangeUpdateType {
    Dirty,
    UpdateTo(NewRange),
    None,
    Removed,
}
