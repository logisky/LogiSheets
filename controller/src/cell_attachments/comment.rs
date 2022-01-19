use controller_base::{AuthorId, CellId, SheetId};
use im::HashMap;

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

#[derive(Debug, Clone)]
pub struct Comment {
    pub author: AuthorId,
    pub text: String,
}
