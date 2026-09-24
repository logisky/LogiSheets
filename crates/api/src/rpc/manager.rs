use std::collections::{HashMap, hash_map::Entry};

use crate::{EditPayload, ErrorMessage, Workbook};

/// `ErrorMessage::ty` for a request the engine could not even attempt: the
/// caller's mistake, not the workbook's state. Same code as
/// `Error::PayloadError`, which says the same thing.
pub const CLIENT_ERROR: usize = 6;

/// Every workbook one transport has open, keyed by book id.
///
/// Ids are minted by [`Manager::new_workbook`], count up from 0 and are never
/// reused, even after [`Manager::remove`]. Each workbook also has a payload
/// buffer ([`add_payload`](Manager::add_payload) /
/// [`get_payloads`](Manager::get_payloads)) that the manager only stores; the
/// RPC logic functions do not read it.
#[derive(Default)]
pub struct Manager {
    books: HashMap<usize, Workbook>,
    payloads: HashMap<usize, Vec<EditPayload>>,
    next_id: usize,
}

impl Manager {
    /// Open an empty workbook and return its new id.
    pub fn new_workbook(&mut self) -> usize {
        self.books.insert(self.next_id, Workbook::default());
        self.payloads.insert(self.next_id, vec![]);

        let res = self.next_id;
        self.next_id += 1;
        res
    }

    /// Put `wb` in slot `id`, replacing any workbook there and clearing its
    /// payload buffer. Does not advance the id counter, so replacing an id that
    /// was never minted can collide with a later [`new_workbook`](Self::new_workbook).
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

    /// Buffer a payload for workbook `id`. Dropped silently if `id` is not open.
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

    /// Close workbook `id` and drop its payload buffer. Unknown ids are ignored.
    pub fn remove(&mut self, id: usize) {
        self.payloads.remove(&id);
        self.books.remove(&id);
    }

    /// Take workbook `id`'s buffered payloads, leaving an empty buffer. For an id
    /// that is not open this answers empty but also creates the buffer.
    pub fn get_payloads(&mut self, id: &usize) -> Vec<EditPayload> {
        self.payloads.insert(*id, vec![]).unwrap_or_default()
    }
}
