use gents_derives::TS;
use imbl::HashMap;
use logisheets_base::StyleId;

use crate::block_manager::schema_manager::schema::RenderId;

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "field_render_info.ts", rename_all = "camelCase")]
pub struct FieldRenderInfo {
    pub style: Option<StyleId>,
    pub diy_render: Option<bool>,
}

#[derive(Debug, Clone, Default)]
pub struct FieldRenderManager {
    data: HashMap<RenderId, FieldRenderInfo>,
}

impl FieldRenderManager {
    pub fn get(&self, render_id: &RenderId) -> Option<&FieldRenderInfo> {
        self.data.get(render_id)
    }

    pub fn get_mut(&mut self, render_id: RenderId) -> &mut FieldRenderInfo {
        self.data
            .entry(render_id)
            .or_insert_with(FieldRenderInfo::default)
    }

    pub fn set_info(&mut self, render_id: RenderId, info: FieldRenderInfo) {
        self.data.insert(render_id, info);
    }

    pub fn update_style(&mut self, render_id: RenderId, style: Option<StyleId>) {
        let info = self.get_mut(render_id);
        info.style = style;
    }

    pub fn update_diy_render(&mut self, render_id: RenderId, diy_render: Option<bool>) {
        let info = self.get_mut(render_id);
        info.diy_render = diy_render;
    }
}
