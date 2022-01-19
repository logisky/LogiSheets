use controller_base::SheetId;
use xlrs_workbook::{
    workbook::{CalcPr, WorkbookPr},
    worksheet::SheetFormatPr,
};

use crate::settings::Settings;

pub struct SettingsLoader {
    pub settings: Settings,
}

impl SettingsLoader {
    pub fn new() -> Self {
        SettingsLoader {
            settings: Settings::default(),
        }
    }

    pub fn finish(self) -> Settings {
        self.settings
    }

    pub fn load_workbook_pr(&mut self, wbs: WorkbookPr) {
        todo!()
    }

    pub fn load_calc_pr(&mut self, calc_pr: CalcPr) {
        self.settings.calc_config.error = calc_pr.iterate_delta as f32;
        self.settings.calc_config.iter_limit = calc_pr.iterate_count as u16;
    }

    pub fn load_sheet_format_pr(&mut self, sheet_id: SheetId, pr: SheetFormatPr) {
        self.settings.sheet_format_pr.insert(sheet_id, pr);
    }
}
