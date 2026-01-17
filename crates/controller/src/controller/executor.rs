use std::collections::{HashMap, HashSet};

use logisheets_base::{errors::BasicError, Addr, CellId, CubeId, RangeId, SheetId};

use crate::{
    async_func_manager::AsyncFuncManager,
    block_manager::schema_manager::executor::BlockSchemaExecutor,
    calc_engine::CalcEngine,
    cell_attachments::executor::CellAttachmentsExecutor,
    connectors::{
        BlockSchemaConnector, CalcConnector, CellAttachmentsConnector, ContainerConnector,
        CubeConnector, ExclusiveConnector, FormulaConnector, NavigatorConnector, RangeConnector,
        SheetInfoConnector,
    },
    container::ContainerExecutor,
    cube_manager::executors::CubeExecutor,
    edit_action::{EditPayload, PayloadsAction, SheetRename},
    exclusive::executor::ExclusiveManagerExecutor,
    formula_manager::{FormulaExecutor, Vertex},
    navigator::{NavExecutor, Navigator},
    range_manager::RangeExecutor,
    settings::CalcConfig,
    sid_assigner::ShadowIdAssigner,
    version_manager::VersionManager,
    workbook::sheet_info_manager::SheetInfoManager,
    Error,
};

use super::status::Status;

pub struct Executor<'a> {
    pub status: Status,
    pub sid_assigner: &'a ShadowIdAssigner,
    pub version_manager: &'a mut VersionManager,
    pub async_func_manager: &'a mut AsyncFuncManager,
    pub book_name: &'a str,
    pub calc_config: CalcConfig,
    pub async_funcs: &'a HashSet<String>,
    pub updated_cells: HashSet<(SheetId, CellId)>,
    pub cells_removed: HashSet<(SheetId, CellId)>,
    pub style_updated: HashSet<(SheetId, CellId)>,
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

        if payload_action.init {
            result
                .version_manager
                .set_init_status(result.status.clone());
        } else if payload_action.undoable {
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
                        .sheet_info_manager
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

        let old_navigator = result.status.navigator.clone();
        let (nav_executor, nav_updated) = result.execute_navigator(payload.clone())?;

        let range_executor = result.execute_range(payload.clone())?;
        let cube_executor = result.execute_cube(payload.clone())?;

        let (container_executor, cell_attatchment_updated) =
            result.execute_container(payload.clone())?;
        result.status.container = container_executor.container;

        result
            .cells_removed
            .extend(container_executor.cells_removed);
        result
            .updated_cells
            .extend(container_executor.value_changed);

        let (exclusive, exclusive_updated) = result.execute_exclusive(payload.clone())?;
        result.status.exclusive_manager = exclusive.manager;

        let (cell_attachments, updated) = result.execute_cell_attachments(payload.clone())?;
        result.status.cell_attachment_manager = cell_attachments.manager;

        let mut dirty_ranges = range_executor.dirty_ranges;
        range_executor.removed_ranges.into_iter().for_each(|e| {
            dirty_ranges.insert(e);
        });
        let mut dirty_cubes = cube_executor.dirty_cubes;
        cube_executor.removed_cubes.into_iter().for_each(|e| {
            dirty_cubes.insert(e);
        });

        let (block_schema_executor, _block_schema_updated) =
            result.execute_bind_schema(payload.clone())?;
        let dirty_schemas = block_schema_executor.dirty_schemas;
        result.status.block_schema_manager = block_schema_executor.manager;

        result.status.navigator = nav_executor.nav;
        result.status.range_manager = range_executor.manager;
        result.status.cube_manager = cube_executor.manager;

        let formula_executor = result.execute_formula(
            payload.clone(),
            &old_navigator,
            dirty_ranges,
            dirty_schemas,
            dirty_cubes,
            range_executor.trigger,
        )?;

        let cell_updated =
            if updated || nav_updated || cell_attatchment_updated || exclusive_updated {
                true
            } else {
                result.updated_cells.len() > 0 || result.cells_removed.len() > 0
            };

        let (sheet_pos_manager, sheet_updated) = result.execute_sheet_info(&payload)?;
        result.status.sheet_info_manager = sheet_pos_manager;

        let mut dirty_vertices = formula_executor.dirty_vertices;
        dirty_vertices.extend(result.dirty_vertices);

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
                sheet_info_manager: result.status.sheet_info_manager,
                style_manager: result.status.style_manager,
                cell_attachment_manager: result.status.cell_attachment_manager,
                dirty_cells_next_round: result.status.dirty_cells_next_round,
                exclusive_manager: result.status.exclusive_manager,
                block_schema_manager: result.status.block_schema_manager,
                field_render_manager: result.status.field_render_manager,
            },
            version_manager: result.version_manager,
            async_func_manager: result.async_func_manager,
            book_name: result.book_name,
            calc_config: result.calc_config,
            async_funcs: result.async_funcs,
            dirty_vertices: dirty_vertices,
            updated_cells: result.updated_cells,
            cells_removed: result.cells_removed,
            sheet_updated,
            cell_updated,
            sid_assigner: result.sid_assigner,
            style_updated: result.style_updated,
        })
    }

    pub fn calc(self) -> Result<Self, Error> {
        let mut dirty_cells_in_next_run = imbl::HashSet::new();
        let mut calc_cells: HashSet<(SheetId, CellId)> = HashSet::new();
        let Executor {
            mut status,
            sid_assigner,
            version_manager,
            mut async_func_manager,
            book_name,
            calc_config,
            async_funcs,
            mut updated_cells,
            cells_removed,
            style_updated,
            dirty_vertices,
            sheet_updated,
            cell_updated,
        } = self;
        let connector = CalcConnector {
            range_manager: &status.range_manager,
            cube_manager: &status.cube_manager,
            navigator: &mut status.navigator,
            container: &mut status.container,
            ext_links: &mut status.external_links_manager,
            text_id_manager: &mut status.text_id_manager,
            func_id_manager: &mut status.func_id_manager,
            sheet_id_manager: &status.sheet_id_manager,
            names_storage: HashMap::new(),
            cells_storage: HashMap::new(),
            sheet_pos_manager: &mut status.sheet_info_manager,
            async_func_manager: &mut async_func_manager,
            async_funcs: &async_funcs,
            active_sheet: 0,
            curr_addr: Addr::default(),
            dirty_cells_in_next_run: &mut dirty_cells_in_next_run,
            calc_cells: &mut calc_cells,
            block_schema_manager: &status.block_schema_manager,
        };
        let engine = CalcEngine {
            formula_manager: &status.formula_manager,
            dirty_vertices,
            config: self.calc_config,
            connector,
        };

        engine.start();

        updated_cells.extend(calc_cells);
        Ok(Executor {
            status,
            sid_assigner,
            version_manager,
            async_func_manager,
            book_name,
            calc_config,
            async_funcs,
            updated_cells,
            cells_removed,
            style_updated,
            dirty_vertices: HashSet::new(),
            sheet_updated,
            cell_updated,
        })
    }

    fn execute_range(&mut self, payload: EditPayload) -> Result<RangeExecutor, Error> {
        let ctx = RangeConnector {
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            navigator: &self.status.navigator,
            sheet_pos_manager: &self.status.sheet_info_manager,
            formula_manager: &self.status.formula_manager,
        };
        let executor = RangeExecutor::new(self.status.range_manager.clone());
        executor.execute(&ctx, payload)
    }

    fn execute_bind_schema(
        &mut self,
        payload: EditPayload,
    ) -> Result<(BlockSchemaExecutor, bool), Error> {
        let mut ctx = BlockSchemaConnector {
            id_navigator: &self.status.navigator,
            sheet_info_manager: &mut self.status.sheet_info_manager,
            sheet_id_manager: &mut self.status.sheet_id_manager,
        };
        let executor = BlockSchemaExecutor::new(self.status.block_schema_manager.clone());
        executor.execute(&mut ctx, payload)
    }

    fn execute_cube(&mut self, payload: EditPayload) -> Result<CubeExecutor, Error> {
        let ctx = CubeConnector {
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            navigator: &self.status.navigator,
            sheet_pos_manager: &self.status.sheet_info_manager,
        };
        let executor = CubeExecutor::new(self.status.cube_manager.clone());
        executor.execute(&ctx, payload)
    }

    fn execute_navigator(&mut self, payload: EditPayload) -> Result<(NavExecutor, bool), Error> {
        let mut ctx = NavigatorConnector {
            sheet_pos_manager: &self.status.sheet_info_manager,
            sheet_id_manager: &mut self.status.sheet_id_manager,
        };
        let executor = NavExecutor::new(self.status.navigator.clone());
        executor.execute(&mut ctx, payload)
    }

    fn execute_cell_attachments(
        &mut self,
        payload: EditPayload,
    ) -> Result<(CellAttachmentsExecutor, bool), Error> {
        let mut ctx = CellAttachmentsConnector {
            sheet_pos_manager: &self.status.sheet_info_manager,
            navigator: &self.status.navigator,
            sheet_id_manager: &mut self.status.sheet_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            func_id_manager: &mut self.status.func_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
        };
        let executor = CellAttachmentsExecutor::new(self.status.cell_attachment_manager.clone());
        executor.execute(&mut ctx, payload)
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
            sheet_pos_manager: &self.status.sheet_info_manager,
            style_manager: &mut self.status.style_manager,
        };
        let executor = ContainerExecutor::new(self.status.container.clone());
        executor.execute(&mut ctx, payload)
    }

    fn execute_exclusive(
        &mut self,
        payload: EditPayload,
    ) -> Result<(ExclusiveManagerExecutor, bool), Error> {
        let mut ctx = ExclusiveConnector {
            sheet_id_manager: &mut self.status.sheet_id_manager,
            text_id_manager: &mut self.status.text_id_manager,
            func_id_manager: &mut self.status.func_id_manager,
            name_id_manager: &mut self.status.name_id_manager,
            external_links_manager: &mut self.status.external_links_manager,
            navigator: &self.status.navigator,
            sheet_pos_manager: &self.status.sheet_info_manager,
            style_manager: &mut self.status.style_manager,
        };
        let executor = ExclusiveManagerExecutor::new(self.status.exclusive_manager.clone());
        executor.execute(&mut ctx, payload)
    }

    fn execute_sheet_info(
        &mut self,
        payload: &EditPayload,
    ) -> Result<(SheetInfoManager, bool), Error> {
        let mut ctx = SheetInfoConnector {
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
            .sheet_info_manager
            .clone()
            .execute(payload, &mut ctx)?;
        Ok((new_manager, ctx.updated))
    }

    fn execute_formula(
        &mut self,
        payload: EditPayload,
        old_navigator: &Navigator,
        dirty_ranges: HashSet<(SheetId, RangeId)>,
        dirty_schemas: HashSet<String>,
        dirty_cubes: HashSet<CubeId>,
        trigger: Option<(SheetId, RangeId)>,
    ) -> Result<FormulaExecutor, Error> {
        let mut ctx = FormulaConnector {
            book_name: self.book_name,
            sheet_pos_manager: &mut self.status.sheet_info_manager,
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
            sid_assigner: &self.sid_assigner,
        };
        let executor = FormulaExecutor {
            manager: self.status.formula_manager.clone(),
            dirty_vertices: HashSet::new(),
            dirty_ranges,
            dirty_schemas,
            dirty_cubes,
            trigger,
        };
        executor.execute(payload, &mut ctx)
    }
}
