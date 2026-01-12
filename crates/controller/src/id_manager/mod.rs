use imbl::{hashmap::HashMap, Vector};
use logisheets_base::{AuthorId, ExtBookId, FuncId, SheetId, TextId};
use num::{Num, NumCast};
use std::ops::AddAssign;

pub const BLOCKREF_ID: FuncId = 0;
pub const BLOCKREFS_ID: FuncId = 1;

pub type SheetIdManager = IdManager<SheetId>;
pub type BookIdManager = IdManager<ExtBookId>;
pub type TextIdManager = IdManager<TextId>;
pub type FuncIdManager = IdManager<FuncId>;
pub type AuthorIdManager = IdManager<AuthorId>;
pub type NameIdManager = name_id_manager::NameIdManager;

mod name_id_manager;

impl SheetIdManager {
    pub fn new_with_default_sheet() -> Self {
        let mut ids = HashMap::new();
        ids.insert("Sheet1".to_string(), 0);
        Self {
            next_available: 1,
            ids,
            reserved_ids: Vector::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct IdManager<T>
where
    T: Copy + Num + AddAssign + NumCast + Eq,
{
    next_available: T,
    ids: HashMap<String, T>,
    reserved_ids: Vector<T>,
}

impl<T> IdManager<T>
where
    T: Copy + Num + AddAssign + NumCast + Eq,
{
    pub fn new(start: T) -> Self {
        IdManager {
            next_available: start,
            ids: HashMap::new(),
            reserved_ids: Vector::new(),
        }
    }

    pub fn new_with_reserved_ids(start: T, reserved: Vec<(T, String)>) -> Self {
        let mut ids = HashMap::new();
        let mut reserved_ids = Vector::new();
        for (id, name) in reserved {
            ids.insert(name, id);
            reserved_ids.push_back(id);
        }
        IdManager {
            next_available: start,
            ids,
            reserved_ids,
        }
    }

    pub fn has(&self, name: &str) -> Option<T> {
        match self.ids.get(name) {
            Some(id) => Some(id.clone()),
            None => None,
        }
    }

    fn registry(&mut self, name: String) -> T {
        let r = self.next_available;
        self.ids.insert(name, self.next_available);
        let _1: T = NumCast::from(1usize).unwrap();
        self.next_available += _1;
        while self.reserved_ids.contains(&self.next_available) {
            self.next_available += _1;
        }
        r
    }

    pub fn rename(&mut self, old_name: &str, new_name: String) {
        let result = self.ids.get(old_name);
        if result.is_none() {
            return;
        }
        let id = result.unwrap().clone();
        self.ids.remove(old_name);
        self.ids.insert(new_name, id);
    }

    pub fn get_or_register_id(&mut self, name: &str) -> T {
        match self.ids.get(name) {
            Some(r) => r.clone(),
            None => self.registry(name.to_owned()),
        }
    }

    pub fn get_id(&self, name: &str) -> Option<&T> {
        self.ids.get(name)
    }

    pub fn get_string(&self, id: &T) -> Option<String> {
        let result = self.ids.iter().find(|&(_, v)| v == id);
        match result {
            Some(r) => Some(r.0.clone()),
            None => None,
        }
    }

    pub fn get_all_ids(&self) -> Vec<T> {
        self.ids.iter().map(|(_, id)| id.clone()).collect()
    }
}

impl FuncIdManager {
    pub fn get_func_id(&mut self, name: &str) -> FuncId {
        let s = name.to_uppercase();
        self.get_or_register_id(&s)
    }

    pub fn init() -> Self {
        Self::new_with_reserved_ids(
            2,
            vec![
                (BLOCKREF_ID, "BLOCKREF".to_string()),
                (BLOCKREFS_ID, "BLOCKREFS".to_string()),
            ],
        )
    }
}
