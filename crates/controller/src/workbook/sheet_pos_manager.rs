use imbl::{HashMap, HashSet, Vector};
use itertools::Itertools;
use logisheets_base::{errors::BasicError, SheetId};

use crate::edit_action::EditPayload;

use super::ctx::SheetInfoExecCtx;

#[derive(Debug, Clone, Default)]
pub struct SheetInfoManager {
    pub pos: Vector<SheetId>,
    pub hiddens: HashSet<SheetId>,
    pub colors: HashMap<SheetId, String>,
}

impl SheetInfoManager {
    pub fn execute<C: SheetInfoExecCtx>(
        mut self,
        payload: &EditPayload,
        ctx: &mut C,
    ) -> Result<Self, BasicError> {
        match payload {
            EditPayload::CreateSheet(p) => {
                let (mut left, right) = self.pos.split_at(p.idx);
                let id = ctx.fetch_sheet_id(&p.new_name);
                left.push_back(id);
                left.append(right);
                ctx.has_updated();
                Ok(SheetInfoManager {
                    pos: left,
                    hiddens: self.hiddens,
                    colors: self.colors,
                })
            }
            EditPayload::DeleteSheet(p) => {
                ctx.has_updated();
                let id = self.pos.remove(p.idx);
                self.hiddens.remove(&id);
                Ok(self)
            }
            EditPayload::SetSheetColor(p) => {
                let id = self
                    .get_sheet_id(p.idx)
                    .ok_or(BasicError::SheetIdxExceed(self.pos.len()))?;
                self.colors.insert(id, p.color.clone());
                Ok(self)
            }
            EditPayload::SetSheetVisible(p) => {
                let id = self
                    .get_sheet_id(p.idx)
                    .ok_or(BasicError::SheetIdxExceed(self.pos.len()))?;
                self.hiddens.insert(id);
                Ok(self)
            }
            _ => Ok(self),
        }
    }

    pub fn is_hidden(&self, sheet_id: &SheetId) -> bool {
        self.hiddens.contains(sheet_id)
    }

    pub fn get_color(&self, sheet_id: &SheetId) -> Option<String> {
        self.colors.get(sheet_id).cloned()
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
