pub mod diff;

use std::collections::{HashMap, HashSet, VecDeque};

use logisheets_base::{CellId, SheetId};

use crate::{controller::status::Status, payloads::Process};

use self::diff::{convert_payloads_to_sheet_diff, Diff, SheetDiff};

const HISTORY_SIZE: usize = 50;

/// VersionManager records the history of a workbook and the payloads. It can help
/// users find out the minimal updates at a certain version.
#[derive(Debug, Default)]
pub struct VersionManager {
    version: u32,
    undo_stack: VecDeque<Status>,
    redo_stack: VecDeque<Status>,
    diff_undo_stack: VecDeque<HashMap<SheetId, SheetDiff>>,
    diff_redo_stack: VecDeque<HashMap<SheetId, SheetDiff>>,
    current_status: Status,
    current_diffs: HashMap<SheetId, SheetDiff>,
}

impl VersionManager {
    pub fn record(
        &mut self,
        status: Status,
        processes: Vec<Process>,
        updated_cells: HashSet<(SheetId, CellId)>,
    ) {
        let diffs = convert_payloads_to_sheet_diff(&status, processes, updated_cells);
        self.add_status(status, diffs);
        self.version += 1;
    }

    fn add_status(&mut self, current: Status, sheet_diff: HashMap<SheetId, SheetDiff>) {
        self.redo_stack.clear();
        self.diff_redo_stack.clear();

        if self.undo_stack.len() >= HISTORY_SIZE {
            self.undo_stack.pop_front();
            self.diff_undo_stack.pop_front();
        }

        let mut current = current;
        let mut sheet_diff = sheet_diff;

        std::mem::swap(&mut current, &mut self.current_status);
        std::mem::swap(&mut sheet_diff, &mut self.current_diffs);

        self.undo_stack.push_back(current);
        self.diff_undo_stack.push_back(sheet_diff);
    }

    pub fn undo(&mut self) -> Option<Status> {
        let mut status = self.undo_stack.pop_back()?;
        let mut payloads = self.diff_undo_stack.pop_back()?;

        std::mem::swap(&mut status, &mut self.current_status);
        std::mem::swap(&mut payloads, &mut self.current_diffs);

        self.redo_stack.push_back(status.clone());
        self.diff_redo_stack.push_back(payloads);

        Some(status)
    }

    pub fn redo(&mut self) -> Option<Status> {
        let mut status = self.redo_stack.pop_back()?;
        let mut payloads = self.diff_redo_stack.pop_back()?;

        std::mem::swap(&mut status, &mut self.current_status);
        std::mem::swap(&mut payloads, &mut self.current_diffs);

        self.undo_stack.push_back(status.clone());
        self.diff_undo_stack.push_back(payloads);

        Some(status)
    }

    // `None` means that users can not update the workbook to the latest one incremently.
    pub fn get_sheet_diffs_from_version(
        &self,
        sheet: SheetId,
        version: u32,
    ) -> Option<HashSet<Diff>> {
        assert!(version <= self.version);

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

        Some(result)
    }
}
