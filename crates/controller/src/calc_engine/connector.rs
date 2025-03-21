use logisheets_base::{
    async_func::AsyncFuncCommitTrait, get_curr_addr::GetCurrAddrTrait,
    set_curr_cell::SetCurrCellTrait, CellId, FuncId, Range, RangeId, SheetId,
};
use logisheets_parser::ast;

use super::calculator::calc_vertex::{CalcValue, CalcVertex};

use crate::errors::Result;

pub trait Connector: AsyncFuncCommitTrait + GetCurrAddrTrait + SetCurrCellTrait {
    fn convert(&mut self, v: &ast::CellReference) -> CalcVertex;
    fn get_calc_value(&mut self, vertex: CalcVertex) -> CalcValue;
    // fn get_text(&self, tid: &TextId) -> Result<String>;
    fn get_func_name(&self, fid: &FuncId) -> Result<String>;
    fn get_cell_idx(&self, sheet_id: SheetId, cell_id: &CellId) -> Result<(usize, usize)>;
    fn get_cell_id(&self, sheet_id: SheetId, row: usize, col: usize) -> Result<CellId>;
    fn get_sheet_id_by_name(&self, name: &str) -> Result<SheetId>;
    fn commit_calc_values(&mut self, vertex: (SheetId, CellId), result: CalcValue);
    fn is_async_func(&self, func_name: &str) -> bool;
    fn get_range(&self, sheet_id: &SheetId, range: &RangeId) -> Option<Range>;
    fn get_active_sheet(&self) -> SheetId;

    // This is always used in calculating the functions like RAND and TODAY.
    // These functions should be calculated every time the engine runs.
    // So every time these functions are calculated the current cell should marked as dirty cells in the next process.
    fn set_curr_as_dirty(&mut self) -> Result<()>;
}
