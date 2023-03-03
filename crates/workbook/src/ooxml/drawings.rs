use super::defaults::default_false;
use super::defaults::default_string_empty;
use super::defaults::default_true;
use super::defaults::default_zero_i32;
use super::enum_groups::{
    CtTextCharacterProperties, CtTextParagraphProperties, EgColorChoice, EgTextAutofit, EgTextRun,
};
use super::simple_types::{
    StAngle, StBlackWhiteMode, StCoordinate32, StFontCollectionIndex, StGeomGuideFormula,
    StGeomGuideName, StPositiveCoordinate32, StTextAnchoringType, StTextColumnCount,
    StTextHorzOverflowType, StTextShapeType, StTextVertOverflowType, StTextVerticalType,
    StTextWrappingType,
};
use xmlserde::Unparsed;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub enum EgObjectChoices {
    #[xmlserde(name = b"sp")]
    Sp(CtShape),
    #[xmlserde(name = b"grpSp")]
    GrpSp(CtGroupShape),
    #[xmlserde(name = b"graphicFrame")]
    GraphicFrame(CtGroupShape),
    #[xmlserde(name = b"cxnSp")]
    CxnSp(CtConnector),
    #[xmlserde(name = b"pic")]
    Pic(CtPicture),
    #[xmlserde(name = b"contentPart")]
    ContentPart(CtRel),
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtShape {
    #[xmlserde(name = b"nvSpPr", ty = "child")]
    pub nv_sp_pr: CtShapeNoneVisual,
    #[xmlserde(name = b"spPr", ty = "child")]
    pub sp_pr: CtShapeProperties,
    #[xmlserde(name = b"style", ty = "child")]
    pub style: Option<CtShapeStyle>,
    #[xmlserde(name = b"txBody", ty = "child")]
    pub tx_body: Option<CtTextBody>,
    #[xmlserde(name = b"macro", ty = "attr")]
    pub r#macro: Option<String>,
    #[xmlserde(name = b"textlink", ty = "attr")]
    pub textlink: Option<String>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"fLocksText", ty = "attr", default = "default_true")]
    pub f_locks_text: bool,
    #[xmlserde(name = b"fPublished", ty = "attr", default = "default_false")]
    pub f_published: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtShapeNoneVisual {
    #[xmlserde(name = b"cNvPr", ty = "child")]
    pub c_nv_pr: CtNonVisualDrawingProps,
    #[xmlserde(name = b"cNvSpPr", ty = "child")]
    pub c_nv_sp_pr: CtNonVisualDrawingShapeProps,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtNonVisualDrawingProps {
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: u32,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"descr", ty = "attr", default = "default_string_empty")]
    pub descr: String,
    #[xmlserde(name = b"hidden", ty = "attr", default = "default_false")]
    pub hidden: bool,
    #[xmlserde(name = b"title", ty = "attr", default = "default_string_empty")]
    pub title: String,
    #[xmlserde(name = b"hlinkClick", ty = "child")]
    pub hlink_click: Option<Unparsed>,
    #[xmlserde(name = b"hlinkHover", ty = "child")]
    pub hlink_hover: Option<Unparsed>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtNonVisualDrawingShapeProps {
    #[xmlserde(name = b"spLocks", ty = "child")]
    pub sp_locks: Option<CtShapeLocking>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
    #[xmlserde(name = b"txBox", ty = "attr", default = "default_false")]
    pub tx_box: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtShapeLocking {
    #[xmlserde(name = b"noTextEdit", ty = "attr", default = "default_false")]
    pub no_text_edit: bool,
    #[xmlserde(name = b"noGrp", ty = "attr", default = "default_false")]
    pub no_grp: bool,
    #[xmlserde(name = b"noSelect", ty = "attr", default = "default_false")]
    pub no_select: bool,
    #[xmlserde(name = b"noRot", ty = "attr", default = "default_false")]
    pub no_rot: bool,
    #[xmlserde(name = b"noChangeAspect", ty = "attr", default = "default_false")]
    pub no_change_aspect: bool,
    #[xmlserde(name = b"noMove", ty = "attr", default = "default_false")]
    pub no_move: bool,
    #[xmlserde(name = b"noResize", ty = "attr", default = "default_false")]
    pub no_resize: bool,
    #[xmlserde(name = b"noEditPoints", ty = "attr", default = "default_false")]
    pub no_edit_points: bool,
    #[xmlserde(name = b"noAdjustHandles", ty = "attr", default = "default_false")]
    pub no_adjust_handles: bool,
    #[xmlserde(name = b"noChangeArrowHeads", ty = "attr", default = "default_false")]
    pub no_change_arrow_heads: bool,
    #[xmlserde(name = b"noChangeShapeType", ty = "attr", default = "default_false")]
    pub no_change_shape_type: bool,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtShapeProperties {
    #[xmlserde(name = b"xfrm", ty = "child")]
    pub xfrm: Option<CtTransform2D>,
    // ref EgGeometry
    // ref FillProperties
    #[xmlserde(name = b"bwMode", ty = "attr")]
    pub bw_mode: Option<StBlackWhiteMode>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtGroupShape {}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtGraphicalObjectFrame {}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtConnector {}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPicture {}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtRel {
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTransform2D {
    #[xmlserde(name = b"off", ty = "child")]
    pub off: Option<CtPoint2D>,
    #[xmlserde(name = b"ext", ty = "child")]
    pub ext: Option<CtPositiveSize2D>,
    #[xmlserde(name = b"rot", ty = "attr", default = "default_zero_i32")]
    pub rot: i32,
    #[xmlserde(name = b"flipH", ty = "attr", default = "default_false")]
    pub flip_h: bool,
    #[xmlserde(name = b"flipV", ty = "attr", default = "default_false")]
    pub flip_v: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPoint2D {
    #[xmlserde(name = b"x", ty = "attr")]
    pub x: i64,
    #[xmlserde(name = b"y", ty = "attr")]
    pub y: i64,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPositiveSize2D {
    #[xmlserde(name = b"cx", ty = "attr")]
    pub cx: u64,
    #[xmlserde(name = b"cy", ty = "attr")]
    pub cy: u64,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtStyleMatrixReference {
    #[xmlserde(name = b"idx", ty = "attr")]
    pub idx: StStyleMatrixColumnIndex,
    #[xmlserde(ty = "untag")]
    pub color: EgColorChoice,
}

pub type StStyleMatrixColumnIndex = u64;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtShapeStyle {
    #[xmlserde(name = b"lnRef", ty = "child")]
    pub ln_ref: CtStyleMatrixReference,
    #[xmlserde(name = b"fillRef", ty = "child")]
    pub fill_ref: CtStyleMatrixReference,
    #[xmlserde(name = b"effectRef", ty = "child")]
    pub effect_ref: CtStyleMatrixReference,
    #[xmlserde(name = b"fontRef", ty = "child")]
    pub font_ref: CtFontReference,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFontReference {
    #[xmlserde(name = b"idx", ty = "attr")]
    pub idx: StFontCollectionIndex,
    #[xmlserde(ty = "untag")]
    pub color: EgColorChoice,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextBody {
    #[xmlserde(name = b"bodyPr", ty = "child")]
    pub body_pr: CtTextBodyProperties,
    #[xmlserde(name = b"lstStyle", ty = "child")]
    pub lst_style: Option<CtTextListStyle>,
    #[xmlserde(name = b"p", ty = "child")]
    pub p: Vec<CtTextParagraph>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextBodyProperties {
    #[xmlserde(name = b"prstTxWarp", ty = "child")]
    pub prst_tx_warp: Option<CtPresetTextShape>,
    #[xmlserde(ty = "untag")]
    pub text_auto_fit: Option<EgTextAutofit>,
    #[xmlserde(name = b"scene_3d", ty = "child")]
    pub scene_3d: Option<Unparsed>, // CT_Scene3D
    #[xmlserde(ty = "untag")]
    pub text_3d: Option<Unparsed>, // EG_Text3D
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Unparsed,
    #[xmlserde(name = b"rot", ty = "attr")]
    pub rot: Option<StAngle>,
    #[xmlserde(name = b"spcFirstLastPara", ty = "attr")]
    pub spc_first_last_para: Option<bool>,
    #[xmlserde(name = b"vertOverflow", ty = "attr")]
    pub vert_overflow: Option<StTextVertOverflowType>,
    #[xmlserde(name = b"horzOverflow", ty = "attr")]
    pub horz_overflow: Option<StTextHorzOverflowType>,
    #[xmlserde(name = b"vert", ty = "attr")]
    pub vert: Option<StTextVerticalType>,
    #[xmlserde(name = b"wrap", ty = "attr")]
    pub wrap: Option<StTextWrappingType>,
    #[xmlserde(name = b"lIns", ty = "attr")]
    pub l_ins: Option<StCoordinate32>,
    #[xmlserde(name = b"tIns", ty = "attr")]
    pub t_ins: Option<StCoordinate32>,
    #[xmlserde(name = b"rIns", ty = "attr")]
    pub r_ins: Option<StCoordinate32>,
    #[xmlserde(name = b"bIns", ty = "attr")]
    pub b_ins: Option<StCoordinate32>,
    #[xmlserde(name = b"numCol", ty = "attr")]
    pub num_col: Option<StTextColumnCount>,
    #[xmlserde(name = b"spcCol", ty = "attr")]
    pub spc_col: Option<StPositiveCoordinate32>,
    #[xmlserde(name = b"rtlCol", ty = "attr")]
    pub rtl_col: Option<bool>,
    #[xmlserde(name = b"fromWordArt", ty = "attr")]
    pub from_word_art: Option<bool>,
    #[xmlserde(name = b"anchor", ty = "attr")]
    pub anchor: Option<StTextAnchoringType>,
    #[xmlserde(name = b"anchorCtr", ty = "attr")]
    pub anchor_ctr: Option<bool>,
    #[xmlserde(name = b"forceAA", ty = "attr")]
    pub force_a_a: Option<bool>,
    #[xmlserde(name = b"upright", ty = "attr", default = "default_false")]
    pub upright: bool,
    #[xmlserde(name = b"compatLnSpc", ty = "attr")]
    pub compat_ln_spc: Option<bool>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPresetTextShape {
    #[xmlserde(name = b"avLst", ty = "child")]
    pub av_lst: Option<CtGeomGuideList>,
    #[xmlserde(name = b"prst", ty = "attr")]
    pub prst: StTextShapeType,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtGeomGuideList {
    #[xmlserde(name = b"gd", ty = "child")]
    pub gd: Vec<CtGeomGuide>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtGeomGuide {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: StGeomGuideName,
    #[xmlserde(name = b"fmla", ty = "attr")]
    pub fmla: StGeomGuideFormula,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextParagraph {
    #[xmlserde(name = b"pPr", ty = "child")]
    pub p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(ty = "untag")]
    pub text_runs: Vec<EgTextRun>,
    #[xmlserde(name = b"endParaRPr", ty = "child")]
    pub end_para_r_pr: Option<CtTextCharacterProperties>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTextListStyle {
    #[xmlserde(name = b"defPPr", ty = "child")]
    pub def_p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl1pPr", ty = "child")]
    pub lvl1p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl2pPr", ty = "child")]
    pub lvl2p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl3pPr", ty = "child")]
    pub lvl3p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl4pPr", ty = "child")]
    pub lvl4p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl5pPr", ty = "child")]
    pub lvl5p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl6pPr", ty = "child")]
    pub lvl6p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl7pPr", ty = "child")]
    pub lvl7p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl8pPr", ty = "child")]
    pub lvl8p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"lvl9pPr", ty = "child")]
    pub lvl9p_pr: Option<CtTextParagraphProperties>,
    #[xmlserde(name = b"extLst", ty = "child")]
    pub ext_lst: Option<Unparsed>,
}
