use imbl::{HashMap, Vector};
use logisheets_base::{CellId, PersonId, SheetId};

/// A person that can author or be mentioned in a comment.
///
/// This mirrors OOXML `CT_Person` (`xl/persons/personN.xml`). The core is
/// **identity-provider agnostic**: it just stores whatever the host hands it.
/// In the open-source `src` app only `display_name` is filled in; enterprise
/// deployments additionally supply `user_id` + `provider_id` from their
/// corporate directory (e.g. `AD` / `AAD` / `PeoplePicker`). `guid` is the
/// stable OOXML person id and is what threaded comments / mentions reference on
/// disk.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Person {
    pub display_name: String,
    pub user_id: Option<String>,
    pub provider_id: Option<String>,
    pub guid: String,
}

/// The identity the host provides when authoring a comment or mentioning
/// someone. The core resolves it to a [`PersonId`], deduping on
/// `(provider_id, user_id)` when a `user_id` is present, else on `display_name`.
#[derive(Debug, Clone)]
pub struct PersonInput {
    pub display_name: String,
    pub user_id: Option<String>,
    pub provider_id: Option<String>,
}

/// A `@mention` inside a comment's text. `start`/`len` index into the note's
/// `text` (unicode scalar offsets, matching OOXML `startIndex`/`length`).
#[derive(Debug, Clone)]
pub struct Mention {
    pub person: PersonId,
    pub start: usize,
    pub len: usize,
    /// OOXML `mentionId` (per-mention GUID). Preserved for round-trip.
    pub mention_id: String,
}

/// A single note in a comment thread. Maps 1:1 to OOXML `CT_ThreadedComment`.
/// A root note has `parent == None`; replies carry the root note's `id`.
#[derive(Debug, Clone)]
pub struct CommentNote {
    /// OOXML threaded-comment `id` (GUID). Client-provided so the host can edit
    /// / reply / delete without a round-trip.
    pub id: String,
    pub person: PersonId,
    /// ISO-8601 timestamp string, opaque to the core (the host owns the clock).
    pub dt: String,
    pub text: String,
    /// Root note id when this is a reply.
    pub parent: Option<String>,
    pub mentions: Vector<Mention>,
    /// OOXML `done` flag — the thread was resolved.
    pub resolved: bool,
}

/// Registry mapping the compact [`PersonId`] used throughout the core to the
/// full [`Person`] record. Persistent (`imbl`) so it participates in the
/// snapshot-based undo/redo history like every other manager in `Status`.
#[derive(Debug, Clone)]
pub struct PersonManager {
    next_id: PersonId,
    persons: HashMap<PersonId, Person>,
    by_guid: HashMap<String, PersonId>,
}

impl Default for PersonManager {
    fn default() -> Self {
        PersonManager {
            next_id: 0,
            persons: HashMap::new(),
            by_guid: HashMap::new(),
        }
    }
}

impl PersonManager {
    fn identity_key(user_id: &Option<String>, provider_id: &Option<String>) -> Option<String> {
        user_id
            .as_ref()
            .map(|u| format!("{}\u{0}{}", provider_id.clone().unwrap_or_default(), u))
    }

    fn find_existing(&self, input: &PersonInput) -> Option<PersonId> {
        // Prefer directory identity when available, otherwise fall back to name.
        match Self::identity_key(&input.user_id, &input.provider_id) {
            Some(key) => self.persons.iter().find_map(|(id, p)| {
                if Self::identity_key(&p.user_id, &p.provider_id) == Some(key.clone()) {
                    Some(*id)
                } else {
                    None
                }
            }),
            None => self.persons.iter().find_map(|(id, p)| {
                if p.user_id.is_none() && p.display_name == input.display_name {
                    Some(*id)
                } else {
                    None
                }
            }),
        }
    }

    /// Resolve a host-supplied identity to a stable [`PersonId`], registering a
    /// new person (with a freshly generated GUID) when unseen.
    pub fn get_or_register(&mut self, input: PersonInput) -> PersonId {
        if let Some(id) = self.find_existing(&input) {
            return id;
        }
        let guid = format!("{{{}}}", uuid::Uuid::new_v4());
        self.insert_with_guid(guid, input)
    }

    /// Register a person while preserving an existing GUID (used by the file
    /// loader so on-disk `personId` references keep resolving).
    pub fn register_with_guid(&mut self, guid: String, input: PersonInput) -> PersonId {
        if let Some(id) = self.by_guid.get(&guid) {
            return *id;
        }
        self.insert_with_guid(guid, input)
    }

    fn insert_with_guid(&mut self, guid: String, input: PersonInput) -> PersonId {
        let id = self.next_id;
        self.next_id += 1;
        let person = Person {
            display_name: input.display_name,
            user_id: input.user_id,
            provider_id: input.provider_id,
            guid: guid.clone(),
        };
        self.persons.insert(id, person);
        self.by_guid.insert(guid, id);
        id
    }

    pub fn get(&self, id: &PersonId) -> Option<&Person> {
        self.persons.get(id)
    }

    pub fn get_by_guid(&self, guid: &str) -> Option<PersonId> {
        self.by_guid.get(guid).copied()
    }

    pub fn iter(&self) -> impl Iterator<Item = (&PersonId, &Person)> {
        self.persons.iter()
    }
}

#[derive(Debug, Clone, Default)]
pub struct SheetComments {
    /// Each cell owns an ordered thread of notes (root first, then replies).
    pub threads: HashMap<CellId, Vector<CommentNote>>,
}

impl SheetComments {
    pub fn new() -> Self {
        SheetComments {
            threads: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Comments {
    pub persons: PersonManager,
    pub data: HashMap<SheetId, SheetComments>,
}

impl Default for Comments {
    fn default() -> Self {
        Comments {
            persons: PersonManager::default(),
            data: HashMap::new(),
        }
    }
}

impl Comments {
    pub fn get_thread(&self, sheet_id: &SheetId, cell_id: &CellId) -> Option<&Vector<CommentNote>> {
        self.data.get(sheet_id)?.threads.get(cell_id)
    }

    pub fn get_person(&self, person_id: &PersonId) -> Option<&Person> {
        self.persons.get(person_id)
    }

    /// Append a note to a cell's thread. A root note (`parent == None`) starts a
    /// new thread; a reply is appended after the existing notes.
    pub fn add_note(&mut self, sheet_id: SheetId, cell_id: CellId, note: CommentNote) {
        let sheet = self.data.entry(sheet_id).or_insert_with(SheetComments::new);
        sheet
            .threads
            .entry(cell_id)
            .or_insert_with(Vector::new)
            .push_back(note);
    }

    /// Find the `(cell, index)` of a note by its GUID within a sheet.
    fn locate(&self, sheet_id: &SheetId, comment_id: &str) -> Option<(CellId, usize)> {
        let sheet = self.data.get(sheet_id)?;
        for (cell_id, thread) in sheet.threads.iter() {
            if let Some(idx) = thread.iter().position(|n| n.id == comment_id) {
                return Some((*cell_id, idx));
            }
        }
        None
    }

    /// Replace the text + mentions of an existing note. Returns whether a note
    /// was actually updated.
    pub fn edit_note(
        &mut self,
        sheet_id: SheetId,
        comment_id: &str,
        text: String,
        mentions: Vector<Mention>,
    ) -> bool {
        let Some((cell_id, idx)) = self.locate(&sheet_id, comment_id) else {
            return false;
        };
        let Some(sheet) = self.data.get_mut(&sheet_id) else {
            return false;
        };
        let Some(thread) = sheet.threads.get_mut(&cell_id) else {
            return false;
        };
        if let Some(note) = thread.get_mut(idx) {
            note.text = text;
            note.mentions = mentions;
            return true;
        }
        false
    }

    /// Toggle the resolved (`done`) flag of a thread's root note.
    pub fn set_resolved(&mut self, sheet_id: SheetId, comment_id: &str, resolved: bool) -> bool {
        let Some((cell_id, idx)) = self.locate(&sheet_id, comment_id) else {
            return false;
        };
        let Some(sheet) = self.data.get_mut(&sheet_id) else {
            return false;
        };
        let Some(thread) = sheet.threads.get_mut(&cell_id) else {
            return false;
        };
        if let Some(note) = thread.get_mut(idx) {
            note.resolved = resolved;
            return true;
        }
        false
    }

    /// Delete a note. Deleting a root note (`parent == None`) removes the whole
    /// thread (root + all replies). Returns whether anything was removed.
    pub fn delete_note(&mut self, sheet_id: SheetId, comment_id: &str) -> bool {
        let Some((cell_id, idx)) = self.locate(&sheet_id, comment_id) else {
            return false;
        };
        let Some(sheet) = self.data.get_mut(&sheet_id) else {
            return false;
        };
        let Some(thread) = sheet.threads.get_mut(&cell_id) else {
            return false;
        };
        let is_root = thread.get(idx).map(|n| n.parent.is_none()).unwrap_or(false);
        if is_root {
            sheet.threads.remove(&cell_id);
        } else {
            thread.remove(idx);
            if thread.is_empty() {
                sheet.threads.remove(&cell_id);
            }
        }
        true
    }
}
