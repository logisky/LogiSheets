use crate::{NormalCellId, SheetId};

pub trait GetNormCellsInLineTrait {
    fn get_norm_cell_ids_by_row(
        &mut self,
        sheet_id: SheetId,
        row: usize,
        cnt: usize,
    ) -> Vec<NormalCellId>;
    fn get_norm_cell_ids_by_col(
        &mut self,
        sheet_id: SheetId,
        col: usize,
        cnt: usize,
    ) -> Vec<NormalCellId>;
}
