use imbl::HashMap;

use crate::block_manager::schema_manager::schema::RenderId;

use super::info::FieldRenderInfo;

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

    pub fn batch_set_info(&mut self, items: Vec<(RenderId, FieldRenderInfo)>) {
        items.into_iter().for_each(|(id, info)| {
            self.set_info(id, info);
        });
    }
}
