use std::collections::{HashMap, HashSet};

use logisheets_base::SheetId;
use logisheets_workbook::prelude::{
    CtAutoFilter, CtCellWatches, CtConditionalFormatting, CtControls, CtCustomProperties,
    CtCustomSheetViews, CtDataConsolidate, CtHeaderFooter, CtHyperlinks, CtIgnoredErrors,
    CtPageBreak, CtPageMargins, CtPageSetup, CtPhoneticPr, CtPrintOptions, CtProtectedRanges,
    CtBookViews, CtCustomWorkbookViews, CtDefinedNames, CtFileRecoveryPr,
    CtFileSharing, CtFileVersion, CtFunctionGroups, CtOleSize, CtPivotCaches, CtScenarios,
    CtSheetCalcPr, CtSheetFormatPr, CtSheetProtection, CtSheetViews, CtSmartTagPr,
    CtSmartTagTypes, CtSmartTags, CtSortState, CtTableParts, CtWebPublishing,
    CtWebPublishItems, CtWorkbookPr, CtWorkbookProtection,
};
use logisheets_workbook::workbook::{DocProps, PivotCache, PivotTablePart, TablePart};

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
    /// The `xl/tables/tableN.xml` parts themselves, with their original
    /// relationship ids so the `<tableParts>` above still resolves. Both halves
    /// have to be kept or neither: the reference alone would dangle, which is
    /// why this used to be dropped outright.
    pub tables: Vec<TablePart>,
    /// Pivot tables anchored on this sheet (`xl/pivotTables/*`). No model for
    /// one either, so it travels whole. Dropping it took the pivot out of the
    /// workbook while leaving the cache it read from behind.
    pub pivot_tables: Vec<PivotTablePart>,
}

/// Workbook-level OOXML the controller does not model, preserved verbatim
/// across open→save. Same idea as {@link PreservedWorksheetParts} one level up:
/// the save path used to hardcode every one of these to `None`, so a defined
/// name, a print title, a workbook view — anything Excel put in `workbook.xml`
/// that we have no opinion about — disappeared the first time an agent touched
/// the file.
///
/// `calc_pr` is deliberately absent: its iterate settings ARE modelled (they
/// land in `calc_config`), so re-emitting the original would contradict them.
#[derive(Default)]
pub struct PreservedWorkbookParts {
    pub file_version: Option<CtFileVersion>,
    pub file_sharing: Option<CtFileSharing>,
    pub workbook_pr: Option<CtWorkbookPr>,
    pub workbook_protection: Option<CtWorkbookProtection>,
    pub book_views: Option<CtBookViews>,
    pub function_groups: Option<CtFunctionGroups>,
    pub defined_names: Option<CtDefinedNames>,
    pub ole_size: Option<CtOleSize>,
    pub custom_workbook_views: Option<CtCustomWorkbookViews>,
    pub pivot_caches: Option<CtPivotCaches>,
    pub smart_tag_pr: Option<CtSmartTagPr>,
    pub smart_tag_types: Option<CtSmartTagTypes>,
    pub web_publishing: Option<CtWebPublishing>,
    pub file_recovery_pr: Option<CtFileRecoveryPr>,
}

pub struct Settings {
    pub sheet_format_pr: HashMap<SheetId, CtSheetFormatPr>,
    pub sheet_views: HashMap<SheetId, CtSheetViews>,
    /// Per-sheet verbatim passthrough of unmodeled worksheet OOXML parts.
    pub preserved_parts: HashMap<SheetId, PreservedWorksheetParts>,
    /// Workbook-level passthrough of the same kind.
    pub preserved_workbook: PreservedWorkbookParts,
    /// Workbook-scoped pivot caches (`xl/pivotCache/*`), the data side of the
    /// pivot tables preserved per sheet.
    pub pivot_caches: Vec<PivotCache>,
    /// `docProps/app.xml` and `docProps/core.xml` as they arrived. The loader
    /// discards their contents and the saver used to write `default()`, so
    /// authorship and timestamps were wiped on every save.
    pub doc_props: DocProps,
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
            preserved_workbook: PreservedWorkbookParts::default(),
            pivot_caches: Vec::new(),
            doc_props: DocProps::default(),
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
