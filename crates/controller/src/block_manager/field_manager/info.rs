use gents_derives::TS;
use logisheets_base::StyleId;

#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "field_render_info.ts", rename_all = "camelCase")]
pub struct FieldRenderInfo {
    pub style: Option<StyleId>,
    pub diy_render: Option<bool>,
}
