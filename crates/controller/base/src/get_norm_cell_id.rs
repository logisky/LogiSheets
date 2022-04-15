use crate::{NormalCellId, SheetId};

pub trait GetNormCellIdTrait {
    fn get_norm_cell_id(
        &mut self,
        sheet_id: SheetId,
        row: usize,
        col: usize,
    ) -> Option<NormalCellId>;
}
