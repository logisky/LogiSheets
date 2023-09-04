use im::{HashSet, Vector};
use itertools::Itertools;
use logisheets_base::SheetId;

use crate::{payloads::sheet_shift::SheetShiftPayload, payloads::sheet_shift::SheetShiftType};

#[derive(Debug, Clone, Default)]
pub struct SheetPosManager {
    pub pos: Vector<SheetId>,
    pub hiddens: HashSet<SheetId>,
}

impl SheetPosManager {
    pub fn execute(self, payload: &SheetShiftPayload) -> Self {
        match payload.ty {
            SheetShiftType::Insert => {
                let (mut left, right) = self.pos.split_at(payload.idx);
                let id = payload.id;
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

    pub fn is_hidden(&self, sheet_id: &SheetId) -> bool {
        self.hiddens.contains(sheet_id)
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
