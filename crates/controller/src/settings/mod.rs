use std::collections::{HashMap, HashSet};

use logisheets_base::SheetId;
use logisheets_workbook::prelude::{
    CtAutoFilter, CtCellWatches, CtConditionalFormatting, CtControls, CtCustomProperties,
    CtCustomSheetViews, CtDataConsolidate, CtHeaderFooter, CtHyperlinks, CtIgnoredErrors,
    CtPageBreak, CtPageMargins, CtPageSetup, CtPhoneticPr, CtPrintOptions, CtProtectedRanges,
    CtScenarios, CtSheetCalcPr, CtSheetFormatPr, CtSheetProtection, CtSheetViews, CtSmartTags,
    CtSortState, CtTableParts, CtWebPublishItems,
};

use crate::theme_manager::ThemeManager;

/// Worksheet-level OOXML features the controller does not model but preserves
/// verbatim across open→save, so they aren't silently dropped (previously the
/// save path hardcoded these to `None`/empty). Captured from the parsed
/// worksheet at load and re-emitted at save, mirroring how `sheet_views` and
/// data validation already round-trip.
#[derive(Default)]
pub struct PreservedWorksheetParts {
    pub sheet_calc_pr: Option<CtSheetCalcPr>,
    pub sheet_protection: Option<CtSheetProtection>,
    pub protected_ranges: Option<CtProtectedRanges>,
    pub scenarios: Option<CtScenarios>,
    pub auto_filter: Option<CtAutoFilter>,
    pub sort_state: Option<CtSortState>,
    pub data_consolidate: Option<CtDataConsolidate>,
    pub custom_sheet_views: Option<CtCustomSheetViews>,
    pub phonetic_pr: Option<CtPhoneticPr>,
    pub conditional_formatting: Vec<CtConditionalFormatting>,
    pub hyperlinks: Option<CtHyperlinks>,
    pub print_options: Option<CtPrintOptions>,
    pub page_margins: Option<CtPageMargins>,
    pub page_setup: Option<CtPageSetup>,
    pub header_footer: Option<CtHeaderFooter>,
    pub row_breaks: Option<CtPageBreak>,
    pub col_breaks: Option<CtPageBreak>,
    pub custom_properties: Option<CtCustomProperties>,
    pub cell_watches: Option<CtCellWatches>,
    pub ignored_errors: Option<CtIgnoredErrors>,
    pub smart_tags: Option<CtSmartTags>,
    pub controls: Option<CtControls>,
    pub web_publish_items: Option<CtWebPublishItems>,
    pub table_parts: Option<CtTableParts>,
}

pub struct Settings {
    pub sheet_format_pr: HashMap<SheetId, CtSheetFormatPr>,
    pub sheet_views: HashMap<SheetId, CtSheetViews>,
    /// Per-sheet verbatim passthrough of unmodeled worksheet OOXML parts.
    pub preserved_parts: HashMap<SheetId, PreservedWorksheetParts>,
    pub calc_config: CalcConfig,
    pub async_funcs: HashSet<String>, // function names in upper case.
    pub theme: ThemeManager,
}

impl Default for Settings {
    fn default() -> Self {
        let calc_config = CalcConfig::default();
        let sheet_format_pr = HashMap::new();
        let sheet_views = HashMap::new();
        let afuncs = vec!["BAIDUHOTSEARCH".to_string()];
        Settings {
            sheet_format_pr,
            calc_config,
            sheet_views,
            preserved_parts: HashMap::new(),
            async_funcs: afuncs.into_iter().collect(),
            theme: ThemeManager::default(),
        }
    }
}

#[derive(Debug, Clone, Copy)]
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
