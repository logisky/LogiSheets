use logisheets_base::SheetId;
use std::collections::{HashMap, VecDeque};

#[derive(Debug, Default)]
pub struct VersionManagerHelper<S: Clone, D, const SIZE: usize> {
    pub(crate) version: u32,
    pub(crate) undo_stack: VecDeque<S>,
    pub(crate) redo_stack: VecDeque<S>,
    pub(crate) diff_undo_stack: VecDeque<HashMap<SheetId, D>>,
    pub(crate) diff_redo_stack: VecDeque<HashMap<SheetId, D>>,
    pub(crate) current_status: S,
    pub(crate) current_diffs: HashMap<SheetId, D>,
}

impl<S: Clone, D, const SIZE: usize> VersionManagerHelper<S, D, SIZE> {
    pub fn version(&self) -> u32 {
        self.version
    }

    pub fn set_init_status(&mut self, current: S) {
        self.undo_stack.clear();
        self.redo_stack.clear();
        self.diff_undo_stack.clear();
        self.diff_redo_stack.clear();
        self.current_diffs.clear();
        self.current_status = current;
        self.current_diffs = HashMap::new();
    }

    pub fn add_status(&mut self, current: S, sheet_diff: HashMap<SheetId, D>) {
        self.redo_stack.clear();
        self.diff_redo_stack.clear();

        if self.undo_stack.len() >= SIZE {
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

    pub fn undo(&mut self) -> Option<S> {
        let mut status = self.undo_stack.pop_back()?;
        let mut payloads = self.diff_undo_stack.pop_back()?;

        std::mem::swap(&mut status, &mut self.current_status);
        std::mem::swap(&mut payloads, &mut self.current_diffs);

        self.redo_stack.push_back(status.clone());
        self.diff_redo_stack.push_back(payloads);

        Some(self.current_status.clone())
    }

    pub fn redo(&mut self) -> Option<S> {
        let mut status = self.redo_stack.pop_back()?;
        let mut payloads = self.diff_redo_stack.pop_back()?;

        std::mem::swap(&mut status, &mut self.current_status);
        std::mem::swap(&mut payloads, &mut self.current_diffs);

        self.undo_stack.push_back(status.clone());
        self.diff_undo_stack.push_back(payloads);

        Some(self.current_status.clone())
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::VersionManagerHelper;

    pub type VersionManagerHelperTest = VersionManagerHelper<u16, (), 3>;

    #[test]
    fn test_undo_redo() {
        let mut manager = VersionManagerHelperTest::default();
        manager.add_status(1, HashMap::default());
        manager.add_status(2, HashMap::default());
        manager.undo();
        assert_eq!(manager.current_status, 1);
        manager.redo();
        assert_eq!(manager.current_status, 2);
        // Nothing to redo, should remain current status
        manager.redo();
        assert_eq!(manager.current_status, 2);
    }

    #[test]
    fn test_set_init_status() {
        let mut manager = VersionManagerHelperTest::default();
        manager.set_init_status(4);
        manager.undo();
        assert_eq!(manager.current_status, 4);
        manager.redo();
        assert_eq!(manager.current_status, 4);
        manager.add_status(12, HashMap::default());
        manager.undo();
        assert_eq!(manager.current_status, 4);
        manager.redo();
        assert_eq!(manager.current_status, 12);
        manager.undo();
        manager.undo();
        manager.undo();
        manager.undo();
        manager.undo();
        assert_eq!(manager.current_status, 4);
        manager.redo();
        assert_eq!(manager.current_status, 12);
    }

    #[test]
    fn test_exceed_limit_history_size() {
        let mut manager = VersionManagerHelperTest::default();
        manager.add_status(1, HashMap::default());
        manager.add_status(2, HashMap::default());
        manager.add_status(3, HashMap::default());
        manager.add_status(4, HashMap::default());
        manager.add_status(5, HashMap::default());
        manager.undo();
        manager.undo();
        manager.undo();
        manager.undo();
        manager.undo();
        manager.undo();
        manager.undo();
        manager.undo();
        assert_eq!(manager.current_status, 2);
    }
}
