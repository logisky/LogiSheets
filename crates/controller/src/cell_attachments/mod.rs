pub mod comment;
pub mod ctx;
pub mod executor;
pub mod merge_cell;

use comment::Comments;
use merge_cell::MergeCells;

#[derive(Debug, Clone, Default)]
pub struct CellAttachmentsManager {
    pub comments: Comments,
    pub merge_cells: MergeCells,
}
