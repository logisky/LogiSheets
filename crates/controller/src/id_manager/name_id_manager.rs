use imbl::hashmap::HashMap;
use logisheets_base::{ExtBookId, NameId};

#[derive(Debug, Clone)]
pub struct NameIdManager {
    pub next_available: NameId,
    pub ids: HashMap<(ExtBookId, String), NameId>,
}

impl NameIdManager {
    pub fn new(start: NameId) -> Self {
        NameIdManager {
            next_available: start,
            ids: HashMap::new(),
        }
    }

    pub fn registry(&mut self, key: (ExtBookId, String)) -> NameId {
        let r = self.next_available;
        self.ids.insert(key, self.next_available);
        self.next_available += 1;
        r
    }

    pub fn get_id(&mut self, value: &(ExtBookId, String)) -> NameId {
        match self.ids.get(value) {
            Some(r) => r.clone(),
            None => self.registry(value.to_owned()),
        }
    }

    pub fn get_string(&self, key: &NameId) -> Option<(ExtBookId, String)> {
        match self.ids.iter().find(|&(_, v)| v == key) {
            Some(r) => Some(r.0.clone()),
            None => None,
        }
    }
}
