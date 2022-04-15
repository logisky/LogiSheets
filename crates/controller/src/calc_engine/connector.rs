use crate::vertex_manager::vertex::FormulaId;
use controller_base::{
    async_func::AsyncFuncCommitTrait, get_active_sheet::GetActiveSheetTrait,
    get_curr_addr::GetCurrAddrTrait, set_curr_cell::SetCurrCellTrait, CellId, FuncId, SheetId,
    TextId,
};
use parser::ast;
use std::collections::HashSet;

use super::calculator::calc_vertex::{CalcValue, CalcVertex};

pub trait Connector:
    AsyncFuncCommitTrait + GetActiveSheetTrait + GetCurrAddrTrait + SetCurrCellTrait
{
    fn convert(&mut self, v: &ast::CellReference) -> CalcVertex;
    fn get_calc_value(&mut self, vertex: CalcVertex) -> CalcValue;
    fn get_text(&self, tid: &TextId) -> Option<String>;
    fn get_func_name(&self, fid: &FuncId) -> Option<String>;
    fn get_cell_idx(&mut self, sheet_id: SheetId, cell_id: &CellId) -> Option<(usize, usize)>;
    fn get_cell_id(&mut self, sheet_id: SheetId, row: usize, col: usize) -> Option<CellId>;
    fn commit_calc_values(&mut self, vertex: FormulaId, result: CalcValue) -> HashSet<FormulaId>;
    fn is_async_func(&self, func_name: &str) -> bool;
}
