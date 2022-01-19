use crate::defaults::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EgAnchor {
    pub two_cell_anchor: Option<TwoCellAnchor>,
    pub one_cell_anchor: Option<OneCellAnchor>,
    pub absolute_anchor: Option<AbsoluteAnchor>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OneCellAnchor {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AbsoluteAnchor {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TwoCellAnchor {
    pub from: Marker,
    pub to: Marker,
    pub client_data: AnchorClientData,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Marker {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnchorClientData {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EgObjectChoices {
    pub sp: Option<Shape>,
    pub grp_sp: Option<GroupShape>,
    pub graphic_frame: Option<GraphicalObjectFrame>,
    pub cxn_sp: Option<Connector>,
    pub pic: Option<Picture>,
    pub content_part: Option<Rel>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Connector {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Picture {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GroupShape {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GraphicalObjectFrame {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Shape {
    pub nv_sp_pr: ShapeNonVisual,
    pub sp_pr: ShapeProperties,
    pub style: Option<ShapeStyle>,
    pub tx_body: Option<TextBody>,
    #[serde(rename = "macro")]
    pub mcr: Option<String>,
    pub text_link: Option<String>,
    #[serde(default = "default_as_true", skip_serializing_if = "is_default_true")]
    pub f_locks_text: bool,
    #[serde(default = "default_as_false", skip_serializing_if = "is_default_false")]
    pub f_published: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShapeNonVisual {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShapeProperties {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ShapeStyle {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextBody {
    pub body_pr: TextBodyProperties,
    pub lst_style: Option<TextListStyle>,
    // At least 1 element.
    pub p: Vec<TextParagraph>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextListStyle {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextBodyProperties {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextParagraph {
    pub p_pr: Option<TextParagraphProperties>,
    pub end_para_r_pr: Option<TextCharacterProperties>,
    // Not finished. Ecma Office Open Xml Part P4049
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextCharacterProperties {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextParagraphProperties {
    pub ln_spc: Option<TextSpacing>,
    pub spc_bef: Option<TextSpacing>,
    pub spc_aft: Option<TextSpacing>,
    // Not finished. Ecma Office Open Xml Part P4057
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TextSpacing {}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Rel {
    #[serde(rename = "r:id")]
    pub r_id: String,
}
