use anyhow::Result;
use std::collections::{HashMap, HashSet};

use logisheets_base::{Addr, BlockRange, CellId, NormalRange, Range, SheetId};

use super::status::Status;
use crate::async_func_manager::AsyncFuncManager;
use crate::calc_engine::CalcEngine;
use crate::connectors::{CalcConnector, VertexConnector};
use crate::data_executor::DataExecutor;
use crate::formula_manager::{FormulaExecContext, Vertex};
use crate::payloads::name::NamePayload;
use crate::payloads::sheet_process::SheetProcess;
use crate::payloads::sheet_shift::{SheetRenamePayload, SheetShiftPayload};
use crate::payloads::Process;
use crate::settings::CalcConfig;

pub struct TransactionContext<'a> {
    pub book_name: &'a str,
    pub calc_config: CalcConfig,
    pub async_funcs: &'a HashSet<String>,
}

pub struct Transaction<'a> {
    pub status: Status,
    pub async_func_manager: &'a mut AsyncFuncManager,
    pub context: TransactionContext<'a>,
    pub proc: Vec<Process>,
}

impl<'a> Transaction<'a> {
    pub fn start(self) -> Result<Status> {
        let context = self.context;
        let mut async_func_manager = self.async_func_manager;
        let mut status = self.status;
        let mut calc_nodes = HashSet::<Vertex>::new();
        for proc in self.proc {
            let (new_status, nodes) = handle(status, proc, &context)?;
            calc_nodes.extend(nodes);
            status = new_status;
        }
        let Status {
            mut navigator,
            mut container,
            sheet_id_manager,
            mut func_id_manager,
            mut text_id_manager,
            mut external_links_manager,
            name_id_manager,
            sheet_pos_manager,
            style_manager,
            cell_attachment_manager,
            formula_manager,
        } = status;
        let connector = CalcConnector {
            navigator: &mut navigator,
            container: &mut container,
            ext_links: &mut external_links_manager,
            text_id_manager: &mut text_id_manager,
            func_id_manager: &mut func_id_manager,
            names_storage: HashMap::new(),
            cells_stroage: HashMap::new(),
            sheet_pos_manager: &sheet_pos_manager,
            async_func_manager: &mut async_func_manager,
            active_sheet: 0,
            curr_addr: Addr::default(),
            async_funcs: &context.async_funcs,
            formula_manager: &formula_manager,
        };
        let calc_engine = CalcEngine {
            config: context.calc_config,
            connector,
            formula_manager: &formula_manager,
            dirty_vertices: calc_nodes,
        };
        calc_engine.start();
        Ok(Status {
            navigator,
            container,
            sheet_id_manager,
            func_id_manager,
            text_id_manager,
            name_id_manager,
            external_links_manager,
            sheet_pos_manager,
            style_manager,
            cell_attachment_manager,
            formula_manager,
        })
    }
}

fn handle(
    status: Status,
    proc: Process,
    context: &TransactionContext,
) -> Result<(Status, HashSet<Vertex>)> {
    match proc {
        Process::Sheet(sheet_proc) => handle_sheet_proc(status, sheet_proc, context),
        Process::Name(p) => Ok((handle_name_proc(status, p, context), HashSet::new())),
        Process::SheetShift(sheet_shift) => Ok((
            handle_sheet_shift_payload(status, sheet_shift),
            HashSet::new(),
        )),
        Process::SheetRename(rename) => {
            Ok((handle_sheet_rename_payload(status, rename), HashSet::new()))
        }
        Process::Recalc(dirty) => Ok(handle_recalc_proc(status, dirty)),
    }
}

fn handle_recalc_proc(status: Status, dirty: Vec<(SheetId, CellId)>) -> (Status, HashSet<Vertex>) {
    let calc_nodes = dirty
        .into_iter()
        .map(|(sheet_id, cell_id)| {
            let range = match cell_id {
                CellId::NormalCell(nid) => Range::Normal(NormalRange::Single(nid)),
                CellId::BlockCell(bid) => Range::Block(BlockRange::Single(bid)),
            };
            let range_id = status
                .formula_manager
                .range_manager
                .get_range_id_assert(&sheet_id, &range)
                .unwrap();
            Vertex::Range(sheet_id, range_id)
        })
        .collect();
    (status, calc_nodes)
}

fn handle_sheet_rename_payload(status: Status, payload: SheetRenamePayload) -> Status {
    let mut res = status;
    res.sheet_id_manager
        .rename(&payload.old_name, payload.new_name);
    res
}

fn handle_sheet_shift_payload(status: Status, payload: SheetShiftPayload) -> Status {
    let Status {
        formula_manager,
        navigator,
        container,
        sheet_id_manager,
        func_id_manager,
        text_id_manager,
        name_id_manager,
        external_links_manager,
        sheet_pos_manager,
        style_manager,
        cell_attachment_manager,
    } = status;
    let DataExecutor {
        navigator,
        style_manager,
        container,
        ..
    } = DataExecutor::new(navigator, style_manager, container)
        .execute_sheet_shift(&payload)
        .unwrap();
    let sheet_pos = sheet_pos_manager.execute(&payload);
    Status {
        formula_manager,
        navigator,
        container,
        sheet_id_manager,
        func_id_manager,
        text_id_manager,
        name_id_manager,
        external_links_manager,
        sheet_pos_manager: sheet_pos,
        style_manager,
        cell_attachment_manager,
    }
}

fn handle_name_proc(
    _status: Status,
    _payload: NamePayload,
    _context: &TransactionContext,
) -> Status {
    todo!()
}

fn handle_sheet_proc(
    status: Status,
    proc: SheetProcess,
    context: &TransactionContext,
) -> Result<(Status, HashSet<Vertex>)> {
    let Status {
        navigator,
        formula_manager,
        container,
        mut sheet_id_manager,
        mut func_id_manager,
        mut text_id_manager,
        mut external_links_manager,
        mut name_id_manager,
        mut sheet_pos_manager,
        style_manager,
        cell_attachment_manager,
    } = status;
    let mut old_navigator = navigator.clone();
    let data_executor = DataExecutor::new(navigator, style_manager, container);
    let DataExecutor {
        navigator: mut new_navigator,
        container: mut new_container,
        style_manager: new_style_manager,
        ..
    } = data_executor.execute_sheet_proc(&proc)?;
    let active_sheet = proc.sheet_id;
    let FormulaExecContext {
        manager: formula_manager,
        dirty_vertices,
    } = formula_manager.execute_sheet_proc(
        proc,
        &mut VertexConnector {
            book_name: context.book_name,
            active_sheet,
            container: &mut new_container,
            sheet_pos_manager: &mut sheet_pos_manager,
            sheet_id_manager: &mut sheet_id_manager,
            text_id_manager: &mut text_id_manager,
            func_id_manager: &mut func_id_manager,
            name_id_manager: &mut name_id_manager,
            id_navigator: &mut new_navigator,
            idx_navigator: &mut old_navigator,
            external_links_manager: &mut external_links_manager,
        },
    )?;
    let status = Status {
        navigator: new_navigator,
        formula_manager,
        sheet_id_manager,
        container: new_container,
        func_id_manager,
        text_id_manager,
        external_links_manager,
        name_id_manager,
        sheet_pos_manager,
        style_manager: new_style_manager,
        cell_attachment_manager,
    };
    Ok((status, dirty_vertices))
}
