pub mod name;
pub mod sheet_process;
pub mod sheet_shift;
use logisheets_base::{CellId, SheetId};
use name::NamePayload;
use sheet_process::SheetProcess;
use sheet_shift::SheetRenamePayload;
use sheet_shift::SheetShiftPayload;

#[derive(Debug, Clone)]
pub enum Process {
    Sheet(SheetProcess),
    Name(NamePayload),
    SheetShift(SheetShiftPayload),
    SheetRename(SheetRenamePayload),
    Recalc(Vec<(SheetId, CellId)>),
}
