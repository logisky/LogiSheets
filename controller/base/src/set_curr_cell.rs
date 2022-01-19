use crate::{Addr, SheetId};

pub trait SetCurrCellTrait {
    fn set_curr_cell(&mut self, active_sheet: SheetId, addr: Addr);
}
