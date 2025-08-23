pub mod border_manager;
pub mod defaults;
pub mod errors;
mod execute;
pub mod fill_manager;
pub mod font_manager;
mod manager;
pub mod num_fmt_manager;
pub mod xf_manager;

use execute::insert_style;
use gents_derives::TS;

use border_manager::BorderManager;
use fill_manager::FillManager;
use font_manager::FontManager;
use logisheets_base::StyleId;
use num_fmt_manager::NumFmtManager;
use xf_manager::XfManager;

use logisheets_workbook::prelude::{CtBorder, CtCellAlignment, CtCellProtection, CtFill, CtFont};

use crate::{edit_action::StyleUpdateType, Error};

use self::execute::execute_style_update;

#[derive(Debug, Clone, TS)]
#[ts(file_name = "raw_style.ts")]
/// RawStyle is a representation of a style in the XML files.
/// It should not be considered to use by the frontend.
pub struct RawStyle {
    pub font: CtFont,
    pub fill: CtFill,
    pub border: CtBorder,
    pub alignment: Option<CtCellAlignment>,
    pub protection: Option<CtCellProtection>,
    pub formatter: String,
}

#[derive(Debug, Clone, Default)]
pub struct StyleManager {
    pub font_manager: FontManager,
    pub border_manager: BorderManager,
    pub fill_manager: FillManager,
    pub cell_xfs_manager: XfManager,
    pub cell_style_xfs_manager: XfManager,
    pub num_fmt_manager: NumFmtManager,
}

impl StyleManager {
    pub fn execute_style_update(
        &mut self,
        payload: StyleUpdateType,
        id: StyleId,
    ) -> Result<StyleId, Error> {
        execute_style_update(self, payload, id)
    }

    pub fn insert_style(&mut self, style: RawStyle) -> Result<StyleId, Error> {
        insert_style(self, style)
    }

    pub fn get_cell_style(&self, id: StyleId) -> RawStyle {
        let xf = self
            .cell_xfs_manager
            .get_item(id)
            .unwrap_or(self.cell_xfs_manager.get_item(0).unwrap());
        let font_id = xf.font_id.unwrap_or(0);
        let font = self
            .font_manager
            .get_item(font_id)
            .unwrap_or(self.font_manager.get_item(0).unwrap());
        let fill_id = xf.fill_id.unwrap_or(0);
        let fill = self
            .fill_manager
            .get_item(fill_id)
            .unwrap_or(self.fill_manager.get_item(0).unwrap());
        let border_id = xf.border_id.unwrap_or(0);
        let border = self
            .border_manager
            .get_item(border_id)
            .unwrap_or(self.border_manager.get_item(0).unwrap());
        let num_fmt_id = xf.num_fmt_id.unwrap_or(0);
        let num_fmt = self
            .num_fmt_manager
            .get_item(num_fmt_id)
            .unwrap_or(self.num_fmt_manager.get_item(0).unwrap());
        let alignment = xf.alignment.clone();
        let protection = xf.protection.clone();
        RawStyle {
            font: font.clone(),
            fill: fill.clone(),
            border: border.clone(),
            alignment,
            protection,
            formatter: num_fmt.clone(),
        }
    }
}
