use imbl::HashMap;
use imbl::HashSet;
use logisheets_base::CellId;
use logisheets_base::SheetId;

use crate::cell_attachments::CellAttachmentsManager;
use crate::container::DataContainer;
use crate::cube_manager::CubeManager;
use crate::exclusive::ExclusiveManager;
use crate::ext_book_manager::ExtBooksManager;
use crate::ext_ref_manager::ExtRefManager;
use crate::formula_manager::FormulaManager;
use crate::id_manager::FuncIdManager;
use crate::id_manager::NameIdManager;
use crate::id_manager::SheetIdManager;
use crate::id_manager::TextIdManager;
use crate::navigator::Navigator;

use crate::range_manager::RangeManager;
use crate::style_manager::StyleManager;
use crate::workbook::sheet_info_manager::SheetInfoManager;

#[derive(Debug, Clone)]
pub struct Status {
    pub navigator: Navigator,
    pub range_manager: RangeManager,
    pub cube_manager: CubeManager,
    pub ext_ref_manager: ExtRefManager,
    pub formula_manager: FormulaManager,
    pub container: DataContainer,
    pub sheet_id_manager: SheetIdManager,
    pub func_id_manager: FuncIdManager,
    pub text_id_manager: TextIdManager,
    pub name_id_manager: NameIdManager,
    pub external_links_manager: ExtBooksManager,
    pub sheet_pos_manager: SheetInfoManager,
    pub style_manager: StyleManager,
    pub cell_attachment_manager: CellAttachmentsManager,
    pub exclusive_manager: ExclusiveManager,

    pub dirty_cells_next_round: HashSet<(SheetId, CellId)>,
}

impl Default for Status {
    fn default() -> Self {
        Status {
            navigator: Navigator::default(),
            formula_manager: FormulaManager::new(),
            range_manager: RangeManager::new(),
            cube_manager: CubeManager::new(),
            ext_ref_manager: ExtRefManager::new(),
            container: DataContainer {
                data: HashMap::new(),
            },
            sheet_id_manager: SheetIdManager::new(0),
            func_id_manager: FuncIdManager::new(0),
            text_id_manager: TextIdManager::new(0),
            name_id_manager: NameIdManager::new(0),
            external_links_manager: ExtBooksManager::new(),
            sheet_pos_manager: SheetInfoManager::default(),
            style_manager: StyleManager::default(),
            cell_attachment_manager: CellAttachmentsManager::default(),
            exclusive_manager: ExclusiveManager::default(),
            dirty_cells_next_round: HashSet::new(),
        }
    }
}
