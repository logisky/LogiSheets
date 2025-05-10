use diy_cell::DiyCellManager;

pub mod ctx;
mod diy_cell;
pub mod executor;

#[derive(Debug, Clone, Default)]
pub struct ExclusiveManager {
    pub diy_cell_manager: DiyCellManager,
}
