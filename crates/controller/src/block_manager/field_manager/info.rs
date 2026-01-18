use logisheets_base::StyleId;

#[derive(Debug, Clone, Default)]
pub struct FieldRenderInfo {
    pub style: Option<StyleId>,
    pub diy_render: Option<bool>,
}
