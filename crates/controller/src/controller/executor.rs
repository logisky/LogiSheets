use std::collections::{HashMap, HashSet};

use logisheets_base::{errors::BasicError, Addr, CellId, CubeId, RangeId, SheetId};

use crate::{
    async_func_manager::AsyncFuncManager,
    calc_engine::CalcEngine,
    connectors::{
        CalcConnector, ContainerConnector, CubeConnector, FormulaConnector, NavigatorConnector,
        RangeConnector, SheetPosConnector,
    },
    container::ContainerExecutor,
    cube_manager::executors::CubeExecutor,
    edit_action::{EditPayload, PayloadsAction, SheetRename},
    formula_manager::{FormulaExecutor, Vertex},
    navigator::{NavExecutor, Navigator},
    range_manager::RangeExecutor,
    settings::CalcConfig,
    version_manager::VersionManager,
    workbook::sheet_pos_manager::SheetPosManager,
    Error,
};

use super::status::Status;

pub struct Executor<'a> {
    pub status: Status,
    pub version_manager: &'a mut VersionManager,
    pub async_func_manager: &'a mut AsyncFuncManager,
    pub book_name: &'a str,
    pub calc_config: CalcConfig,
    pub async_funcs: &'a HashSet<String>,
    pub updated_cells: HashSet<(SheetId, CellId)>,
    pub dirty_vertices: HashSet<Vertex>,

    pub sheet_updated: bool,
    pub cell_updated: bool, // todo: updated celll
}

impl<'a> Executor<'a> {
    pub fn execute_and_calc(self, payload_action: PayloadsAction) -> Result<Self, Error> {
        let mut result = self;
        for payload in payload_action.clone().payloads.into_iter() {
            result = result.execute_payload(payload)?;
        }

        let result = result.calc()?;

        if payload_action.undoable {
            result.version_manager.record(
                result.status.clone(),
                payload_action,
                result.updated_cells.clone(),
            );
        }
        Ok(result)
    }

    fn execute_payload(self, payload: EditPayload) -> Result<Self, Error> {
        let mut result = self;

        if let EditPayload::SheetRename(rename) = payload {
            let manager = &mut result.status.sheet_id_manager;
            let SheetRename {
                old_name,
                idx,
                new_name,
            } = rename;
            if let Some(old_name) = old_name {
                manager.rename(&old_name, new_name);
            } else {
                if let Some(idx) = idx {
                    let id = result
                        .status
                        .sheet_pos_manager
                        .get_sheet_id(idx)
                        .ok_or(Error::Basic(BasicError::SheetIdxExceed(idx)))?;
                    let old_name = manager
                        .get_string(&id)
                        .ok_or(Error::Basic(BasicError::SheetIdNotFound(id)))?;
                    manager.rename(&old_name, new_name);
                } else {
                    return Err(Error::PayloadError("".to_string()));
                }
            }
            result.sheet_updated = true;
            return Ok(result);
        }

        let (sheet_pos_manager, sheet_updated) = result.execute_sheet_pos(&payload)?;
        result.status.sheet_pos_manager = sheet_pos_manager;

        let old_navigator = result.status.navigator.clone();
        let nav_executor = result.execute_navigator(payload.clone())?;

        let range_executor = result.execute_range(payload.clone())?;
        let cube_executor = result.execute_cube(payload.clone())?;

        let (container_executor, updated) = result.execute_container(payload.clone())?;
        result.status.container = container_executor.container;

        let mut dirty_ranges = range_executor.dirty_ranges;
        range_executor.removed_ranges.into_iter().for_each(|e| {
            dirty_ranges.insert(e);
        });
        let mut dirty_cubes = cube_executor.dirty_cubes;
        cube_executor.removed_cubes.into_iter().for_each(|e| {
            dirty_cubes.insert(e);
        });

        result.status.navigator = nav_executor.nav;
        result.status.range_manager = range_executor.manager;
        result.status.cube_manager = cube_executor.manager;

        let formula_executor =
            result.execute_formula(payload, &old_navigator, dirty_ranges, dirty_cubes)?;

        let cell_updated = if updated {
            true
        } else {
            result.updated_cells.len() > 0
        };

        Ok(Executor {
            status: Status {
                navigator: result.status.navigator,
                range_manager: result.status.range_manager,
                cube_manager: result.status.cube_manager,
                ext_ref_manager: result.status.ext_ref_manager,
                formula_manager: formula_executor.manager,
                container: result.status.container,
                sheet_id_manager: result.status.sheet_id_manager,
                func_id_manager: result.status.func_id_manager,
                text_id_manager: result.status.text_id_manager,
                name_id_manager: result.status.name_id_manager,
                external_links_manager: result.status.external_links_manager,
                sheet_pos_manager: result.status.sheet_pos_manager,
                style_manager: result.status.style_manager,
                cell_attachment_manager: result.status.cell_attachment_manager,
                dirty_cells_next_round: result.status.dirty_cells_next_round,
            },
            version_manager: result.version_manager,
            async_func_manager: result.async_func_manager,
            book_name: result.book_name,
            calc_config: result.calc_config,
            async_funcs: result.async_funcs,
            dirty_vertices: formula_executor.dirty_vertices,
            updated_cells: result.updated_cells,
            sheet_updated,
            cell_updated,
        })
    }

    pub fn calc(mut self) -> Result<Self, Error> {
        let mut dirty_cells_in_next_run = im::HashSet::new();
        let mut calc_cells: HashSet<(SheetId, CellId)> = HashSet::new();
        let connector = CalcConnector {
            range_manager: &self.status.range_manager,
            cube_manager: &self.status.cube_manager,
            navigator: &mut self.status.navigator,
            container: &mut self.status.container,
            ext_links: &mut self.status.external_links_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            sheet_id_manager: &self.status.sheet_id_manager,
            names_storage: HashMap::new(),
            cells_stroage: HashMap::new(),
            sheet_pos_manager: &mut self.status.sheet_pos_manager,
            async_func_manager: &mut self.async_func_manager,
            async_funcs: &self.async_funcs,
            active_sheet: 0,
            curr_addr: Addr::default(),
            dirty_cells_in_next_run: &mut dirty_cells_in_next_run,
            calc_cells: &mut calc_cells,
        };
        let engine = CalcEngine {
            formula_manager: &self.status.formula_manager,
            dirty_vertices: self.dirty_vertices.clone(),
            config: self.calc_config.clone(),
            connector,
        };

        engine.start();

        Ok(self)
    }

    fn execute_range(&mut self, payload: EditPayload) -> Result<RangeExecutor, Error> {
        let ctx = RangeConnector {
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            navigator: &self.status.navigator,
            sheet_pos_manager: &self.status.sheet_pos_manager,
        };
        let executor = RangeExecutor::new(self.status.range_manager.clone());
        executor.execute(&ctx, payload)
    }

    fn execute_cube(&mut self, payload: EditPayload) -> Result<CubeExecutor, Error> {
        let ctx = CubeConnector {
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            navigator: &self.status.navigator,
            sheet_pos_manager: &self.status.sheet_pos_manager,
        };
        let executor = CubeExecutor::new(self.status.cube_manager.clone());
        executor.execute(&ctx, payload)
    }

    fn execute_navigator(&mut self, payload: EditPayload) -> Result<NavExecutor, Error> {
        let ctx = NavigatorConnector {
            sheet_pos_manager: &self.status.sheet_pos_manager,
        };
        let executor = NavExecutor::new(self.status.navigator.clone());
        executor.execute(&ctx, payload)
    }

    fn execute_container(
        &mut self,
        payload: EditPayload,
    ) -> Result<(ContainerExecutor, bool), Error> {
        let mut ctx = ContainerConnector {
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            navigator: &self.status.navigator,
            sheet_pos_manager: &self.status.sheet_pos_manager,
            style_manager: &mut self.status.style_manager,
        };
        let executor = ContainerExecutor::new(self.status.container.clone());
        executor.execute(&mut ctx, payload)
    }

    fn execute_sheet_pos(
        &mut self,
        payload: &EditPayload,
    ) -> Result<(SheetPosManager, bool), Error> {
        let mut ctx = SheetPosConnector {
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            navigator: &self.status.navigator,
            updated: false,
        };
        let new_manager = self
            .status
            .sheet_pos_manager
            .clone()
            .execute(payload, &mut ctx);
        Ok((new_manager, ctx.updated))
    }

    fn execute_formula(
        &mut self,
        payload: EditPayload,
        old_navigator: &Navigator,
        dirty_ranges: HashSet<(SheetId, RangeId)>,
        dirty_cubes: HashSet<CubeId>,
    ) -> Result<FormulaExecutor, Error> {
        let mut ctx = FormulaConnector {
            book_name: self.book_name,
            container: &mut self.status.container,
            sheet_pos_manager: &mut self.status.sheet_pos_manager,
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            range_manager: &mut self.status.range_manager,
            cube_manager: &mut self.status.cube_manager,
            ext_ref_manager: &mut self.status.ext_ref_manager,
            name_id_manager: &mut self.status.name_id_manager,
            id_navigator: &mut self.status.navigator,
            idx_navigator: old_navigator,
            external_links_manager: &mut self.status.external_links_manager,
            dirty_ranges,
            dirty_cubes,
        };
        let executor = FormulaExecutor {
            manager: self.status.formula_manager.clone(),
            dirty_vertices: HashSet::new(),
        };
        executor.execute(payload, &mut ctx)
    }
}
