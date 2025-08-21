use imbl::{HashSet, Vector};
use itertools::Itertools;
use logisheets_base::SheetId;

use crate::edit_action::EditPayload;

use super::ctx::SheetPosExecCtx;

#[derive(Debug, Clone, Default)]
pub struct SheetPosManager {
    pub pos: Vector<SheetId>,
    pub hiddens: HashSet<SheetId>,
}

impl SheetPosManager {
    pub fn execute<C: SheetPosExecCtx>(mut self, payload: &EditPayload, ctx: &mut C) -> Self {
        match payload {
            EditPayload::CreateSheet(p) => {
                let (mut left, right) = self.pos.split_at(p.idx);
                let id = ctx.fetch_sheet_id(&p.new_name);
                left.push_back(id);
                left.append(right);
                ctx.has_updated();
                SheetPosManager {
                    pos: left,
                    hiddens: self.hiddens,
                }
            }
            EditPayload::DeleteSheet(p) => {
                ctx.has_updated();
                self.pos.remove(p.idx);
                self
            }
            _ => self,
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
