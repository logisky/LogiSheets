use imbl::HashMap;
use logisheets_base::{AuthorId, CellId, SheetId};

use crate::id_manager::AuthorIdManager;

#[derive(Debug, Clone)]
pub struct Comments {
    pub authors: AuthorIdManager,
    pub data: HashMap<SheetId, SheetComments>,
}

impl Comments {
    pub fn get_comment(&self, sheet_id: &SheetId, cell_id: &CellId) -> Option<&Comment> {
        self.data.get(sheet_id)?.comments.get(cell_id)
    }

    pub fn get_author_name(&self, author_id: &AuthorId) -> Option<String> {
        self.authors.get_string(&author_id)
    }

    pub fn add_comment(&mut self, sheet_id: SheetId, cell_id: CellId, comment: Comment) {
        match self.data.get_mut(&sheet_id) {
            Some(sc) => {
                sc.comments.insert(cell_id, comment);
            }
            None => {
                let mut new_sheet_comment = SheetComments::new();
                new_sheet_comment.comments.insert(cell_id, comment);
                self.data.insert(sheet_id, new_sheet_comment);
            }
        }
    }
}

impl Default for Comments {
    fn default() -> Self {
        Comments {
            authors: AuthorIdManager::new(0),
            data: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SheetComments {
    pub comments: HashMap<CellId, Comment>,
}

impl SheetComments {
    pub fn new() -> Self {
        SheetComments {
            comments: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Comment {
    pub author: AuthorId,
    pub text: String,
}
