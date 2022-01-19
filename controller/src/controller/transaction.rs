use std::collections::{HashMap, HashSet};

use controller_base::{Addr, CellId, SheetId};

use super::status::Status;
use crate::async_func_manager::AsyncFuncManager;
use crate::calc_engine::CalcEngine;
use crate::connectors::{CalcConnector, VertexConnector};
use crate::data_executor::DataExecutor;
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
    pub fn start(self) -> Status {
        log!("transaction start");
        let context = self.context;
        let mut async_func_manager = self.async_func_manager;
        let Status {
            mut vertex_manager,
            mut navigator,
            mut container,
            sheet_id_manager,
            mut func_id_manager,
            mut text_id_manager,
            external_links_manager,
            name_id_manager,
            sheet_pos_manager,
            style_manager,
            cell_attachment_manager,
        } = self
            .proc
            .into_iter()
            .fold(self.status, |prev, proc| handle(prev, proc, &context));
        let vm = vertex_manager.clone_for_calc();
        let connector = CalcConnector {
            vertex_status: &vertex_manager.status,
            navigator: &mut navigator,
            container: &mut container,
            ext_links: &external_links_manager,
            text_id_manager: &mut text_id_manager,
            func_id_manager: &mut func_id_manager,
            names_storage: HashMap::new(),
            cells_stroage: HashMap::new(),
            sheet_pos_manager: &sheet_pos_manager,
            async_func_manager: &mut async_func_manager,
            active_sheet: 0,
            curr_addr: Addr::default(),
            async_funcs: &context.async_funcs,
        };
        let calc_engine = CalcEngine {
            vertex_manager: vm,
            config: context.calc_config,
            connector,
        };
        calc_engine.start();
        Status {
            navigator,
            vertex_manager,
            container,
            sheet_id_manager,
            func_id_manager,
            text_id_manager,
            name_id_manager,
            external_links_manager,
            sheet_pos_manager,
            style_manager,
            cell_attachment_manager,
        }
    }
}

fn handle(status: Status, proc: Process, context: &TransactionContext) -> Status {
    log!("try to handle proc");
    log!("{:?}", &proc);
    match proc {
        Process::Sheet(sheet_proc) => handle_sheet_proc(status, sheet_proc, context),
        Process::Name(p) => handle_name_proc(status, p, context),
        Process::SheetShift(sheet_shift) => handle_sheet_shift_payload(status, sheet_shift),
        Process::SheetRename(rename) => handle_sheet_rename_payload(status, rename),
        Process::Recalc(dirty) => handle_recalc_proc(status, dirty),
    }
}

fn handle_recalc_proc(status: Status, dirty: Vec<(SheetId, CellId)>) -> Status {
    let mut res = status.clone();
    let vertex_manager = &mut res.vertex_manager;
    dirty.into_iter().for_each(|(sheet_id, cell_id)| {
        vertex_manager.dirty_nodes.insert((sheet_id, cell_id));
    });
    res
}

fn handle_sheet_rename_payload(status: Status, payload: SheetRenamePayload) -> Status {
    let mut res = status;
    res.sheet_id_manager
        .rename(&payload.old_name, payload.new_name);
    res
}

fn handle_sheet_shift_payload(status: Status, payload: SheetShiftPayload) -> Status {
    let Status {
        navigator,
        vertex_manager,
        container,
        mut sheet_id_manager,
        func_id_manager,
        text_id_manager,
        name_id_manager,
        external_links_manager,
        sheet_pos_manager,
        style_manager,
        cell_attachment_manager,
    } = status;
    let sheet_pos = sheet_pos_manager.execute(&payload, &mut sheet_id_manager);
    Status {
        navigator,
        vertex_manager,
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

fn handle_name_proc(status: Status, payload: NamePayload, context: &TransactionContext) -> Status {
    todo!()
}

fn handle_sheet_proc(status: Status, proc: SheetProcess, context: &TransactionContext) -> Status {
    let Status {
        navigator,
        vertex_manager,
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
    let data_executor = DataExecutor {
        navigator,
        container,
        style_manager,
    };
    let DataExecutor {
        navigator: mut new_navigator,
        container: mut new_container,
        style_manager: new_style_manager,
    } = data_executor.execute(&proc);
    let active_sheet = proc.sheet_id;
    let vertex_manager = vertex_manager.execute_sheet_proc(
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
    );
    Status {
        navigator: new_navigator,
        vertex_manager,
        sheet_id_manager,
        container: new_container,
        func_id_manager,
        text_id_manager,
        external_links_manager,
        name_id_manager,
        sheet_pos_manager,
        style_manager: new_style_manager,
        cell_attachment_manager,
    }
}
