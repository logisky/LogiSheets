use im::{HashSet, Vector};
use itertools::Itertools;
use logisheets_base::SheetId;

use crate::{
    id_manager::SheetIdManager, payloads::sheet_shift::SheetShiftPayload,
    payloads::sheet_shift::SheetShiftType,
};

#[derive(Debug, Clone, Default)]
pub struct SheetPosManager {
    pub pos: Vector<SheetId>,
    pub hiddens: HashSet<SheetId>,
}

impl SheetPosManager {
    pub fn execute(
        self,
        payload: &SheetShiftPayload,
        sheet_id_manager: &mut SheetIdManager,
    ) -> Self {
        match payload.ty {
            SheetShiftType::Insert => {
                let new_name = {
                    let mut x = 1;
                    let mut name = format!("Sheet{}", x);
                    while sheet_id_manager.has(&name).is_some() {
                        x += 1;
                        name = format!("Sheet{}", x);
                    }
                    name
                };
                let (mut left, right) = self.pos.split_at(payload.idx);
                let id = sheet_id_manager.get_id(&new_name);
                left.push_back(id);
                left.append(right);
                SheetPosManager {
                    pos: left,
                    hiddens: self.hiddens,
                }
            }
            SheetShiftType::Delete => {
                let mut pos = self.pos;
                pos.remove(payload.idx);
                SheetPosManager {
                    pos,
                    hiddens: self.hiddens,
                }
            }
        }
    }

    pub fn get_sheet_id(&self, idx: usize) -> Option<SheetId> {
        let id = self.pos.get(idx)?;
        Some(id.clone())
    }

    pub fn get_sheet_idx(&self, id: &SheetId) -> Option<usize> {
        let result = self.pos.iter().find_position(|each| *each == id);
        match result {
            Some(r) => Some(r.0),
            None => None,
        }
    }
}
