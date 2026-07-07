//! Stores images placed inside cells.
//!
//! An image is anchored to a stable `CellId` (not a row/col position) so it
//! rides along when rows/columns are inserted or deleted. Bytes are held
//! behind an `Arc` so the persistent (imbl) map stays cheap to clone for
//! undo/redo snapshots. Persistence to/from xlsx lives in `file_loader` /
//! `file_saver` (as SpreadsheetDrawingML pictures under `xl/drawings/` +
//! `xl/media/`).

pub mod base64;
pub mod executor;

pub use executor::ImageExecutor;

use std::sync::Arc;

use imbl::HashMap;
use logisheets_base::{CellId, SheetId};

/// An image filling a single cell.
#[derive(Debug, Clone)]
pub struct CellImage {
    /// Stable, workbook-unique id (also seeds the media file name on save).
    pub id: String,
    /// Lowercase file extension without dot, e.g. `png`, `jpeg`, `gif`.
    pub format: String,
    pub data: Arc<Vec<u8>>,
}

#[derive(Debug, Clone, Default)]
pub struct ImageManager {
    pub images: HashMap<(SheetId, CellId), CellImage>,
}

impl ImageManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, sheet_id: SheetId, cell_id: CellId) -> Option<&CellImage> {
        self.images.get(&(sheet_id, cell_id))
    }

    pub fn insert(&mut self, sheet_id: SheetId, cell_id: CellId, image: CellImage) {
        self.images.insert((sheet_id, cell_id), image);
    }

    pub fn remove(&mut self, sheet_id: SheetId, cell_id: CellId) -> Option<CellImage> {
        self.images.remove(&(sheet_id, cell_id))
    }

    /// All images on a given sheet, as `(cell_id, image)` pairs.
    pub fn images_of_sheet(&self, sheet_id: SheetId) -> Vec<(CellId, CellImage)> {
        self.images
            .iter()
            .filter(|((s, _), _)| *s == sheet_id)
            .map(|((_, c), img)| (*c, img.clone()))
            .collect()
    }
}
