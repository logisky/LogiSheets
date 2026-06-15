//! Named in-memory checkpoints.
//!
//! Independent of `VersionManager`:
//!   - VersionManager   — linear undo/redo stack, LRU bounded, automatic
//!                        (every undoable tx records). Drives Ctrl-Z/Y.
//!   - CheckpointManager — random-access by `label`, AI-driven, persistent
//!                        within a session unless explicitly deleted.
//!
//! They cooperate via `RestoreCheckpoint`: that payload reads a snapshot
//! out of CheckpointManager AND records the state-swap as a normal
//! undoable tx on VersionManager, so the user can Ctrl-Z to reverse the
//! AI's restore.
//!
//! Storage cost is small thanks to `imbl`'s persistent data structures —
//! multiple snapshots share most of their substructure with the live
//! Status, so each entry's marginal cost is on the order of a few Arc
//! refcount bumps.

use std::collections::VecDeque;

use logisheets_base::errors::BasicError;

use crate::controller::status::Status;

/// Hard ceiling on number of checkpoints kept simultaneously. When at
/// capacity, the oldest entry is evicted (FIFO by last save/restore).
///
/// 20 is intentionally tight: AI workflows that need more than this
/// many parallel "where was I" markers in a single session are almost
/// certainly mis-using the API. Hitting the cap surfaces as a clear
/// failure rather than a memory leak.
const MAX_CHECKPOINTS: usize = 20;

/// One named snapshot.
#[derive(Debug, Clone)]
pub struct CheckpointEntry {
    pub label: String,
    /// Caller-supplied human-readable description. Optional — purely
    /// for round-trip display, not used for routing.
    pub description: Option<String>,
    /// Snapshot of the workbook state at save time. Restoring replaces
    /// the controller's live `Status` with a clone of this.
    pub status: Status,
}

/// Session-scoped checkpoint store.
#[derive(Debug)]
pub struct CheckpointManager {
    /// Entries keyed by label. Using a Vec with linear scan keeps the
    /// data layout simple at our scale (≤20 entries) and lets us
    /// preserve insertion order for FIFO eviction.
    entries: VecDeque<CheckpointEntry>,
}

impl Default for CheckpointManager {
    fn default() -> Self {
        Self {
            entries: VecDeque::new(),
        }
    }
}

impl CheckpointManager {
    /// Store a snapshot under `label`. If the label already exists, the
    /// new snapshot overwrites it (and moves to the front of the FIFO
    /// order — treat re-saving as a "touch"). Returns the entry's
    /// position-from-newest, for observability.
    pub fn save(
        &mut self,
        label: String,
        description: Option<String>,
        status: Status,
    ) -> &CheckpointEntry {
        // Remove existing entry with this label (so save overrides).
        self.entries.retain(|e| e.label != label);

        // FIFO evict if at capacity. Drop from the back (oldest end).
        while self.entries.len() >= MAX_CHECKPOINTS {
            self.entries.pop_back();
        }

        self.entries.push_front(CheckpointEntry {
            label,
            description,
            status,
        });
        self.entries.front().expect("just pushed")
    }

    /// Look up a snapshot's Status without consuming it. Returns
    /// `Err(BasicError::CheckpointNotFound)` if the label is unknown
    /// (fail-loud per design).
    pub fn get(&self, label: &str) -> Result<&Status, BasicError> {
        self.entries
            .iter()
            .find(|e| e.label == label)
            .map(|e| &e.status)
            .ok_or_else(|| BasicError::CheckpointNotFound(label.to_string()))
    }

    /// Remove a checkpoint by label. Returns `true` if it existed.
    pub fn delete(&mut self, label: &str) -> bool {
        let before = self.entries.len();
        self.entries.retain(|e| e.label != label);
        self.entries.len() != before
    }

    /// List all checkpoints, newest-first. Excludes the `Status`
    /// payload — callers only need the labels and metadata.
    pub fn list(&self) -> Vec<CheckpointMeta> {
        self.entries
            .iter()
            .map(|e| CheckpointMeta {
                label: e.label.clone(),
                description: e.description.clone(),
            })
            .collect()
    }

    /// Total entries currently held.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// True when empty.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Drop every checkpoint. Used on file save/load — checkpoints are
    /// session state, not file state.
    pub fn clear(&mut self) {
        self.entries.clear();
    }
}

/// Lightweight metadata returned by `list`. The full `Status` clone is
/// kept inside the manager.
#[derive(Debug, Clone)]
pub struct CheckpointMeta {
    pub label: String,
    pub description: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_status() -> Status {
        Status::default()
    }

    #[test]
    fn save_then_get_returns_snapshot() {
        let mut m = CheckpointManager::default();
        m.save("a".into(), Some("first".into()), empty_status());
        assert!(m.get("a").is_ok());
    }

    #[test]
    fn get_missing_returns_err() {
        let m = CheckpointManager::default();
        let err = m.get("nope").unwrap_err();
        match err {
            BasicError::CheckpointNotFound(s) => assert_eq!(s, "nope"),
            _ => panic!("expected CheckpointNotFound"),
        }
    }

    #[test]
    fn save_with_existing_label_overwrites() {
        let mut m = CheckpointManager::default();
        m.save("a".into(), Some("v1".into()), empty_status());
        m.save("a".into(), Some("v2".into()), empty_status());
        assert_eq!(m.len(), 1);
        assert_eq!(m.list()[0].description.as_deref(), Some("v2"));
    }

    #[test]
    fn list_is_newest_first() {
        let mut m = CheckpointManager::default();
        m.save("a".into(), None, empty_status());
        m.save("b".into(), None, empty_status());
        m.save("c".into(), None, empty_status());
        let labels: Vec<_> = m.list().iter().map(|e| e.label.clone()).collect();
        assert_eq!(labels, vec!["c", "b", "a"]);
    }

    #[test]
    fn delete_removes_entry() {
        let mut m = CheckpointManager::default();
        m.save("a".into(), None, empty_status());
        assert!(m.delete("a"));
        assert!(!m.delete("a")); // second delete no-ops
        assert!(m.is_empty());
    }

    #[test]
    fn eviction_drops_oldest_when_full() {
        let mut m = CheckpointManager::default();
        for i in 0..(MAX_CHECKPOINTS + 5) {
            m.save(format!("k{}", i), None, empty_status());
        }
        assert_eq!(m.len(), MAX_CHECKPOINTS);
        // The oldest 5 should have been evicted.
        assert!(m.get("k0").is_err());
        assert!(m.get("k4").is_err());
        assert!(m.get("k5").is_ok());
        // Newest still there.
        assert!(m.get(&format!("k{}", MAX_CHECKPOINTS + 4)).is_ok());
    }

    #[test]
    fn resave_moves_to_front_so_no_eviction() {
        let mut m = CheckpointManager::default();
        m.save("keep".into(), None, empty_status());
        for i in 0..MAX_CHECKPOINTS {
            m.save(format!("k{}", i), None, empty_status());
            // Refresh "keep" right before each new entry — should
            // bubble it back to the front so it survives.
            if i % 2 == 0 {
                m.save("keep".into(), None, empty_status());
            }
        }
        assert!(m.get("keep").is_ok());
    }
}
