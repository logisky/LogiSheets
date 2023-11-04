use std::collections::{hash_map::Entry, HashMap};

use logisheets_controller::controller::edit_action::EditPayload;
use logisheets_controller::Workbook;

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

    pub fn get_workbook(&self, id: &usize) -> Option<&Workbook> {
        self.books.get(id)
    }

    pub fn get_mut_workbook(&mut self, id: &usize) -> Option<&mut Workbook> {
        self.books.get_mut(id)
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
        let (k, result) = self.payloads.remove_entry(id).unwrap();
        self.payloads.insert(k, vec![]);
        result
    }
}
