use imbl::hashmap::HashMap;
use logisheets_base::{ExtBookId, NameId};

/// Ids for defined names.
///
/// Names are case-insensitive, as in Excel: `=tax` and `=TAX` reach the same
/// id. The key is stored upper-cased and the spelling people see lives in
/// `display` — first the spelling a formula happened to use, then the one the
/// name was defined with.
#[derive(Debug, Clone)]
pub struct NameIdManager {
    pub next_available: NameId,
    pub ids: HashMap<(ExtBookId, String), NameId>,
    pub display: HashMap<NameId, (ExtBookId, String)>,
}

fn key(book: ExtBookId, name: &str) -> (ExtBookId, String) {
    (book, name.to_uppercase())
}

impl NameIdManager {
    pub fn new(start: NameId) -> Self {
        NameIdManager {
            next_available: start,
            ids: HashMap::new(),
            display: HashMap::new(),
        }
    }

    pub fn get_id(&mut self, value: &(ExtBookId, String)) -> NameId {
        let k = key(value.0, &value.1);
        if let Some(id) = self.ids.get(&k) {
            return *id;
        }
        let id = self.next_available;
        self.next_available += 1;
        self.ids.insert(k, id);
        self.display.insert(id, value.clone());
        id
    }

    /// The id of an already-known name, without registering it.
    pub fn find_id(&self, book: ExtBookId, name: &str) -> Option<NameId> {
        self.ids.get(&key(book, name)).copied()
    }

    pub fn get_string(&self, id: &NameId) -> Option<(ExtBookId, String)> {
        self.display.get(id).cloned()
    }

    /// Make `name` the spelling shown for `id` (case changes only).
    pub fn set_display(&mut self, id: NameId, name: &str) {
        if let Some((book, _)) = self.display.get(&id).cloned() {
            self.display.insert(id, (book, name.to_string()));
        }
    }

    /// Point `new_name` at `id` and stop resolving `old_name`. Formulas hold
    /// the id, so they follow the rename without being rewritten.
    pub fn rename(&mut self, id: NameId, book: ExtBookId, old_name: &str, new_name: &str) {
        self.ids.remove(&key(book, old_name));
        self.ids.insert(key(book, new_name), id);
        self.display.insert(id, (book, new_name.to_string()));
    }
}
