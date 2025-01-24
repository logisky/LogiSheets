pub mod ctx;
pub mod diff;
mod manager;

use std::collections::HashSet;

use logisheets_base::{CellId, SheetId};
use manager::VersionManagerHelper;

use crate::{controller::status::Status, edit_action::PayloadsAction};

use self::diff::{convert_payloads_to_sheet_diff, Diff, SheetDiff};

const HISTORY_SIZE: usize = 50;
/// VersionManager records the history of a workbook and the payloads. It can help
/// users find out the minimal updates at a certain version.
pub type VersionManager = VersionManagerHelper<Status, SheetDiff, HISTORY_SIZE>;

impl VersionManager {
    pub fn record(
        &mut self,
        mut status: Status,
        processes: PayloadsAction,
        updated_cells: HashSet<(SheetId, CellId)>,
    ) {
        let diffs = convert_payloads_to_sheet_diff(&mut status, processes, updated_cells);
        self.add_status(status, diffs);
        self.version += 1;
    }

    // `None` means that users can not update the workbook to the latest one incremently.
    pub fn get_sheet_diffs_from_version(&self, sheet: SheetId, version: u32) -> Option<SheetDiff> {
        if version > self.version {
            return None;
        }

        if self.version - HISTORY_SIZE as u32 >= version {
            return None;
        }

        let start_idx = if self.version >= 50 {
            HISTORY_SIZE - 1 + (version - self.version) as usize
        } else {
            version as usize
        };

        let mut result: HashSet<Diff> = HashSet::new();

        for i in start_idx..self.undo_stack.len() {
            let sheet_diffs = self.diff_undo_stack.get(i)?;
            if let Some(diff) = sheet_diffs.get(&sheet) {
                if diff.diff_unavailable() {
                    return None;
                }
                result.extend(diff.data.clone())
            }
        }

        Some(SheetDiff { data: result })
    }
}
