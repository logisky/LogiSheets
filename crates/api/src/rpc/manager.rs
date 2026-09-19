use std::collections::{HashMap, hash_map::Entry};

use crate::{EditPayload, ErrorMessage, Workbook};

/// `ErrorMessage::ty` for a request the engine could not even attempt: the
/// caller's mistake, not the workbook's state. Same code as
/// `Error::PayloadError`, which says the same thing.
pub const CLIENT_ERROR: usize = 6;

#[derive(Default)]
pub struct Manager {
    books: HashMap<usize, Workbook>,
    payloads: HashMap<usize, Vec<EditPayload>>,
    next_id: usize,
}

impl Manager {
    pub fn new_workbook(&mut self) -> usize {
        self.books.insert(self.next_id, Workbook::default());
        self.payloads.insert(self.next_id, vec![]);

        let res = self.next_id;
        self.next_id += 1;
        res
    }

    pub fn replace_workbook(&mut self, id: usize, wb: Workbook) {
        self.books.insert(id, wb);
        self.payloads.insert(id, vec![]);
    }

    /// The workbook `id` names, or an error saying why there isn't one. The
    /// only way in: a panicking lookup takes the whole wasm instance with it.
    pub fn workbook(&self, id: usize) -> Result<&Workbook, ErrorMessage> {
        self.books.get(&id).ok_or_else(|| Self::no_workbook(id))
    }

    pub fn workbook_mut(&mut self, id: usize) -> Result<&mut Workbook, ErrorMessage> {
        self.books.get_mut(&id).ok_or_else(|| Self::no_workbook(id))
    }

    fn no_workbook(id: usize) -> ErrorMessage {
        ErrorMessage {
            msg: format!(
                "no workbook is open with book id {id}; it was never created, or it has been released"
            ),
            ty: CLIENT_ERROR,
        }
    }

    pub fn add_payload(&mut self, id: usize, payload: EditPayload) {
        match self.payloads.entry(id) {
            Entry::Occupied(mut payloads) => {
                payloads.get_mut().push(payload);
            }
            // This case should not happen because users should not be accessible to the id.
            Entry::Vacant(_) => {}
        }
    }

    pub fn clean_payloads(&mut self, id: usize) {
        match self.payloads.entry(id) {
            Entry::Occupied(mut payloads) => payloads.get_mut().clear(),
            Entry::Vacant(_) => {}
        }
    }

    pub fn remove(&mut self, id: usize) {
        self.payloads.remove(&id);
        self.books.remove(&id);
    }

    pub fn get_payloads(&mut self, id: &usize) -> Vec<EditPayload> {
        self.payloads.insert(*id, vec![]).unwrap_or_default()
    }
}
