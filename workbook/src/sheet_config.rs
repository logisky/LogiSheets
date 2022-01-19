pub struct SheetConfig {
    pub names: Vec<String>,
    pub sizes: Vec<SheetSize>,
}

impl SheetConfig {
    pub fn new() -> Self {
        SheetConfig {
            names: vec![],
            sizes: vec![],
        }
    }

    pub fn get_sheet_size(&self, sheet: u8) -> Option<&SheetSize> {
        self.sizes.get(sheet as usize)
    }
}

pub struct SheetSize {
    pub row_count: u32,
    pub col_count: u32,
}
