use crate::edit_action::StyleUpdateType;

use super::defaults::get_init_border;
use super::manager::Manager;
use logisheets_workbook::prelude::*;

pub type BorderId = u32;
pub type BorderManager = Manager<CtBorder, BorderId>;

impl Default for BorderManager {
    fn default() -> Self {
        let border = get_init_border();
        let mut manager = BorderManager::new(0);
        manager.get_id(&border);
        manager
    }
}

impl BorderManager {
    pub fn execute(&mut self, id: BorderId, update_type: &StyleUpdateType) -> Option<BorderId> {
        let mut border = if let Some(border) = self.get_item(id) {
            border.clone()
        } else {
            get_init_border()
        };

        macro_rules! update_border_color {
            ($payload_pr:ident, $pr:ident) => {
                if let Some(s) = &update_type.$payload_pr {
                    match &mut border.$pr {
                        Some(pr) => match &mut pr.color {
                            Some(c) => c.rgb = Some(s.clone()),
                            None => {
                                let color = new_color_with_rgb(s.clone());
                                pr.color = Some(color);
                            }
                        },
                        None => {
                            let color = new_color_with_rgb(s.clone());
                            border.$pr = Some(CtBorderPr {
                                color: Some(color),
                                style: StBorderStyle::None,
                            })
                        }
                    }
                }
            };
        }
        update_border_color! {set_left_border_color, left};
        update_border_color! {set_right_border_color, right};
        update_border_color! {set_top_border_color, top};
        update_border_color! {set_bottom_border_color, bottom};

        macro_rules! update_border_style {
            ($payload_pr:ident, $pr:ident) => {
                if let Some(s) = &update_type.$payload_pr {
                    match &mut border.$pr {
                        Some(pr) => pr.style = s.clone(),
                        None => {
                            border.$pr = Some(CtBorderPr {
                                color: None,
                                style: s.clone(),
                            })
                        }
                    }
                }
            };
        }

        update_border_style!(set_left_border_style, left);
        update_border_style!(set_right_border_style, right);
        update_border_style!(set_top_border_style, top);
        update_border_style!(set_bottom_border_style, bottom);

        if let Some(b) = update_type.set_border_giagonal_down {
            border.diagonal_down = Some(b);
        }

        if let Some(b) = update_type.set_border_giagonal_up {
            border.diagonal_up = Some(b);
        }

        if let Some(b) = update_type.set_border_outline {
            border.outline = b;
        }

        let new_id = self.get_id(&border);
        if new_id != id {
            Some(new_id)
        } else {
            None
        }
    }
}

fn new_color_with_rgb(c: String) -> CtColor {
    CtColor {
        auto: None,
        indexed: None,
        rgb: Some(c),
        theme: None,
        tint: 0f64,
    }
}
