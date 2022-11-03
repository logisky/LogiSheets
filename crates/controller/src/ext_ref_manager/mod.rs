use im::HashMap;
use logisheets_base::{ExtRef, ExtRefId};

#[derive(Debug, Clone)]
pub struct ExtRefManager {
    id_to_ref: HashMap<ExtRefId, ExtRef>,
    ref_to_id: HashMap<ExtRef, ExtRefId>,
    next_id: ExtRefId,
}

impl ExtRefManager {
    pub fn new() -> Self {
        ExtRefManager {
            id_to_ref: HashMap::new(),
            ref_to_id: HashMap::new(),
            next_id: 0,
        }
    }

    pub fn get_ext_ref(&self, ext_ref_id: &ExtRefId) -> Option<ExtRef> {
        Some(self.id_to_ref.get(ext_ref_id)?.clone())
    }

    pub fn get_ext_ref_id(&mut self, ext_ref: &ExtRef) -> ExtRefId {
        if let Some(id) = self.ref_to_id.get(ext_ref) {
            *id
        } else {
            let id = self.next_id;
            let r = ext_ref.clone();
            self.id_to_ref.insert(id, r.clone());
            self.ref_to_id.insert(r, id);
            self.next_id += 1;
            id
        }
    }

    pub fn remove_ext_ref_id(&mut self, ext_ref_id: &ExtRefId) {
        if let Some(r) = self.id_to_ref.remove(ext_ref_id) {
            self.ref_to_id.remove(&r);
        }
    }
}
