#[derive(Debug, Clone)]
pub enum NamePayload {
    Rename(RenameName),
    Remove(RemoveName),
    Add(AddName),
}

#[derive(Debug, Clone)]
pub struct AddName {
    pub name: String,
    pub refer_to: String,
}

#[derive(Debug, Clone)]
pub struct RemoveName {
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct RenameName {
    pub old_name: String,
    pub new_name: String,
}
