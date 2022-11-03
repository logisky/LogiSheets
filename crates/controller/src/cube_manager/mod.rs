use im::HashMap;
use logisheets_base::{id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait, Cube, CubeId};

use crate::payloads::sheet_process::{
    cell::CellChange,
    shift::{Direction, ShiftPayload, ShiftType},
    SheetPayload, SheetProcess,
};

use self::executors::{delete_line, input, insert_line};

mod executors;

#[derive(Debug, Clone)]
pub struct CubeManger {
    id_to_cube: HashMap<CubeId, Cube>,
    cube_to_id: HashMap<Cube, CubeId>,
    next_id: CubeId,
}

impl CubeManger {
    pub fn new() -> CubeManger {
        CubeManger {
            id_to_cube: HashMap::new(),
            cube_to_id: HashMap::new(),
            next_id: 0,
        }
    }

    pub fn get_cube(&self, cube_id: &CubeId) -> Option<Cube> {
        Some(self.id_to_cube.get(cube_id)?.clone())
    }

    pub fn get_cube_id(&mut self, cube: &Cube) -> CubeId {
        if let Some(id) = self.cube_to_id.get(cube) {
            *id
        } else {
            let id = self.next_id;
            let c = cube.clone();
            self.cube_to_id.insert(c, id);
            self.id_to_cube.insert(id, c);
            self.next_id += 1;
            id
        }
    }

    pub fn remove_cube_id(&mut self, cube_id: &CubeId) {
        if let Some(cube) = self.id_to_cube.remove(cube_id) {
            self.cube_to_id.remove(&cube);
        }
    }

    pub fn execute_sheet_proc<C>(self, proc: SheetProcess, ctx: &mut C) -> CubeExecContext
    where
        C: IdFetcherTrait + IndexFetcherTrait,
    {
        let sheet_id = proc.sheet_id;
        let exec_ctx = CubeExecContext::new(self);
        match proc.payload {
            SheetPayload::Shift(shift_payload) => match shift_payload {
                ShiftPayload::Line(ls) => match (ls.ty, ls.direction) {
                    (ShiftType::Delete, Direction::Horizontal) => {
                        delete_line(exec_ctx, sheet_id, true, ls.start, ls.cnt, ctx)
                    }
                    (ShiftType::Delete, Direction::Vertical) => {
                        delete_line(exec_ctx, sheet_id, false, ls.start, ls.cnt, ctx)
                    }
                    (ShiftType::Insert, Direction::Horizontal) => {
                        insert_line(exec_ctx, sheet_id, true, ls.start, ls.cnt, ctx)
                    }
                    (ShiftType::Insert, Direction::Vertical) => {
                        insert_line(exec_ctx, sheet_id, false, ls.start, ls.cnt, ctx)
                    }
                },
                ShiftPayload::Range(_) => todo!(),
            },
            SheetPayload::Formula(fp) => input(exec_ctx, sheet_id, fp.row, fp.col, ctx),
            SheetPayload::Cell(cp) => match cp.change {
                CellChange::Recalc => exec_ctx,
                CellChange::Value(_) => input(exec_ctx, sheet_id, cp.row, cp.col, ctx),
                CellChange::DiffStyle(_) => exec_ctx,
            },
            SheetPayload::Line(_) => exec_ctx,
            SheetPayload::Property(_) => exec_ctx,
            SheetPayload::Block(_) => exec_ctx,
        }
    }
}

pub enum CubeUpdateType {
    None,
    Dirty,
    Removed,
}

#[derive(Debug, Clone)]
pub struct CubeExecContext {
    pub manager: CubeManger,
    pub dirty_cubes: std::collections::HashSet<CubeId>,
    pub removed_cubes: std::collections::HashSet<CubeId>,
}

impl CubeExecContext {
    pub fn new(manager: CubeManger) -> Self {
        CubeExecContext {
            manager,
            dirty_cubes: std::collections::HashSet::new(),
            removed_cubes: std::collections::HashSet::new(),
        }
    }

    pub fn cube_update<F>(self, func: &mut F) -> Self
    where
        F: FnMut(&Cube, &CubeId) -> CubeUpdateType,
    {
        let mut dirty_cubes = self.dirty_cubes;
        let mut removed_cubes = self.removed_cubes;
        let mut new_manager = self.manager.clone();
        self.manager
            .cube_to_id
            .iter()
            .for_each(|(c, id)| match func(c, id) {
                CubeUpdateType::Dirty => {
                    dirty_cubes.insert(*id);
                }
                CubeUpdateType::Removed => {
                    removed_cubes.insert(*id);
                    new_manager.cube_to_id.remove(c);
                    new_manager.id_to_cube.remove(id);
                }
                CubeUpdateType::None => {}
            });
        CubeExecContext {
            manager: new_manager,
            dirty_cubes,
            removed_cubes,
        }
    }

    pub fn execute_sheet_proc<C>(self, proc: SheetProcess, ctx: &mut C) -> CubeExecContext
    where
        C: IdFetcherTrait + IndexFetcherTrait,
    {
        let CubeExecContext {
            manager,
            dirty_cubes: dirties,
            removed_cubes: removes,
        } = self;
        let CubeExecContext {
            manager,
            mut dirty_cubes,
            mut removed_cubes,
        } = manager.execute_sheet_proc(proc, ctx);
        dirty_cubes.extend(dirties);
        removed_cubes.extend(removes);
        CubeExecContext {
            manager,
            dirty_cubes,
            removed_cubes,
        }
    }
}
