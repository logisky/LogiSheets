extern crate indexmap;
extern crate quick_xml;
extern crate serde;

mod border_manager;
pub mod defaults;
mod execute;
mod fill_manager;
mod font_manager;
mod manager;
mod num_fmt_manager;
pub mod xf_manager;

use border_manager::BorderManager;
use controller_base::StyleId;
use fill_manager::FillManager;
use font_manager::FontManager;
use num_fmt_manager::NumFmtManager;
use xf_manager::XfManager;

use crate::payloads::sheet_process::style::CellStylePayload;

use self::execute::execute_style_payload;
use crate::controller::display::Style;

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
    pub fn execute_style_payload(
        self,
        payload: &CellStylePayload,
        idx: StyleId,
    ) -> Option<(Self, StyleId)> {
        execute_style_payload(self, payload, idx)
    }

    pub fn get_cell_style(&self, id: StyleId) -> Style {
        let xf = self
            .cell_xfs_manager
            .get_data(id)
            .unwrap_or(self.cell_xfs_manager.get_data(0).unwrap());
        let font_id = xf.font_id.unwrap_or(0);
        let font = self
            .font_manager
            .get_data(font_id)
            .unwrap_or(self.font_manager.get_data(0).unwrap());
        let fill_id = xf.fill_id.unwrap_or(0);
        let fill = self
            .fill_manager
            .get_data(fill_id)
            .unwrap_or(self.fill_manager.get_data(0).unwrap());
        let border_id = xf.border_id.unwrap_or(0);
        let border = self
            .border_manager
            .get_data(border_id)
            .unwrap_or(self.border_manager.get_data(0).unwrap());
        let alignment = xf.alignment.clone();
        let protection = xf.protection.clone();
        Style {
            font: font.clone(),
            fill: fill.clone(),
            border: border.clone(),
            alignment: alignment.clone(),
            protection: protection.clone(),
            formatter: String::from(""),
        }
    }
}
