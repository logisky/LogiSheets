mod executors;
pub mod graph;

use graph::Graph;
use im::HashMap;
use logisheets_base::{
    block_affect::BlockAffectTrait, get_active_sheet::GetActiveSheetTrait,
    get_book_name::GetBookNameTrait, id_fetcher::IdFetcherTrait, index_fetcher::IndexFetcherTrait,
    CubeId, ExtRefId, NameId, RangeId, SheetId,
};
use logisheets_parser::ast;

use crate::{
    cube_manager::CubeManger,
    errors::Error,
    ext_ref_manager::ExtRefManager,
    payloads::sheet_process::{
        block::BlockPayload,
        cell::CellChange,
        shift::{Direction, ShiftPayload, ShiftType},
        SheetPayload, SheetProcess,
    },
    range_manager::RangeManager,
    CellId,
};

use self::executors::{
    add_ast_node, create_block, delete_block_line, delete_line, input_formula, input_value,
    insert_block_line, insert_line, move_block,
};

type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Clone)]
pub struct FormulaManager {
    pub graph: Graph<Vertex>,
    pub formulas: HashMap<(SheetId, CellId), ast::Node>,
    pub range_manager: RangeManager,
    pub cube_manager: CubeManger,
    pub ext_ref_manager: ExtRefManager,
    pub names: HashMap<NameId, ast::Node>,
}

impl FormulaManager {
    pub fn new() -> Self {
        FormulaManager {
            graph: Graph::<Vertex>::new(),
            formulas: HashMap::new(),
            range_manager: RangeManager::new(),
            cube_manager: CubeManger::new(),
            ext_ref_manager: ExtRefManager::new(),
            names: HashMap::new(),
        }
    }

    // Only used in loading a file. In a loading file process, we do not
    // need to find out the dirty vertex.
    pub fn add_ast_node(
        &mut self,
        sheet_id: SheetId,
        cell_id: CellId,
        range_id: RangeId,
        ast: ast::Node,
    ) {
        add_ast_node(self, sheet_id, cell_id, range_id, ast)
    }

    pub fn execute_sheet_proc<C>(
        self,
        proc: &SheetProcess,
        ctx: &mut C,
    ) -> Result<FormulaExecContext>
    where
        C: IdFetcherTrait
            + IndexFetcherTrait
            + BlockAffectTrait
            + GetActiveSheetTrait
            + GetBookNameTrait,
    {
        let sheet_id = proc.sheet_id;
        let exec_ctx = FormulaExecContext::new(self);
        match &proc.payload {
            SheetPayload::Shift(shift_payload) => match shift_payload {
                ShiftPayload::Line(ls) => match (&ls.ty, &ls.direction) {
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
            SheetPayload::Formula(fp) => input_formula(
                exec_ctx,
                sheet_id,
                fp.row,
                fp.col,
                fp.formula.to_string(),
                ctx,
            ),
            SheetPayload::Block(block_payload) => match block_payload {
                BlockPayload::Create(payload) => create_block(
                    exec_ctx,
                    sheet_id,
                    payload.block_id,
                    payload.master_row,
                    payload.master_col,
                    payload.row_cnt,
                    payload.col_cnt,
                    ctx,
                ),
                BlockPayload::DeleteCols(payload) => delete_block_line(
                    exec_ctx,
                    sheet_id,
                    payload.block_id,
                    false,
                    payload.idx,
                    payload.delete_cnt,
                    ctx,
                ),
                BlockPayload::DeleteRows(payload) => delete_block_line(
                    exec_ctx,
                    sheet_id,
                    payload.block_id,
                    true,
                    payload.idx,
                    payload.delete_cnt,
                    ctx,
                ),
                BlockPayload::InsertCols(payload) => insert_block_line(
                    exec_ctx,
                    sheet_id,
                    payload.block_id,
                    false,
                    payload.idx,
                    payload.insert_cnt,
                    ctx,
                ),
                BlockPayload::InsertRows(payload) => insert_block_line(
                    exec_ctx,
                    sheet_id,
                    payload.block_id,
                    true,
                    payload.idx,
                    payload.insert_cnt,
                    ctx,
                ),
                BlockPayload::Move(payload) => move_block(
                    exec_ctx,
                    sheet_id,
                    payload.block_id,
                    payload.new_master_row,
                    payload.new_master_col,
                    ctx,
                ),
                BlockPayload::Remove(_) => Ok(exec_ctx),
            },
            SheetPayload::Cell(cp) => match &cp.change {
                CellChange::Value(v) => {
                    input_value(exec_ctx, sheet_id, cp.row, cp.col, v.clone(), ctx)
                }
                _ => Ok(exec_ctx),
            },
            _ => Ok(exec_ctx),
        }
    }
}

#[derive(Debug, Clone)]
pub struct FormulaExecContext {
    pub manager: FormulaManager,
    pub dirty_vertices: std::collections::HashSet<Vertex>,
}

impl FormulaExecContext {
    pub fn new(manager: FormulaManager) -> Self {
        FormulaExecContext {
            manager,
            dirty_vertices: std::collections::HashSet::new(),
        }
    }
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum Vertex {
    Range(SheetId, RangeId),
    Cube(CubeId),
    Ext(ExtRefId),
    Name(NameId),
}
