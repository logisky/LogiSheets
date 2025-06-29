use appendix::AppendixManager;
use diy_cell::DiyCellManager;

mod appendix;
pub mod ctx;
mod diy_cell;
pub mod executor;

pub use appendix::{Appendix, AppendixWithCell};

#[derive(Debug, Clone, Default)]
pub struct ExclusiveManager {
    pub diy_cell_manager: DiyCellManager,
    pub appendix_manager: AppendixManager,
}
