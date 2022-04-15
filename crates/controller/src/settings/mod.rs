use std::collections::{HashMap, HashSet};

use controller_base::SheetId;
use logisheets_workbook::prelude::CtSheetFormatPr;

pub struct Settings {
    pub sheet_format_pr: HashMap<SheetId, CtSheetFormatPr>,
    pub calc_config: CalcConfig,
    pub async_funcs: HashSet<String>, // function names in upper case.
}

impl Default for Settings {
    fn default() -> Self {
        let calc_config = CalcConfig::default();
        let sheet_format_pr = HashMap::<SheetId, CtSheetFormatPr>::new();
        let afuncs = vec!["BAIDUHOTSEARCH".to_string()];
        Settings {
            sheet_format_pr,
            calc_config,
            async_funcs: afuncs.into_iter().collect(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CalcConfig {
    pub iter_limit: u16,
    pub error: f32,
}

impl Default for CalcConfig {
    fn default() -> Self {
        CalcConfig {
            iter_limit: 1000,
            error: 0.01,
        }
    }
}
