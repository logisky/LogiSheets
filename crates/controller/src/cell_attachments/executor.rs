use imbl::Vector;
use logisheets_base::errors::BasicError;

use crate::{
    edit_action::{AuthorInput, CommentMention, EditPayload},
    Error,
};

use super::{
    comment::{CommentNote, Mention, PersonInput},
    ctx::CellAttachmentsExecCtx,
    CellAttachmentsManager,
};

fn to_person_input(a: AuthorInput) -> PersonInput {
    PersonInput {
        display_name: a.display_name,
        user_id: a.user_id,
        provider_id: a.provider_id,
    }
}

fn resolve_mentions(
    manager: &mut CellAttachmentsManager,
    mentions: Vec<CommentMention>,
) -> Vector<Mention> {
    mentions
        .into_iter()
        .map(|m| {
            let person = manager
                .comments
                .persons
                .get_or_register(to_person_input(m.author));
            let mention_id = m
                .mention_id
                .unwrap_or_else(|| format!("{{{}}}", uuid::Uuid::new_v4()));
            Mention {
                person,
                start: m.start,
                len: m.len,
                mention_id,
            }
        })
        .collect()
}

pub struct CellAttachmentsExecutor {
    pub manager: CellAttachmentsManager,
}

impl CellAttachmentsExecutor {
    pub fn new(manager: CellAttachmentsManager) -> Self {
        Self { manager }
    }

    pub fn execute<C: CellAttachmentsExecCtx>(
        mut self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::MergeCells(merge_cells) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(merge_cells.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let start_cell_id = ctx.fetch_norm_cell_id(
                    &sheet_id,
                    merge_cells.start_row,
                    merge_cells.start_col,
                )?;
                let end_cell_id =
                    ctx.fetch_norm_cell_id(&sheet_id, merge_cells.end_row, merge_cells.end_col)?;
                self.manager
                    .merge_cells
                    .add_merge_cell(sheet_id, start_cell_id, end_cell_id);
                Ok((self, true))
            }
            EditPayload::SplitMergedCells(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = ctx.fetch_norm_cell_id(&sheet_id, p.row, p.col)?;

                if self
                    .manager
                    .merge_cells
                    .get_merge_cell(&sheet_id, &cell_id)
                    .is_some()
                {
                    self.manager.merge_cells = self
                        .manager
                        .merge_cells
                        .remove_merge_cell(sheet_id, cell_id);
                    Ok((self, true))
                } else {
                    Ok((self, false))
                }
            }
            EditPayload::AddComment(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let cell_id = ctx.fetch_cell_id(&sheet_id, p.row, p.col)?;
                let person = self
                    .manager
                    .comments
                    .persons
                    .get_or_register(to_person_input(p.author));
                let mentions = resolve_mentions(&mut self.manager, p.mentions);
                let note = CommentNote {
                    id: p.comment_id,
                    person,
                    dt: p.dt,
                    text: p.content,
                    parent: p.parent_id,
                    mentions,
                    resolved: false,
                };
                self.manager.comments.add_note(sheet_id, cell_id, note);
                Ok((self, true))
            }
            EditPayload::EditComment(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let mentions = resolve_mentions(&mut self.manager, p.mentions);
                let changed =
                    self.manager
                        .comments
                        .edit_note(sheet_id, &p.comment_id, p.content, mentions);
                Ok((self, changed))
            }
            EditPayload::DeleteComment(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let changed = self.manager.comments.delete_note(sheet_id, &p.comment_id);
                Ok((self, changed))
            }
            EditPayload::ResolveComment(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(|l| BasicError::SheetIdxExceed(l))?;
                let changed =
                    self.manager
                        .comments
                        .set_resolved(sheet_id, &p.comment_id, p.resolved);
                Ok((self, changed))
            }
            EditPayload::UpsertPerson(p) => {
                self.manager.comments.persons.get_or_register(PersonInput {
                    display_name: p.display_name,
                    user_id: p.user_id,
                    provider_id: p.provider_id,
                });
                Ok((self, true))
            }
            _ => Ok((self, false)),
        }
    }
}
