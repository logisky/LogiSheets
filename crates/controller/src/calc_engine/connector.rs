use anyhow::Result;
use logisheets_base::{
    async_func::AsyncFuncCommitTrait, get_active_sheet::GetActiveSheetTrait,
    get_curr_addr::GetCurrAddrTrait, set_curr_cell::SetCurrCellTrait, CellId, FuncId, Range,
    RangeId, SheetId, TextId,
};
use logisheets_parser::ast;

use super::calculator::calc_vertex::{CalcValue, CalcVertex};

pub trait Connector:
    AsyncFuncCommitTrait + GetActiveSheetTrait + GetCurrAddrTrait + SetCurrCellTrait
{
    fn convert(&mut self, v: &ast::CellReference) -> CalcVertex;
    fn get_calc_value(&mut self, vertex: CalcVertex) -> CalcValue;
    fn get_text(&self, tid: &TextId) -> Result<String>;
    fn get_func_name(&self, fid: &FuncId) -> Result<String>;
    fn get_cell_idx(&mut self, sheet_id: SheetId, cell_id: &CellId) -> Result<(usize, usize)>;
    fn get_cell_id(&mut self, sheet_id: SheetId, row: usize, col: usize) -> Result<CellId>;
    fn commit_calc_values(&mut self, vertex: (SheetId, CellId), result: CalcValue);
    fn is_async_func(&self, func_name: &str) -> bool;
    fn get_range(&self, sheet_id: &SheetId, range: &RangeId) -> Range;
}
