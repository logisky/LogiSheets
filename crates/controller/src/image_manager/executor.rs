use std::sync::Arc;

use logisheets_base::{
    errors::BasicError,
    id_fetcher::{IdFetcherTrait, SheetIdFetcherByIdxTrait},
};

use crate::{Error, edit_action::EditPayload};

use super::{CellImage, ImageManager, base64};

pub struct ImageExecutor {
    pub manager: ImageManager,
}

impl ImageExecutor {
    pub fn new(manager: ImageManager) -> Self {
        Self { manager }
    }

    /// Handle image payloads. Returns `(self, changed)`; `changed` is `false`
    /// for payloads this executor does not care about.
    pub fn execute<C: IdFetcherTrait + SheetIdFetcherByIdxTrait>(
        mut self,
        ctx: &mut C,
        payload: EditPayload,
    ) -> Result<(Self, bool), Error> {
        match payload {
            EditPayload::SetCellImage(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(BasicError::SheetIdxExceed)?;
                let cell_id = ctx.fetch_cell_id(&sheet_id, p.row, p.col)?;
                let data = base64::decode(&p.data)
                    .ok_or_else(|| Error::PayloadError("invalid base64 image data".to_string()))?;
                self.manager.insert(
                    sheet_id,
                    cell_id,
                    CellImage {
                        id: p.image_id,
                        format: normalize_format(&p.format),
                        data: Arc::new(data),
                    },
                );
                Ok((self, true))
            }
            EditPayload::DeleteCellImage(p) => {
                let sheet_id = ctx
                    .fetch_sheet_id_by_index(p.sheet_idx)
                    .map_err(BasicError::SheetIdxExceed)?;
                let cell_id = ctx.fetch_cell_id(&sheet_id, p.row, p.col)?;
                let existed = self.manager.remove(sheet_id, cell_id).is_some();
                Ok((self, existed))
            }
            _ => Ok((self, false)),
        }
    }
}

/// Normalize a user-supplied format string to a bare lowercase extension.
fn normalize_format(fmt: &str) -> String {
    let f = fmt.trim().to_ascii_lowercase();
    // Accept things like "image/png" or ".png".
    let f = f.rsplit('/').next().unwrap_or(&f);
    let f = f.trim_start_matches('.');
    match f {
        "jpg" => "jpeg".to_string(),
        other if other.is_empty() => "png".to_string(),
        other => other.to_string(),
    }
}
