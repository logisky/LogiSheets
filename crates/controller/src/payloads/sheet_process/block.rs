use logisheets_base::BlockId;

#[derive(Debug, Clone)]
pub struct CreateBlockPayload {
    // block id is assigned by block creater. Block creater is responsible for
    // the uniqueness of block id. Block occupying this id would be removed
    // before creating.
    pub block_id: BlockId,
    pub master_row: usize,
    pub master_col: usize,
    pub row_cnt: usize,
    pub col_cnt: usize,
}

#[derive(Debug, Clone)]
pub struct RemoveBlockPayload {
    pub block_id: BlockId,
}

#[derive(Debug, Clone)]
pub struct MoveBlockPayload {
    pub block_id: BlockId,
    pub new_master_row: usize,
    pub new_master_col: usize,
}

#[derive(Debug, Clone)]
pub struct InsertRowsPayload {
    pub block_id: BlockId,
    pub insert_cnt: usize,
    pub idx: usize,
}

#[derive(Debug, Clone)]
pub struct InsertColsPayload {
    pub block_id: BlockId,
    pub insert_cnt: usize,
    pub idx: usize,
}

#[derive(Debug, Clone)]
pub struct DeleteRowsPayload {
    pub block_id: BlockId,
    pub delete_cnt: usize,
    pub idx: usize,
}

#[derive(Debug, Clone)]
pub struct DeleteColsPayload {
    pub block_id: BlockId,
    pub delete_cnt: usize,
    pub idx: usize,
}

#[derive(Debug, Clone)]
pub enum BlockPayload {
    Create(CreateBlockPayload),
    DeleteCols(DeleteColsPayload),
    DeleteRows(DeleteRowsPayload),
    InsertCols(InsertColsPayload),
    InsertRows(InsertRowsPayload),
    Move(MoveBlockPayload),
    Remove(RemoveBlockPayload),
}
