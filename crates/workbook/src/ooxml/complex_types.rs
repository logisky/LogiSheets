use super::defaults::*;
use super::simple_types::*;
use gents::TS;
use logisheets_workbook_derives::MapObj;

#[derive(XmlSerialize, XmlDeserialize, Default, Debug, Clone)]
pub struct CtRst {
    #[xmlserde(name = b"t", ty = "child")]
    pub t: Option<PlainTextString>,
    #[xmlserde(name = b"r", ty = "child")]
    pub r: Vec<CtRElt>,
    #[xmlserde(name = b"rPh", ty = "child")]
    pub r_ph: Vec<CtPhoneticRun>,
    #[xmlserde(name = b"phoneticPr", ty = "child")]
    pub phonetic_pr: Option<CtPhoneticPr>,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug, Clone)]
pub struct CtRElt {
    #[xmlserde(name = b"rPr", ty = "child")]
    pub r_pr: Option<CtRPrElt>,
    #[xmlserde(name = b"t", ty = "child")]
    pub t: PlainTextString,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug, Clone)]
pub struct PlainTextString {
    #[xmlserde(ty = "text", default = "empty_string")]
    pub value: String,
    #[xmlserde(ty = "attr", name = b"xml:space")]
    pub space: Option<String>,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug)]
pub struct PlainTextU32 {
    #[xmlserde(ty = "text")]
    pub value: i32,
}

#[derive(XmlSerialize, XmlDeserialize, Default, Debug, Clone)]
pub struct CtRPrElt {
    #[xmlserde(name = b"b", ty = "sfc")]
    pub bold: bool,
    #[xmlserde(name = b"i", ty = "sfc")]
    pub italic: bool,
    #[xmlserde(name = b"strike", ty = "sfc")]
    pub strike: bool,
    #[xmlserde(name = b"outline", ty = "sfc")]
    pub outline: bool,
    #[xmlserde(name = b"shadow", ty = "sfc")]
    pub shadow: bool,
    #[xmlserde(name = b"condense", ty = "sfc")]
    pub condense: bool,
    #[xmlserde(name = b"extend", ty = "sfc")]
    pub extend: bool,
    #[xmlserde(name = b"sz", ty = "child")]
    pub size: Option<CtFontSize>,
    #[xmlserde(name = b"color", ty = "child")]
    pub color: Option<CtColor>,
    #[xmlserde(name = b"rFont", ty = "child")]
    pub r_font: Option<CtFontName>,
    #[xmlserde(name = b"family", ty = "child")]
    pub family: Option<CtIntProperty>,
    #[xmlserde(name = b"charset", ty = "child")]
    pub charset: Option<CtIntProperty>,
    #[xmlserde(name = b"u", ty = "child")]
    pub u: Option<CtUnderlineProperty>,
    #[xmlserde(name = b"vertAlign", ty = "child")]
    pub vert_align: Option<CtVerticalAlignFontProperty>,
    #[xmlserde(name = b"scheme", ty = "child")]
    pub scheme: Option<CtFontScheme>,
}

#[derive(
    XmlSerialize, XmlDeserialize, Default, Debug, Hash, PartialEq, Eq, Clone, serde::Serialize, TS,
)]
#[ts(file_name = "font_name.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct CtFontName {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: String,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Clone)]
pub struct CtPhoneticPr {
    #[xmlserde(name = b"fontId", ty = "attr")]
    pub font_id: StFontId,
    #[xmlserde(name = b"type", ty = "attr", default = "fullwidth_katakana")]
    pub ty: StPhoneticType,
    #[xmlserde(
        name = b"alignment",
        ty = "attr",
        default = "st_phonetic_alignment_left"
    )]
    pub alignment: StPhoneticAlignment,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Clone)]
pub struct CtPhoneticRun {
    #[xmlserde(name = b"t", ty = "child")]
    pub t: PlainTextString,
    #[xmlserde(name = b"sb", ty = "attr")]
    pub sb: u32,
    #[xmlserde(name = b"eb", ty = "attr")]
    pub eb: u32,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtColors {
    #[xmlserde(name = b"indexedColors", ty = "child")]
    pub indexed_colors: Option<CtIndexedColors>,
    #[xmlserde(name = b"mruColors", ty = "child")]
    pub mru_colors: Option<CtMruColors>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtIndexedColors {
    #[xmlserde(name = b"rgbColor", ty = "child")]
    pub rgb_color: Vec<CtRgbColor>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtRgbColor {
    #[xmlserde(name = b"rgb", ty = "attr")]
    pub rgb: Option<StUnsignedIntHex>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtMruColors {
    #[xmlserde(name = b"color", ty = "child")]
    pub color: Vec<CtColor>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Clone, MapObj)]
pub struct CtColor {
    #[xmlserde(name = b"auto", ty = "attr")]
    pub auto: Option<bool>,
    #[xmlserde(name = b"indexed", ty = "attr")]
    pub indexed: Option<u32>,
    #[xmlserde(name = b"rgb", ty = "attr")]
    pub rgb: Option<StUnsignedIntHex>,
    #[xmlserde(name = b"theme", ty = "attr")]
    pub theme: Option<u32>,
    #[xmlserde(name = b"tint", ty = "attr", default = "default_zero_f64")]
    pub tint: f64,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Hash, PartialEq, Eq, Clone)]
pub struct CtBorder {
    #[xmlserde(name = b"left", ty = "child")]
    pub left: Option<CtBorderPr>,
    #[xmlserde(name = b"right", ty = "child")]
    pub right: Option<CtBorderPr>,
    #[xmlserde(name = b"top", ty = "child")]
    pub top: Option<CtBorderPr>,
    #[xmlserde(name = b"bottom", ty = "child")]
    pub bottom: Option<CtBorderPr>,
    #[xmlserde(name = b"diagonal", ty = "child")]
    pub diagonal: Option<CtBorderPr>,
    #[xmlserde(name = b"vertical", ty = "child")]
    pub vertical: Option<CtBorderPr>,
    #[xmlserde(name = b"horizontal", ty = "child")]
    pub horizontal: Option<CtBorderPr>,
    #[xmlserde(name = b"diagonalUp", ty = "attr")]
    pub diagonal_up: Option<bool>,
    #[xmlserde(name = b"diagonalDown", ty = "attr")]
    pub diagonal_down: Option<bool>,
    #[xmlserde(name = b"outline", ty = "attr", default = "default_true")]
    pub outline: bool,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Hash, PartialEq, Eq, Clone)]
pub struct CtBorderPr {
    #[xmlserde(name = b"color", ty = "child")]
    pub color: Option<CtColor>,
    #[xmlserde(name = b"style", ty = "attr", default = "border_style_none")]
    pub style: StBorderStyle,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtBorders {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"border", ty = "child", vec_size = "count")]
    pub borders: Vec<CtBorder>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtCellStyles {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"cellStyle", ty = "child", vec_size = "count")]
    pub cell_styles: Vec<CtCellStyle>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtCellStyle {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"xfId", ty = "attr")]
    pub xf_id: StCellStyleXfId,
    #[xmlserde(name = b"builtinId", ty = "attr")]
    pub builtin_id: Option<u32>,
    #[xmlserde(name = b"iLevel", ty = "attr")]
    pub i_level: Option<u32>,
    #[xmlserde(name = b"customBuiltin", ty = "attr")]
    pub custom_builtin: Option<bool>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Clone, Hash, PartialEq, Eq)]
pub struct CtPatternFill {
    #[xmlserde(name = b"fgColor", ty = "child")]
    pub fg_color: Option<CtColor>,
    #[xmlserde(name = b"bgColor", ty = "child")]
    pub bg_color: Option<CtColor>,
    #[xmlserde(name = b"patternType", ty = "attr")]
    pub pattern_type: Option<StPatternType>,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Clone, MapObj)]
pub struct CtGradientFill {
    #[xmlserde(name = b"stop", ty = "child")]
    pub stops: Vec<CtGradientStop>,
    #[xmlserde(name = b"type", ty = "attr", default = "st_gradient_type_linear")]
    pub ty: StGradientType,
    #[xmlserde(name = b"degree", ty = "attr", default = "default_zero_f64")]
    pub degree: f64,
    #[xmlserde(name = b"left", ty = "attr", default = "default_zero_f64")]
    pub left: f64,
    #[xmlserde(name = b"right", ty = "attr", default = "default_zero_f64")]
    pub right: f64,
    #[xmlserde(name = b"top", ty = "attr", default = "default_zero_f64")]
    pub top: f64,
    #[xmlserde(name = b"bottom", ty = "attr", default = "default_zero_f64")]
    pub bottom: f64,
}

#[derive(XmlSerialize, XmlDeserialize, Debug, Clone, MapObj)]
pub struct CtGradientStop {
    #[xmlserde(name = b"color", ty = "child")]
    pub color: CtColor,
    #[xmlserde(name = b"position", ty = "attr")]
    pub position: f64,
}

#[derive(XmlSerialize, XmlDeserialize, Debug)]
pub struct CtFills {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"fill", ty = "child", vec_size = "count")]
    pub fills: Vec<CtFill>,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub enum CtFill {
    PatternFill(CtPatternFill),
    GradientFill(CtGradientFill),
}

impl crate::XmlSerialize for CtFill {
    fn serialize<W: std::io::Write>(&self, tag: &[u8], writer: &mut quick_xml::Writer<W>) {
        use quick_xml::events::*;
        let _ = writer.write_event(Event::Start(BytesStart::borrowed_name(tag)));
        match self {
            CtFill::PatternFill(p) => p.serialize(b"patternFill", writer),
            CtFill::GradientFill(f) => f.serialize(b"gradientFill", writer),
        }
        let _ = writer.write_event(Event::End(BytesEnd::borrowed(tag)));
    }
}

impl crate::XmlDeserialize for CtFill {
    fn deserialize<B: std::io::BufRead>(
        tag: &[u8],
        reader: &mut quick_xml::Reader<B>,
        _attrs: quick_xml::events::attributes::Attributes,
        _is_empty: bool,
    ) -> Self {
        use quick_xml::events::*;
        let mut buf = Vec::<u8>::new();
        let mut result = Option::<Self>::None;
        loop {
            match reader.read_event(&mut buf) {
                Ok(Event::Start(s)) => match s.name() {
                    b"patternFill" => {
                        let r = CtPatternFill::deserialize(
                            b"patternFill",
                            reader,
                            s.attributes(),
                            false,
                        );
                        result = Some(Self::PatternFill(r));
                    }
                    b"gradientFill" => {
                        let r = CtGradientFill::deserialize(
                            b"gradientFill",
                            reader,
                            s.attributes(),
                            false,
                        );
                        result = Some(Self::GradientFill(r));
                    }
                    _ => {}
                },
                Ok(Event::Empty(s)) => match s.name() {
                    b"patternFill" => {
                        let r = CtPatternFill::deserialize(
                            b"patternFill",
                            reader,
                            s.attributes(),
                            true,
                        );
                        result = Some(Self::PatternFill(r));
                    }
                    b"gradientFill" => {
                        let r = CtGradientFill::deserialize(
                            b"gradientFill",
                            reader,
                            s.attributes(),
                            true,
                        );
                        result = Some(Self::GradientFill(r));
                    }
                    _ => {}
                },
                Ok(Event::End(e)) => {
                    if e.name() == tag {
                        break;
                    }
                }
                Ok(Event::Eof) => break,
                _ => {}
            }
        }
        return result.unwrap();
    }
}

#[derive(Debug, XmlSerialize, XmlDeserialize, PartialEq, Eq, Clone, Hash, serde::Serialize, TS)]
#[ts(file_name = "cell_alignment.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct CtCellAlignment {
    #[xmlserde(name = b"horizontal", ty = "attr")]
    pub horizontal: Option<StHorizontalAlignment>,
    #[xmlserde(name = b"vertical", ty = "attr")]
    pub vertical: Option<StVerticalAlignment>,
    #[xmlserde(name = b"text_rotation", ty = "attr")]
    pub text_rotation: Option<u32>,
    #[xmlserde(name = b"wrapText", ty = "attr")]
    pub wrap_text: Option<bool>,
    #[xmlserde(name = b"indent", ty = "attr")]
    pub indent: Option<u32>,
    #[xmlserde(name = b"relativeIndent", ty = "attr")]
    pub relative_indent: Option<i32>,
    #[xmlserde(name = b"justifyLastLine", ty = "attr")]
    pub justify_last_line: Option<bool>,
    #[xmlserde(name = b"shrinkToFit", ty = "attr")]
    pub shrink_to_fit: Option<bool>,
    #[xmlserde(name = b"readingOrder", ty = "attr")]
    pub reading_order: Option<u32>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Hash, Eq, PartialEq, Clone, serde::Serialize, TS)]
#[ts(file_name = "cell_protection.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct CtCellProtection {
    #[xmlserde(name = b"locked", ty = "attr")]
    pub locked: Option<bool>,
    #[xmlserde(name = b"hidden", ty = "attr")]
    pub hidden: Option<bool>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Hash, PartialEq, Eq, Clone, serde::Serialize, TS)]
#[ts(file_name = "font_scheme.ts")]
pub struct CtFontScheme {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: StFontScheme,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFonts {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"font", ty = "child", vec_size = "count")]
    pub fonts: Vec<CtFont>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Hash, Eq, PartialEq, Clone)]
pub struct CtFont {
    #[xmlserde(name = b"b", ty = "sfc")]
    pub bold: bool,
    #[xmlserde(name = b"i", ty = "sfc")]
    pub italic: bool,
    #[xmlserde(name = b"u", ty = "child")]
    pub underline: Option<CtUnderlineProperty>,
    #[xmlserde(name = b"color", ty = "child")]
    pub color: Option<CtColor>,
    #[xmlserde(name = b"sz", ty = "child")]
    pub sz: Option<CtFontSize>,
    #[xmlserde(name = b"name", ty = "child")]
    pub name: Option<CtFontName>,
    #[xmlserde(name = b"charset", ty = "child")]
    pub charset: Option<CtIntProperty>,
    #[xmlserde(name = b"family", ty = "child")]
    pub family: Option<CtFontFamily>,
    #[xmlserde(name = b"strike", ty = "sfc")]
    pub strike: bool,
    #[xmlserde(name = b"outline", ty = "sfc")]
    pub outline: bool,
    #[xmlserde(name = b"shadow", ty = "sfc")]
    pub shadow: bool,
    #[xmlserde(name = b"condense", ty = "sfc")]
    pub condense: bool,
    #[xmlserde(name = b"extend", ty = "sfc")]
    pub extend: bool,
    #[xmlserde(name = b"vertAlign", ty = "child")]
    pub vert_align: Option<CtVerticalAlignFontProperty>,
    #[xmlserde(name = b"scheme", ty = "child")]
    pub scheme: Option<CtFontScheme>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Hash, PartialEq, Eq, Clone, serde::Serialize, TS)]
#[ts(
    file_name = "vertical_align_font_property.ts",
    rename_all = "camelCase"
)]
#[serde(rename_all = "camelCase")]
pub struct CtVerticalAlignFontProperty {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: StVerticalAlignRun,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, MapObj, Clone, serde::Serialize, TS)]
#[ts(file_name = "font_size.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct CtFontSize {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: f64,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Hash, PartialEq, Eq, Clone, serde::Serialize, TS)]
#[ts(file_name = "int_property.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct CtIntProperty {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: i32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Hash, PartialEq, Eq, Clone, serde::Serialize, TS)]
#[ts(file_name = "underline_property.ts")]
pub struct CtUnderlineProperty {
    #[xmlserde(name = b"val", ty = "attr", default = "st_underline_values_single")]
    pub val: StUnderlineValues,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Hash, PartialEq, Eq, Clone, serde::Serialize, TS)]
#[ts(file_name = "font_family.ts", rename_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub struct CtFontFamily {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: StFontFamily,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTableStyle {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"pivot", ty = "attr", default = "default_true")]
    pub pivot: bool,
    #[xmlserde(name = b"table", ty = "attr", default = "default_true")]
    pub table: bool,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"tableStyleElement", ty = "child", vec_size = "count")]
    pub table_style_elements: Vec<CtTableStyleElement>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTableStyles {
    #[xmlserde(name = b"tableStyle", ty = "child", vec_size = "count")]
    pub table_styles: Vec<CtTableStyle>,
    #[xmlserde(name = b"count", default = "default_zero_u32", ty = "attr")]
    pub count: u32,
    #[xmlserde(name = b"defaultTableStyle", ty = "attr")]
    pub default_table_style: Option<String>,
    #[xmlserde(name = b"defaultPivotStyle", ty = "attr")]
    pub default_pivot_style: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTableStyleElement {
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: StTableStyleType,
    #[xmlserde(name = b"size", ty = "attr", default = "default_one_u32")]
    pub size: u32,
    #[xmlserde(name = b"dxfId", ty = "attr")]
    pub dxf_id: Option<StDxfId>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDxfs {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"dxf", ty = "child", vec_size = "count")]
    pub dxfs: Vec<CtDxf>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDxf {
    #[xmlserde(name = b"font", ty = "child")]
    pub font: Option<CtFont>,
    #[xmlserde(name = b"numFmt", ty = "child")]
    pub num_fmt: Option<CtNumFmt>,
    #[xmlserde(name = b"fill", ty = "child")]
    pub fill: Option<CtFill>,
    #[xmlserde(name = b"alignment", ty = "child")]
    pub alignment: Option<CtCellAlignment>,
    #[xmlserde(name = b"border", ty = "child")]
    pub border: Option<CtBorder>,
    #[xmlserde(name = b"protection", ty = "child")]
    pub protection: Option<CtCellProtection>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtNumFmt {
    #[xmlserde(name = b"numFmtId", ty = "attr")]
    pub num_fmt_id: StNumFmtId,
    #[xmlserde(name = b"formatCode", ty = "attr")]
    pub format_code: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtNumFmts {
    #[xmlserde(name = b"numFmt", ty = "child", vec_size = "count")]
    pub num_fmts: Vec<CtNumFmt>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtXf {
    #[xmlserde(name = b"alignment", ty = "child")]
    pub alignment: Option<CtCellAlignment>,
    #[xmlserde(name = b"protection", ty = "child")]
    pub protction: Option<CtCellProtection>,
    #[xmlserde(name = b"numFmtId", ty = "attr")]
    pub num_fmt_id: Option<StNumFmtId>,
    #[xmlserde(name = b"fontId", ty = "attr")]
    pub font_id: Option<StFontId>,
    #[xmlserde(name = b"fillId", ty = "attr")]
    pub fill_id: Option<StFillId>,
    #[xmlserde(name = b"borderId", ty = "attr")]
    pub border_id: Option<StBorderId>,
    #[xmlserde(name = b"xfId", ty = "attr")]
    pub xf_id: Option<StCellStyleXfId>,
    #[xmlserde(name = b"quotePrefix", ty = "attr", default = "default_false")]
    pub quote_prefix: bool,
    #[xmlserde(name = b"pivotButton", ty = "attr", default = "default_false")]
    pub pivot_button: bool,
    #[xmlserde(name = b"applyNumberFormat", ty = "attr")]
    pub apply_number_format: Option<bool>,
    #[xmlserde(name = b"applyFont", ty = "attr")]
    pub apply_font: Option<bool>,
    #[xmlserde(name = b"applyFill", ty = "attr")]
    pub apply_fill: Option<bool>,
    #[xmlserde(name = b"applyBorder", ty = "attr")]
    pub apply_border: Option<bool>,
    #[xmlserde(name = b"applyAlignment", ty = "attr")]
    pub apply_alignment: Option<bool>,
    #[xmlserde(name = b"applyProtection", ty = "attr")]
    pub apply_protection: Option<bool>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtCellStyleXfs {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"xf", ty = "child", vec_size = "count")]
    pub xfs: Vec<CtXf>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtCellXfs {
    #[xmlserde(name = b"xf", ty = "child", vec_size = "count")]
    pub xfs: Vec<CtXf>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtComment {
    #[xmlserde(name = b"text", ty = "child")]
    pub text: CtRst,
    #[xmlserde(name = b"commentPr", ty = "child")]
    pub comment_pr: Option<CtCommentPr>,
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: StRef,
    #[xmlserde(name = b"authorId", ty = "attr")]
    pub author_id: u32,
    #[xmlserde(name = b"shapeId", ty = "attr")]
    pub shape_id: Option<u32>,
    #[xmlserde(name = b"xr:uid", ty = "attr")]
    pub guid: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCommentList {
    #[xmlserde(name = b"comment", ty = "child")]
    pub comments: Vec<CtComment>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtAuthors {
    #[xmlserde(name = b"author", ty = "child")]
    pub authors: Vec<PlainTextString>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtObjectAnchor {
    #[xmlserde(name = b"moveWithCells", ty = "attr", default = "default_false")]
    pub move_with_cells: bool,
    #[xmlserde(name = b"sizeWithCells", ty = "attr", default = "default_false")]
    pub size_with_cells: bool,
    #[xmlserde(name = b"from", ty = "child")]
    pub from: CtMarker,
    #[xmlserde(name = b"to", ty = "child")]
    pub to: CtMarker,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtMarker {
    #[xmlserde(name = b"xdr:col", ty = "child")]
    pub col: PlainTextU32,
    #[xmlserde(name = b"xdr:colOff", ty = "child")]
    pub col_off: PlainTextU32,
    #[xmlserde(name = b"xdr:row", ty = "child")]
    pub row: PlainTextU32,
    #[xmlserde(name = b"xdr:rowOff", ty = "child")]
    pub row_off: PlainTextU32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCommentPr {
    #[xmlserde(name = b"anchor", ty = "child")]
    pub anchor: CtObjectAnchor,
    #[xmlserde(name = b"locked", ty = "attr", default = "default_true")]
    pub locked: bool,
    #[xmlserde(name = b"default_size", ty = "attr", default = "default_true")]
    pub default_size: bool,
    #[xmlserde(name = b"print", ty = "attr", default = "default_true")]
    pub print: bool,
    #[xmlserde(name = b"disabled", ty = "attr", default = "default_false")]
    pub disabled: bool,
    #[xmlserde(name = b"autoFill", ty = "attr", default = "default_true")]
    pub auto_fill: bool,
    #[xmlserde(name = b"autoLine", ty = "attr", default = "default_true")]
    pub auto_line: bool,
    #[xmlserde(name = b"altText", ty = "attr")]
    pub alt_text: Option<String>,
    #[xmlserde(name = b"textHAlign", ty = "attr", default = "st_text_h_align_left")]
    pub text_h_align: StTextHAlign,
    #[xmlserde(name = b"textVAlign", ty = "attr", default = "st_text_v_align_top")]
    pub text_v_align: StTextVAlign,
    #[xmlserde(name = b"lockText", ty = "attr", default = "default_true")]
    pub lock_text: bool,
    #[xmlserde(name = b"justLastX", ty = "attr", default = "default_false")]
    pub just_last_x: bool,
    #[xmlserde(name = b"autoScale", ty = "attr", default = "default_false")]
    pub auto_scale: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFileVersion {
    #[xmlserde(name = b"appName", ty = "attr")]
    pub app_name: Option<String>,
    #[xmlserde(name = b"lastEdited", ty = "attr")]
    pub last_edited: Option<String>,
    #[xmlserde(name = b"lowestEdited", ty = "attr")]
    pub lowest_edited: Option<String>,
    #[xmlserde(name = b"rupBuild", ty = "attr")]
    pub rup_build: Option<String>,
    #[xmlserde(name = b"codeName", ty = "attr")]
    pub code_name: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDefinedNames {
    #[xmlserde(name = b"definedName", ty = "child")]
    pub names: Vec<CtDefinedName>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDefinedName {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"comment", ty = "attr")]
    pub comment: Option<String>,
    #[xmlserde(name = b"commentMenu", ty = "attr")]
    pub comment_menu: Option<String>,
    #[xmlserde(name = b"description", ty = "attr")]
    pub description: Option<String>,
    #[xmlserde(name = b"help", ty = "attr")]
    pub help: Option<String>,
    #[xmlserde(name = b"statusBar", ty = "attr")]
    pub status_bar: Option<String>,
    #[xmlserde(name = b"localSheetId", ty = "attr")]
    pub local_sheet_id: Option<u32>,
    #[xmlserde(name = b"hidden", ty = "attr", default = "default_false")]
    pub hidden: bool,
    #[xmlserde(name = b"function", ty = "attr", default = "default_false")]
    pub function: bool,
    #[xmlserde(name = b"vbProcedure", ty = "attr", default = "default_false")]
    pub vb_procedure: bool,
    #[xmlserde(name = b"xlm", ty = "attr", default = "default_false")]
    pub xlm: bool,
    #[xmlserde(name = b"functionGroupId", ty = "attr")]
    pub function_group_id: Option<u32>,
    #[xmlserde(name = b"shortcutKey", ty = "attr")]
    pub shortcut_key: Option<String>,
    #[xmlserde(name = b"publishToServer", ty = "attr", default = "default_false")]
    pub publish_to_server: bool,
    #[xmlserde(name = b"workbookParameter", ty = "attr", default = "default_false")]
    pub workbook_parameter: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFileRecoveryPr {
    #[xmlserde(name = b"autoRecover", ty = "attr", default = "default_true")]
    pub auto_recover: bool,
    #[xmlserde(name = b"crashSave", ty = "attr", default = "default_false")]
    pub crash_save: bool,
    #[xmlserde(name = b"dataExtractLoad", ty = "attr", default = "default_false")]
    pub data_extract_load: bool,
    #[xmlserde(name = b"repairLoad", ty = "attr", default = "default_false")]
    pub repair_load: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCalcPr {
    #[xmlserde(name = b"calcId", ty = "attr")]
    pub calc_id: u32,
    #[xmlserde(name = b"calcMode", ty = "attr", default = "st_calc_mode_auto")]
    pub calc_mode: StCalcMode,
    #[xmlserde(name = b"fullCalcOnLoad", ty = "attr", default = "default_false")]
    pub full_calc_on_load: bool,
    #[xmlserde(name = b"refMode", ty = "attr", default = "st_ref_mode_a1")]
    pub ref_mode: StRefMode,
    #[xmlserde(name = b"iterate", ty = "attr", default = "default_false")]
    pub iterate: bool,
    #[xmlserde(name = b"iterateCount", ty = "attr", default = "default_100_u32")]
    pub iterate_count: u32,
    #[xmlserde(name = b"iterateDelta", ty = "attr", default = "default_iterate_delta")]
    pub iterate_delta: f64,
    #[xmlserde(name = b"fullPrecision", ty = "attr", default = "default_true")]
    pub full_precision: bool,
    #[xmlserde(name = b"calcCompleted", ty = "attr", default = "default_true")]
    pub calc_completed: bool,
    #[xmlserde(name = b"calcOnSave", ty = "attr", default = "default_true")]
    pub calc_on_save: bool,
    #[xmlserde(name = b"concurrentCalc", ty = "attr", default = "default_true")]
    pub concurrent_calc: bool,
    #[xmlserde(name = b"concurrentManualCount", ty = "attr", default = "default_true")]
    pub concurrent_manual_calc: bool,
    #[xmlserde(name = b"forceFullCalc", ty = "attr")]
    pub force_full_calc: Option<bool>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtSmartTagPr {
    #[xmlserde(name = b"embed", ty = "attr", default = "default_false")]
    pub embed: bool,
    #[xmlserde(name = b"show", ty = "attr", default = "st_smart_tag_show_all")]
    pub show: StSmartTagShow,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtWorkbookPr {
    #[xmlserde(name = b"date1904", ty = "attr", default = "default_false")]
    pub date1904: bool,
    #[xmlserde(name = b"showObjects", ty = "attr", default = "st_objects_all")]
    pub show_objects: StObjects,
    #[xmlserde(
        name = b"showBorderUnselectedTables",
        ty = "attr",
        default = "default_true"
    )]
    pub show_border_unselected_tables: bool,
    #[xmlserde(name = b"filterPrivacy", ty = "attr", default = "default_false")]
    pub filter_privacy: bool,
    #[xmlserde(name = b"promptedSolutions", ty = "attr", default = "default_false")]
    pub prompted_solutions: bool,
    #[xmlserde(name = b"showInkASnnotation", ty = "attr", default = "default_true")]
    pub show_ink_annotation: bool,
    #[xmlserde(name = b"backupFile", ty = "attr", default = "default_false")]
    pub backup_file: bool,
    #[xmlserde(
        name = b"saveExternalLinkValues",
        ty = "attr",
        default = "default_true"
    )]
    pub save_external_link_values: bool,
    #[xmlserde(name = b"updateLinks", ty = "attr", default = "st_update_links")]
    pub update_links: StUpdateLinks,
    #[xmlserde(name = b"codeName", ty = "attr")]
    pub code_name: Option<String>,
    #[xmlserde(name = b"hidePivotFieldList", ty = "attr", default = "default_false")]
    pub hide_pivot_field_list: bool,
    #[xmlserde(name = b"showPivotChartFilter", ty = "attr", default = "default_false")]
    pub show_pivot_chart_filter: bool,
    #[xmlserde(name = b"allowRefreshQuery", ty = "attr", default = "default_false")]
    pub allow_refresh_query: bool,
    #[xmlserde(name = b"publish_items", ty = "attr", default = "default_false")]
    pub publish_items: bool,
    #[xmlserde(name = b"checkCompatibility", ty = "attr", default = "default_false")]
    pub check_compatibility: bool,
    #[xmlserde(
        name = b"auto_compress_pictures",
        ty = "attr",
        default = "default_true"
    )]
    pub auto_compress_pictures: bool,
    #[xmlserde(name = b"refreshAllConnections", ty = "attr", default = "default_true")]
    pub refresh_all_connections: bool,
    #[xmlserde(name = b"defaultThemeVersion", ty = "attr")]
    pub default_theme_version: Option<u32>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtWorkbookProtection {
    #[xmlserde(name = b"lockStructure", ty = "attr", default = "default_false")]
    pub lock_structure: bool,
    #[xmlserde(name = b"lockWindows", ty = "attr", default = "default_false")]
    pub lock_windows: bool,
    #[xmlserde(name = b"lockVersion", ty = "attr", default = "default_false")]
    pub lock_version: bool,
    #[xmlserde(name = b"revisionsAlgorithmName", ty = "attr")]
    pub revisions_algorithm_name: Option<String>,
    #[xmlserde(name = b"revisionsHashValue", ty = "attr")]
    pub revisions_hash_value: Option<String>,
    #[xmlserde(name = b"revisionsSaltValue", ty = "attr")]
    pub revisions_salt_value: Option<String>,
    #[xmlserde(name = b"revisionsSpinCount", ty = "attr")]
    pub revisions_spin_count: Option<u32>,
    #[xmlserde(name = b"workbookAlgorithmName", ty = "attr")]
    pub workbook_algorithm_name: Option<String>,
    #[xmlserde(name = b"workbookHashValue", ty = "attr")]
    pub workbook_hash_value: Option<String>,
    #[xmlserde(name = b"workbookSaltValue", ty = "attr")]
    pub workbook_salt_value: Option<String>,
    #[xmlserde(name = b"workbookSpinCount", ty = "attr")]
    pub workbook_spin_count: Option<u32>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtWebPublishing {
    #[xmlserde(name = b"css", ty = "attr", default = "default_true")]
    pub css: bool,
    #[xmlserde(name = b"ticket", ty = "attr", default = "default_true")]
    pub ticket: bool,
    #[xmlserde(name = b"logFileNames", ty = "attr", default = "default_true")]
    pub long_file_names: bool,
    #[xmlserde(name = b"vml", ty = "attr", default = "default_false")]
    pub vml: bool,
    #[xmlserde(name = b"allowPng", ty = "attr", default = "default_false")]
    pub allow_png: bool,
    #[xmlserde(
        name = b"targetScreenSize",
        ty = "attr",
        default = "default_screen_size"
    )]
    pub target_screen_size: StTargetScreenSize,
    #[xmlserde(name = b"dpi", ty = "attr", default = "default_dpi")]
    pub dpi: u32,
    #[xmlserde(name = b"characterSet", ty = "attr")]
    pub character_set: Option<String>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtOleSize {
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: StRef,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtPivotCaches {
    #[xmlserde(name = b"pivot_cache", ty = "child")]
    pub pivot_caches: Vec<CtPivotCache>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtPivotCache {
    #[xmlserde(name = b"cacheId", ty = "attr")]
    pub cache_id: u32,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtFileSharing {
    #[xmlserde(name = b"readOnlyRecommended", ty = "attr", default = "default_false")]
    pub read_only_recommended: bool,
    #[xmlserde(name = b"userName", ty = "attr")]
    pub user_name: String,
    #[xmlserde(name = b"algorithmName", ty = "attr")]
    pub algorithm_name: Option<String>,
    #[xmlserde(name = b"hashValue", ty = "attr")]
    pub hash_value: Option<String>,
    #[xmlserde(name = b"saltValue", ty = "attr")]
    pub salt_value: Option<String>,
    #[xmlserde(name = b"spinCount", ty = "attr")]
    pub spin_count: Option<u32>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtSmartTagTypes {
    #[xmlserde(name = b"smartTagType", ty = "child")]
    pub smart_tag_types: Vec<CtSmartTagType>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtSmartTagType {
    #[xmlserde(name = b"namespaceUri", ty = "attr")]
    pub namespace_uri: Option<String>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"url", ty = "attr")]
    pub url: Option<String>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtExternalReferences {
    #[xmlserde(name = b"externalReference", ty = "child")]
    pub external_references: Vec<CtExternalReference>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtExternalReference {
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtWebPublishObjects {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"webPublishObject", ty = "child", vec_size = "count")]
    pub web_publish_objects: Vec<CtWebPublishObject>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtWebPublishObject {
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: u32,
    #[xmlserde(name = b"divId", ty = "attr")]
    pub div_id: String,
    #[xmlserde(name = b"sourceObject", ty = "attr")]
    pub source_object: Option<String>,
    #[xmlserde(name = b"destinationFile", ty = "attr")]
    pub destination_file: String,
    #[xmlserde(name = b"title", ty = "attr")]
    pub title: Option<String>,
    #[xmlserde(name = b"autoRepublish", ty = "attr", default = "default_false")]
    pub auto_republish: bool,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtFunctionGroups {
    #[xmlserde(name = b"functionGroup", ty = "child")]
    pub function_groups: Vec<CtFunctionGroup>,
    #[xmlserde(
        name = b"buildInGroupCount",
        ty = "attr",
        default = "default_built_in_group_count"
    )]
    pub built_in_group_count: u32,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtFunctionGroup {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtBookViews {
    #[xmlserde(name = b"workbookView", ty = "child")]
    pub views: Vec<CtBookView>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtBookView {
    #[xmlserde(name = b"visibility", ty = "attr", default = "st_visibility_visible")]
    pub visibility: StVisibility,
    #[xmlserde(name = b"minimized", ty = "attr", default = "default_false")]
    pub minimized: bool,
    #[xmlserde(name = b"showHorizontalScroll", ty = "attr", default = "default_true")]
    pub show_horizontal_scroll: bool,
    #[xmlserde(name = b"showVerticalScroll", ty = "attr", default = "default_true")]
    pub show_vertical_scroll: bool,
    #[xmlserde(name = b"showSheetTabs", ty = "attr", default = "default_true")]
    pub show_sheet_tabs: bool,
    #[xmlserde(name = b"xWindow", ty = "attr")]
    pub x_window: Option<i32>,
    #[xmlserde(name = b"yWindow", ty = "attr")]
    pub y_window: Option<i32>,
    #[xmlserde(name = b"windowWidth", ty = "attr")]
    pub window_width: Option<u32>,
    #[xmlserde(name = b"windowHeight", ty = "attr")]
    pub window_height: Option<u32>,
    #[xmlserde(name = b"tabRatio", ty = "attr", default = "default_tab_ratio")]
    pub tab_ratio: u32,
    #[xmlserde(name = b"firstSheet", ty = "attr", default = "default_zero_u32")]
    pub first_sheet: u32,
    #[xmlserde(name = b"activeTab", ty = "attr", default = "default_zero_u32")]
    pub active_tab: u32,
    #[xmlserde(
        name = b"autoFilterDateGrouping",
        ty = "attr",
        default = "default_true"
    )]
    pub auto_filter_date_grouping: bool,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtCustomWorkbookViews {
    #[xmlserde(name = b"customWorkbookView", ty = "child")]
    pub custom_workbook_views: Vec<CtCustomWorkbookView>,
}

#[derive(Debug, XmlDeserialize, XmlSerialize)]
pub struct CtCustomWorkbookView {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"guid", ty = "attr")]
    pub guid: String,
    #[xmlserde(name = b"autoUpdate", ty = "attr", default = "default_false")]
    pub auto_update: bool,
    #[xmlserde(name = b"mergeInterval", ty = "attr")]
    pub merge_interval: Option<u32>,
    #[xmlserde(name = b"changesSavedWin", ty = "attr", default = "default_false")]
    pub changes_saved_win: bool,
    #[xmlserde(name = b"onlySync", ty = "attr", default = "default_false")]
    pub only_sync: bool,
    #[xmlserde(name = b"personal_view", ty = "attr", default = "default_false")]
    pub personal_view: bool,
    #[xmlserde(name = b"includePrintSettings", ty = "attr", default = "default_true")]
    pub include_print_settings: bool,
    #[xmlserde(name = b"includeHiddenRowCol", ty = "attr", default = "default_true")]
    pub include_hidden_row_col: bool,
    #[xmlserde(name = b"maximized", ty = "attr", default = "default_false")]
    pub maximized: bool,
    #[xmlserde(name = b"minimized", ty = "attr", default = "default_false")]
    pub minimized: bool,
    #[xmlserde(name = b"showHorizontalScroll", ty = "attr", default = "default_true")]
    pub show_horizontal_scroll: bool,
    #[xmlserde(name = b"showVerticalScroll", ty = "attr", default = "default_true")]
    pub show_vertical_scroll: bool,
    #[xmlserde(name = b"showSheetTabs", ty = "attr", default = "default_true")]
    pub show_sheet_tabs: bool,
    #[xmlserde(name = b"xWindow", ty = "attr")]
    pub x_window: Option<i32>,
    #[xmlserde(name = b"yWindow", ty = "attr")]
    pub y_window: Option<i32>,
    #[xmlserde(name = b"windowWidth", ty = "attr")]
    pub window_width: u32,
    #[xmlserde(name = b"windowHeight", ty = "attr")]
    pub window_height: u32,
    #[xmlserde(name = b"tabRatio", ty = "attr", default = "default_tab_ratio")]
    pub tab_ratio: u32,
    #[xmlserde(name = b"activeSheetId", ty = "attr")]
    pub active_sheet_id: u32,
    #[xmlserde(name = b"showFormulaBar", ty = "attr", default = "default_true")]
    pub show_formula_bar: bool,
    #[xmlserde(name = b"showStatusBar", ty = "attr", default = "default_true")]
    pub show_statusbar: bool,
    #[xmlserde(
        name = b"showComments",
        ty = "attr",
        default = "st_comments_comm_indicator"
    )]
    pub show_comments: StComments,
    #[xmlserde(name = b"showObjects", ty = "attr", default = "st_objects_all")]
    pub show_objects: StObjects,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheets {
    #[xmlserde(name = b"sheet", ty = "child")]
    pub sheets: Vec<CtSheet>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheet {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"sheetId", ty = "attr")]
    pub sheet_id: u32,
    #[xmlserde(name = b"state", ty = "attr", default = "st_sheet_state_visible")]
    pub state: StSheetState,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetPr {
    #[xmlserde(name = b"tabColor", ty = "child")]
    pub tab_color: Option<CtColor>,
    #[xmlserde(name = b"outlinePr", ty = "child")]
    pub outline_pr: Option<CtOutlinePr>,
    #[xmlserde(name = b"pageSetupPr", ty = "child")]
    pub page_setup_pr: Option<CtPageSetupPr>,
    #[xmlserde(name = b"syncHorizontal", ty = "attr", default = "default_false")]
    pub sync_horizontal: bool,
    #[xmlserde(name = b"syncVertical", ty = "attr", default = "default_false")]
    pub sync_vertical: bool,
    #[xmlserde(name = b"syncRef", ty = "attr")]
    pub sync_ref: Option<StRef>,
    #[xmlserde(name = b"transitionEvaluation", ty = "attr", default = "default_false")]
    pub transition_evaluation: bool,
    #[xmlserde(name = b"transitionEntry", ty = "attr", default = "default_false")]
    pub transition_entry: bool,
    #[xmlserde(name = b"published", ty = "attr", default = "default_true")]
    pub published: bool,
    #[xmlserde(name = b"codeName", ty = "attr")]
    pub code_name: Option<String>,
    #[xmlserde(name = b"filterMode", ty = "attr", default = "default_false")]
    pub filter_mode: bool,
    #[xmlserde(
        name = b"enableFormatConditionsCalculation",
        ty = "attr",
        default = "default_true"
    )]
    pub enable_format_conditions_calculation: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtOutlinePr {
    #[xmlserde(name = b"applyStyles", ty = "attr", default = "default_false")]
    pub apply_styles: bool,
    #[xmlserde(name = b"summaryBelow", ty = "attr", default = "default_true")]
    pub summary_below: bool,
    #[xmlserde(name = b"summaryRight", ty = "attr", default = "default_true")]
    pub summary_right: bool,
    #[xmlserde(name = b"showOutlineSymbols", ty = "attr", default = "default_true")]
    pub show_outline_symbols: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPageSetupPr {
    #[xmlserde(name = b"autoPageBreaks", ty = "attr", default = "default_true")]
    pub auto_page_breaks: bool,
    #[xmlserde(name = b"fitToPage", ty = "attr", default = "default_false")]
    pub fit_to_page: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetDimension {
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: StRef,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetViews {
    #[xmlserde(name = b"sheetView", ty = "child")]
    pub sheet_views: Vec<CtSheetView>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetView {
    #[xmlserde(name = b"pane", ty = "child")]
    pub pane: Option<CtPane>,
    #[xmlserde(name = b"selection", ty = "child")]
    pub selection: Vec<CtSelection>, // maxOccurs = 4,
    #[xmlserde(name = b"pivotSelection", ty = "child")]
    pub pivot_selection: Vec<CtPivotSelection>, // maxOccurs = 4
    #[xmlserde(name = b"windowProtection", ty = "attr", default = "default_false")]
    pub window_protection: bool,
    #[xmlserde(name = b"showFormulas", ty = "attr", default = "default_false")]
    pub show_formulas: bool,
    #[xmlserde(name = b"showGridLines", ty = "attr", default = "default_true")]
    pub show_grid_lines: bool,
    #[xmlserde(name = b"showRowColHeaders", ty = "attr", default = "default_true")]
    pub show_row_col_headers: bool,
    #[xmlserde(name = b"showZeros", ty = "attr", default = "default_true")]
    pub show_zeros: bool,
    #[xmlserde(name = b"rightToLeft", ty = "attr", default = "default_false")]
    pub right_to_left: bool,
    #[xmlserde(name = b"tabSelected", ty = "attr", default = "default_false")]
    pub tab_selected: bool,
    #[xmlserde(name = b"showRuler", ty = "attr", default = "default_true")]
    pub show_ruler: bool,
    #[xmlserde(name = b"showOutlineSymbols", ty = "attr", default = "default_true")]
    pub show_outline_symbols: bool,
    #[xmlserde(name = b"defaultGridColor", ty = "attr", default = "default_true")]
    pub default_grid_color: bool,
    #[xmlserde(name = b"showWhiteSpace", ty = "attr", default = "default_true")]
    pub show_white_space: bool,
    #[xmlserde(name = b"view", ty = "attr", default = "st_sheet_view_type_normal")]
    pub view: StSheetViewType,
    #[xmlserde(name = b"topLeftCell", ty = "attr")]
    pub top_left_cell: Option<StCellRef>,
    #[xmlserde(name = b"colorId", ty = "attr", default = "default_color_id")]
    pub color_id: u32,
    #[xmlserde(name = b"zoomScale", ty = "attr", default = "default_100_u32")]
    pub zoom_scale: u32,
    #[xmlserde(name = b"zoomScaleNormal", ty = "attr", default = "default_zero_u32")]
    pub zoom_scale_normal: u32,
    #[xmlserde(
        name = b"zoomScaleSheetLayoutView",
        ty = "attr",
        default = "default_zero_u32"
    )]
    pub zoom_scale_sheet_layout_view: u32,
    #[xmlserde(
        name = b"zoomScalePageLayoutView",
        ty = "attr",
        default = "default_zero_u32"
    )]
    pub zoom_scale_page_layout_view: u32,
    #[xmlserde(name = b"workbookViewId", ty = "attr")]
    pub workbook_view_id: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPane {
    #[xmlserde(name = b"xSplit", ty = "attr", default = "default_zero_f64")]
    pub x_split: f64,
    #[xmlserde(name = b"ySplit", ty = "attr", default = "default_zero_f64")]
    pub y_split: f64,
    #[xmlserde(name = b"topLeftCell", ty = "attr")]
    pub top_left_cell: Option<StCellRef>,
    #[xmlserde(name = b"activePane", ty = "attr", default = "st_pane_top_left")]
    pub active_pane: StPane,
    #[xmlserde(name = b"state", ty = "attr", default = "st_pane_state_split")]
    pub state: StPaneState,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSelection {
    #[xmlserde(name = b"pane", ty = "attr", default = "st_pane_top_left")]
    pub pane: StPane,
    #[xmlserde(name = b"activeCell", ty = "attr")]
    pub active_cell: Option<StCellRef>,
    #[xmlserde(name = b"activeCellId", ty = "attr", default = "default_zero_u32")]
    pub active_cell_id: u32,
    #[xmlserde(name = b"sqref", ty = "attr")]
    pub sqref: Option<String>, // todo
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPivotSelection {
    #[xmlserde(name = b"pivotArea", ty = "child")]
    pub pivot_area: CtPivotArea,
    #[xmlserde(name = b"pane", ty = "attr", default = "st_pane_top_left")]
    pub pane: StPane,
    #[xmlserde(name = b"showHeader", ty = "attr", default = "default_false")]
    pub show_header: bool,
    #[xmlserde(name = b"label", ty = "attr", default = "default_false")]
    pub label: bool,
    #[xmlserde(name = b"data", ty = "attr", default = "default_false")]
    pub data: bool,
    #[xmlserde(name = b"extendable", ty = "attr", default = "default_false")]
    pub extendable: bool,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"axis", ty = "attr")]
    pub axis: Option<StAxis>,
    #[xmlserde(name = b"dimension", ty = "attr", default = "default_zero_u32")]
    pub dimension: u32,
    #[xmlserde(name = b"start", ty = "attr", default = "default_zero_u32")]
    pub start: u32,
    #[xmlserde(name = b"min", ty = "attr", default = "default_zero_u32")]
    pub min: u32,
    #[xmlserde(name = b"max", ty = "attr", default = "default_zero_u32")]
    pub max: u32,
    #[xmlserde(name = b"activeRow", ty = "attr", default = "default_zero_u32")]
    pub active_row: u32,
    #[xmlserde(name = b"activeCol", ty = "attr", default = "default_zero_u32")]
    pub active_col: u32,
    #[xmlserde(name = b"previousRow", ty = "attr", default = "default_zero_u32")]
    pub previous_row: u32,
    #[xmlserde(name = b"previousCol", ty = "attr", default = "default_zero_u32")]
    pub previous_col: u32,
    #[xmlserde(name = b"click", ty = "attr", default = "default_zero_u32")]
    pub click: u32,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPivotArea {
    #[xmlserde(name = b"references", ty = "child")]
    pub references: Option<CtPivotAreaReferences>,
    #[xmlserde(name = b"field", ty = "attr")]
    pub field: Option<i32>,
    #[xmlserde(name = b"type", ty = "attr", default = "st_pivot_area_type_normal")]
    pub ty: StPivotAreaType,
    #[xmlserde(name = b"dataOnly", ty = "attr", default = "default_true")]
    pub data_only: bool,
    #[xmlserde(name = b"labelOnly", ty = "attr", default = "default_false")]
    pub label_only: bool,
    #[xmlserde(name = b"grandRow", ty = "attr", default = "default_false")]
    pub grand_row: bool,
    #[xmlserde(name = b"grandCol", ty = "attr", default = "default_false")]
    pub grand_col: bool,
    #[xmlserde(name = b"cacheIndex", ty = "attr", default = "default_false")]
    pub cache_index: bool,
    #[xmlserde(name = b"outline", ty = "attr", default = "default_true")]
    pub outline: bool,
    #[xmlserde(name = b"offset", ty = "attr")]
    pub offset: StRef,
    #[xmlserde(
        name = b"collapsedLevelAreSubtotals",
        ty = "attr",
        default = "default_true"
    )]
    pub collapsed_level_are_subtotals: bool,
    #[xmlserde(name = b"axis", ty = "attr")]
    pub axis: Option<StAxis>,
    #[xmlserde(name = b"fieldPosition", ty = "attr")]
    pub field_position: Option<u32>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPivotAreaReferences {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"reference", ty = "child")]
    pub references: Vec<CtPivotAreaReference>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPivotAreaReference {
    #[xmlserde(name = b"x", ty = "child", vec_size = "count")]
    pub xs: Vec<CtIndex>,
    #[xmlserde(name = b"field", ty = "attr")]
    pub field: Option<u32>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"selected", ty = "attr", default = "default_true")]
    pub selected: bool,
    #[xmlserde(name = b"byPosition", ty = "attr", default = "default_false")]
    pub by_position: bool,
    #[xmlserde(name = b"relative", ty = "attr", default = "default_false")]
    pub relative: bool,
    #[xmlserde(name = b"defaultSubtotal", ty = "attr", default = "default_false")]
    pub default_subtotal: bool,
    #[xmlserde(name = b"sumSubtotal", ty = "attr", default = "default_false")]
    pub sum_subtotal: bool,
    #[xmlserde(name = b"countASubtotal", ty = "attr", default = "default_false")]
    pub count_a_subtotal: bool,
    #[xmlserde(name = b"avgSubtotal", ty = "attr", default = "default_false")]
    pub avg_subtotal: bool,
    #[xmlserde(name = b"maxSubtotal", ty = "attr", default = "default_false")]
    pub max_subtotal: bool,
    #[xmlserde(name = b"minSubtotal", ty = "attr", default = "default_false")]
    pub min_subtotal: bool,
    #[xmlserde(name = b"productSubtotal", ty = "attr", default = "default_false")]
    pub product_subtotal: bool,
    #[xmlserde(name = b"countSubtotal", ty = "attr", default = "default_false")]
    pub count_subtotal: bool,
    #[xmlserde(name = b"stdDevSubtotal", ty = "attr", default = "default_false")]
    pub std_dev_subtotal: bool,
    #[xmlserde(name = b"stdDevPSubtotal", ty = "attr", default = "default_false")]
    pub std_dev_p_subtotal: bool,
    #[xmlserde(name = b"stdVarSubtotal", ty = "attr", default = "default_false")]
    pub std_var_subtotal: bool,
    #[xmlserde(name = b"stdVarPSubtotal", ty = "attr", default = "default_false")]
    pub std_var_p_subtotal: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtIndex {
    #[xmlserde(name = b"v", ty = "attr")]
    pub v: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetCalcPr {
    #[xmlserde(name = b"fullCalcOnLoad", ty = "attr", default = "default_false")]
    pub full_calc_on_load: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize, Clone)]
pub struct CtSheetFormatPr {
    #[xmlserde(name = b"baseColWidth", ty = "attr", default = "default_8_u32")]
    pub base_col_width: u32,
    #[xmlserde(name = b"defaultColWidth", ty = "attr")]
    pub default_col_width: Option<f64>,
    #[xmlserde(name = b"defaultRowHeight", ty = "attr")]
    pub default_row_height: f64,
    #[xmlserde(name = b"customHeight", ty = "attr", default = "default_false")]
    pub custom_height: bool,
    #[xmlserde(name = b"zeroHeight", ty = "attr", default = "default_false")]
    pub zero_height: bool,
    #[xmlserde(name = b"thickTop", ty = "attr", default = "default_false")]
    pub thick_top: bool,
    #[xmlserde(name = b"thickBottom", ty = "attr", default = "default_false")]
    pub thick_bottom: bool,
    #[xmlserde(name = b"outlineLevelRow", ty = "attr", default = "default_zero_u32")]
    pub outline_level_row: u32,
    #[xmlserde(name = b"outlineLevelCol", ty = "attr", default = "default_zero_u32")]
    pub outline_level_col: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCols {
    #[xmlserde(name = b"col", ty = "child")]
    pub cols: Vec<CtCol>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCol {
    #[xmlserde(name = b"min", ty = "attr")]
    pub min: u32,
    #[xmlserde(name = b"max", ty = "attr")]
    pub max: u32,
    #[xmlserde(name = b"width", ty = "attr")]
    pub width: Option<f64>,
    #[xmlserde(name = b"style", ty = "attr", default = "default_zero_u32")]
    pub style: u32,
    #[xmlserde(name = b"hidden", ty = "attr", default = "default_false")]
    pub hidden: bool,
    #[xmlserde(name = b"bestFit", ty = "attr", default = "default_false")]
    pub best_fit: bool,
    #[xmlserde(name = b"customWidth", ty = "attr", default = "default_false")]
    pub custom_width: bool,
    #[xmlserde(name = b"phonetic", ty = "attr", default = "default_false")]
    pub phonetic: bool,
    #[xmlserde(name = b"outlineLevel", ty = "attr", default = "default_zero_u32")]
    pub outline_level: u32,
    #[xmlserde(name = b"collapsed", ty = "attr", default = "default_false")]
    pub collapsed: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtControls {
    #[xmlserde(name = b"control", ty = "child")]
    pub controls: Vec<CtControl>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtControl {
    #[xmlserde(name = b"controlPr", ty = "child")]
    pub control_pr: Option<CtControlPr>,
    #[xmlserde(name = b"shapeId", ty = "attr")]
    pub shape_id: u32,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtControlPr {
    #[xmlserde(name = b"anchor", ty = "child")]
    pub anchor: CtObjectAnchor,
    #[xmlserde(name = b"locked", ty = "attr", default = "default_true")]
    pub locked: bool,
    #[xmlserde(name = b"defaultSize", ty = "attr", default = "default_true")]
    pub default_size: bool,
    #[xmlserde(name = b"print", ty = "attr", default = "default_true")]
    pub print: bool,
    #[xmlserde(name = b"disabled", ty = "attr", default = "default_false")]
    pub disabled: bool,
    #[xmlserde(name = b"recalcAlways", ty = "attr", default = "default_false")]
    pub recalc_always: bool,
    #[xmlserde(name = b"uiObject", ty = "attr", default = "default_false")]
    pub ui_object: bool,
    #[xmlserde(name = b"autoFill", ty = "attr", default = "default_true")]
    pub auto_fill: bool,
    #[xmlserde(name = b"autoLine", ty = "attr", default = "default_true")]
    pub auto_line: bool,
    #[xmlserde(name = b"autoPict", ty = "attr", default = "default_true")]
    pub auto_pict: bool,
    #[xmlserde(name = b"macro", ty = "attr")]
    pub macr: Option<StFormula>,
    #[xmlserde(name = b"altText", ty = "attr")]
    pub alt_text: Option<String>,
    #[xmlserde(name = b"linkedCell", ty = "attr")]
    pub linked_cell: Option<String>,
    #[xmlserde(name = b"listFillRange", ty = "attr")]
    pub list_fill_range: Option<String>,
    #[xmlserde(name = b"cf", ty = "attr", default = "default_string_pict")]
    pub cf: String,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtIgnoredError {
    #[xmlserde(name = b"sqref", ty = "attr")]
    pub sqref: String, // todo
    #[xmlserde(name = b"evalError", ty = "attr", default = "default_false")]
    pub eval_error: bool,
    #[xmlserde(name = b"twoDigitTextYear", ty = "attr", default = "default_false")]
    pub two_digit_text_year: bool,
    #[xmlserde(name = b"numberStoredAsText", ty = "attr", default = "default_false")]
    pub number_stored_as_text: bool,
    #[xmlserde(name = b"formula", ty = "attr", default = "default_false")]
    pub formula: bool,
    #[xmlserde(name = b"formulaRange", ty = "attr", default = "default_false")]
    pub formula_range: bool,
    #[xmlserde(name = b"unlockedFormula", ty = "attr", default = "default_false")]
    pub unlocked_formula: bool,
    #[xmlserde(name = b"emptyCellReference", ty = "attr", default = "default_false")]
    pub empty_cell_reference: bool,
    #[xmlserde(name = b"listDataValidation", ty = "attr", default = "default_false")]
    pub list_data_validation: bool,
    #[xmlserde(name = b"calculatedColumn", ty = "attr", default = "default_false")]
    pub calculated_column: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtIgnoredErrors {
    #[xmlserde(name = b"ignoredError", ty = "child")]
    pub ignored_errors: Vec<CtIgnoredError>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCellWatches {
    #[xmlserde(name = b"cellWatch", ty = "child")]
    pub cell_watches: Vec<CtCellWatch>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCellWatch {
    #[xmlserde(name = b"r", ty = "attr")]
    pub r: StCellRef,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPageBreak {
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"manualBreakCount", ty = "attr", default = "default_zero_u32")]
    pub manual_break_count: u32,
    #[xmlserde(name = b"brk", ty = "child")]
    pub breaks: Vec<CtBreak>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtBreak {
    #[xmlserde(name = b"id", ty = "attr", default = "default_zero_u32")]
    pub id: u32,
    #[xmlserde(name = b"min", ty = "attr", default = "default_zero_u32")]
    pub min: u32,
    #[xmlserde(name = b"max", ty = "attr", default = "default_zero_u32")]
    pub max: u32,
    #[xmlserde(name = b"man", ty = "attr", default = "default_false")]
    pub man: bool,
    #[xmlserde(name = b"pt", ty = "attr", default = "default_false")]
    pub pt: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTableParts {
    #[xmlserde(name = b"tablePart", ty = "child", vec_size = "count")]
    pub parts: Vec<CtTablePart>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTablePart {
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSmartTags {
    #[xmlserde(name = b"cellSmartTags", ty = "child")]
    pub tags: Vec<CtCellSmartTags>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCellSmartTags {
    #[xmlserde(name = b"r", ty = "attr")]
    pub r: StCellRef,
    #[xmlserde(name = b"cellSmartTag", ty = "child")]
    pub tags: Vec<CtCellSmartTag>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCellSmartTag {
    #[xmlserde(name = b"cellSmartTagPr", ty = "child")]
    pub cell_smart_tag_pr: Vec<CtCellSmartTagPr>,
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: u32,
    #[xmlserde(name = b"deleted", ty = "attr", default = "default_false")]
    pub deleted: bool,
    #[xmlserde(name = b"xmlBased", ty = "attr", default = "default_false")]
    pub xml_based: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCellSmartTagPr {
    #[xmlserde(name = b"key", ty = "attr")]
    pub key: String,
    #[xmlserde(name = b"value", ty = "attr")]
    pub value: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDrawing {
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDrawingHF {
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: String,
    #[xmlserde(name = b"lho", ty = "attr")]
    pub lho: Option<u32>,
    #[xmlserde(name = b"lhe", ty = "attr")]
    pub lhe: Option<u32>,
    #[xmlserde(name = b"lhf", ty = "attr")]
    pub lhf: Option<u32>,
    #[xmlserde(name = b"cho", ty = "attr")]
    pub cho: Option<u32>,
    #[xmlserde(name = b"che", ty = "attr")]
    pub che: Option<u32>,
    #[xmlserde(name = b"chf", ty = "attr")]
    pub chf: Option<u32>,
    #[xmlserde(name = b"rho", ty = "attr")]
    pub rho: Option<u32>,
    #[xmlserde(name = b"rhe", ty = "attr")]
    pub rhe: Option<u32>,
    #[xmlserde(name = b"rhf", ty = "attr")]
    pub rhf: Option<u32>,
    #[xmlserde(name = b"lfo", ty = "attr")]
    pub lfo: Option<u32>,
    #[xmlserde(name = b"lfe", ty = "attr")]
    pub lfe: Option<u32>,
    #[xmlserde(name = b"lff", ty = "attr")]
    pub lff: Option<u32>,
    #[xmlserde(name = b"cfo", ty = "attr")]
    pub cfo: Option<u32>,
    #[xmlserde(name = b"cfe", ty = "attr")]
    pub cfe: Option<u32>,
    #[xmlserde(name = b"cff", ty = "attr")]
    pub cff: Option<u32>,
    #[xmlserde(name = b"rfo", ty = "attr")]
    pub rfo: Option<u32>,
    #[xmlserde(name = b"rfe", ty = "attr")]
    pub rfe: Option<u32>,
    #[xmlserde(name = b"rff", ty = "attr")]
    pub rff: Option<u32>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetProtection {
    #[xmlserde(name = b"algorithmName", ty = "attr")]
    pub algorithm_name: Option<String>,
    #[xmlserde(name = b"hashValue", ty = "attr")]
    pub hash_value: Option<String>,
    #[xmlserde(name = b"saltValue", ty = "attr")]
    pub salt_value: Option<String>,
    #[xmlserde(name = b"spinValue", ty = "attr")]
    pub spin_value: Option<String>,
    #[xmlserde(name = b"sheet", ty = "attr", default = "default_false")]
    pub sheet: bool,
    #[xmlserde(name = b"objects", ty = "attr", default = "default_false")]
    pub objects: bool,
    #[xmlserde(name = b"scenarios", ty = "attr", default = "default_false")]
    pub scenarios: bool,
    #[xmlserde(name = b"formatCells", ty = "attr", default = "default_true")]
    pub format_cells: bool,
    #[xmlserde(name = b"formatColumns", ty = "attr", default = "default_true")]
    pub format_columns: bool,
    #[xmlserde(name = b"formatRows", ty = "attr", default = "default_true")]
    pub format_rows: bool,
    #[xmlserde(name = b"insertColumns", ty = "attr", default = "default_true")]
    pub insert_columns: bool,
    #[xmlserde(name = b"insertRows", ty = "attr", default = "default_true")]
    pub insert_rows: bool,
    #[xmlserde(name = b"insertHyperlinks", ty = "attr", default = "default_true")]
    pub insert_hyperlinks: bool,
    #[xmlserde(name = b"deleteColumns", ty = "attr", default = "default_true")]
    pub delete_columns: bool,
    #[xmlserde(name = b"deleteRows", ty = "attr", default = "default_true")]
    pub delete_rows: bool,
    #[xmlserde(name = b"selectLockedCells", ty = "attr", default = "default_true")]
    pub select_locked_cells: bool,
    #[xmlserde(name = b"sort", ty = "attr", default = "default_true")]
    pub sort: bool,
    #[xmlserde(name = b"autoFilter", ty = "attr", default = "default_true")]
    pub auto_filter: bool,
    #[xmlserde(name = b"pivotTables", ty = "attr", default = "default_true")]
    pub pivot_tables: bool,
    #[xmlserde(name = b"selectUnlockedCells", ty = "attr", default = "default_true")]
    pub select_unlocked_cells: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtProtectedRanges {
    #[xmlserde(name = b"protectedRange", ty = "child")]
    pub ranges: Vec<CtProtectedRange>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtProtectedRange {
    #[xmlserde(name = b"securityDescriptor", ty = "child")]
    pub desciptors: Vec<PlainTextString>,
    #[xmlserde(name = b"sqref", ty = "attr")]
    pub sqref: String, // todo
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"algorithmName", ty = "attr")]
    pub algorithm_name: Option<String>,
    #[xmlserde(name = b"hashValue", ty = "attr")]
    pub hash_value: Option<String>,
    #[xmlserde(name = b"saltValue", ty = "attr")]
    pub salt_value: Option<String>,
    #[xmlserde(name = b"spinCount", ty = "attr")]
    pub spin_count: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtMergeCells {
    #[xmlserde(name = b"mergeCell", ty = "child", vec_size = "count")]
    pub merge_cells: Vec<CtMergeCell>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtMergeCell {
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: StRef,
}

// #[derive(Debug, XmlSerialize, XmlDeserialize)]
// pub struct CtOleObjects {
//     #[xmlserde(name = b"oleObject", ty = "child")]
//     pub objects: Vec<CtOleObject>,
// }

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtOleObject {
    #[xmlserde(name = b"objectPr", ty = "child")]
    pub object_pr: Option<CtObjectPr>,
    #[xmlserde(name = b"progId", ty = "attr")]
    pub prog_id: Option<String>,
    #[xmlserde(name = b"dvAspect", ty = "attr", default = "st_dv_aspect_content")]
    pub dv_aspect: StDvAspect,
    #[xmlserde(name = b"link", ty = "attr")]
    pub link: Option<String>,
    #[xmlserde(name = b"oleUpdate", ty = "attr")]
    pub ole_update: Option<StOleUpdate>,
    #[xmlserde(name = b"autoLoad", ty = "attr", default = "default_false")]
    pub auto_load: bool,
    #[xmlserde(name = b"shapeId", ty = "attr")]
    pub shape_id: u32,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtObjectPr {
    #[xmlserde(name = b"anchor", ty = "child")]
    pub anchor: CtObjectAnchor,
    #[xmlserde(name = b"locked", ty = "attr", default = "default_true")]
    pub locked: bool,
    #[xmlserde(name = b"defaultSize", ty = "attr", default = "default_true")]
    pub default_size: bool,
    #[xmlserde(name = b"print", ty = "attr", default = "default_true")]
    pub print: bool,
    #[xmlserde(name = b"disabled", ty = "attr", default = "default_false")]
    pub disabled: bool,
    #[xmlserde(name = b"ui_object", ty = "attr", default = "default_false")]
    pub ui_object: bool,
    #[xmlserde(name = b"autoFill", ty = "attr", default = "default_true")]
    pub auto_fill: bool,
    #[xmlserde(name = b"autoLine", ty = "attr", default = "default_true")]
    pub auto_line: bool,
    #[xmlserde(name = b"autoPict", ty = "attr", default = "default_true")]
    pub auto_pict: bool,
    #[xmlserde(name = b"macro", ty = "attr")]
    pub macr: Option<StFormula>,
    #[xmlserde(name = b"altText", ty = "attr")]
    pub alt_text: Option<String>,
    #[xmlserde(name = b"dde", ty = "attr", default = "default_false")]
    pub dde: bool,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPrintOptions {
    #[xmlserde(name = b"horizontalCentered", ty = "attr", default = "default_false")]
    pub horizontal_centered: bool,
    #[xmlserde(name = b"verticalCentered", ty = "attr", default = "default_false")]
    pub vertical_centered: bool,
    #[xmlserde(name = b"headings", ty = "attr", default = "default_false")]
    pub headings: bool,
    #[xmlserde(name = b"gridLines", ty = "attr", default = "default_false")]
    pub grid_lines: bool,
    #[xmlserde(name = b"gridLinesSet", ty = "attr", default = "default_true")]
    pub grid_lines_set: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPageSetup {
    #[xmlserde(name = b"paperSize", ty = "attr", default = "default_one_u32")]
    pub paper_size: u32,
    #[xmlserde(name = b"paperHeight", ty = "attr")]
    pub paper_height: Option<StPositiveUniversalMeasure>,
    #[xmlserde(name = b"paperWidth", ty = "attr")]
    pub paper_width: Option<StPositiveUniversalMeasure>,
    #[xmlserde(name = b"scale", ty = "attr", default = "default_100_u32")]
    pub scale: u32,
    #[xmlserde(name = b"firstPageNumber", ty = "attr", default = "default_one_u32")]
    pub first_page_number: u32,
    #[xmlserde(name = b"fitToWidth", ty = "attr", default = "default_one_u32")]
    pub fit_to_width: u32,
    #[xmlserde(name = b"fitToHeight", ty = "attr", default = "default_one_u32")]
    pub fit_to_height: u32,
    #[xmlserde(
        name = b"pageOrder",
        ty = "attr",
        default = "st_page_order_down_then_over"
    )]
    pub page_order: StPageOrder,
    #[xmlserde(name = b"orientation", ty = "attr", default = "st_orientation_default")]
    pub orientation: StOrientation,
    #[xmlserde(name = b"usePrinterDefaults", ty = "attr", default = "default_true")]
    pub use_printer_defaults: bool,
    #[xmlserde(name = b"blackAndWhite", ty = "attr", default = "default_false")]
    pub black_and_white: bool,
    #[xmlserde(name = b"draft", ty = "attr", default = "default_false")]
    pub draft: bool,
    #[xmlserde(name = b"cellComments", ty = "attr", default = "st_cell_comments_none")]
    pub cell_comments: StCellComments,
    #[xmlserde(name = b"useFirstPageNumber", ty = "attr", default = "default_false")]
    pub use_first_page_number: bool,
    #[xmlserde(name = b"errors", ty = "attr", default = "st_print_error_displayed")]
    pub errors: StPrintError,
    #[xmlserde(name = b"horizontalDpi", ty = "attr", default = "default_600_u32")]
    pub horizontal_dpi: u32,
    #[xmlserde(name = b"verticalDpi", ty = "attr", default = "default_600_u32")]
    pub vertical_dpi: u32,
    #[xmlserde(name = b"copies", ty = "attr", default = "default_one_u32")]
    pub copies: u32,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtWebPublishItems {
    #[xmlserde(name = b"webPublishItem", ty = "child", vec_size = "count")]
    pub items: Vec<CtWebPublishItem>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtWebPublishItem {
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: u32,
    #[xmlserde(name = b"divId", ty = "attr")]
    pub div_id: String,
    #[xmlserde(name = b"sourceType", ty = "attr")]
    pub source_type: StWebSourceType,
    #[xmlserde(name = b"sourceRef", ty = "attr")]
    pub source_ref: Option<StRef>,
    #[xmlserde(name = b"sourceObject", ty = "attr")]
    pub source_object: Option<String>,
    #[xmlserde(name = b"destinationFile", ty = "attr")]
    pub destination_file: String,
    #[xmlserde(name = b"title", ty = "attr")]
    pub title: Option<String>,
    #[xmlserde(name = b"autoRepublish", ty = "attr", default = "default_true")]
    pub auto_republish: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSortState {
    #[xmlserde(name = b"sortCondition", ty = "child")]
    pub condictions: Vec<CtSortCondition>,
    #[xmlserde(name = b"columnSort", ty = "attr", default = "default_false")]
    pub column_sort: bool,
    #[xmlserde(name = b"caseSentitive", ty = "attr", default = "default_false")]
    pub case_sensitive: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSortCondition {
    #[xmlserde(name = b"descending", ty = "attr", default = "default_false")]
    pub descending: bool,
    #[xmlserde(name = b"sortBy", ty = "attr", default = "st_sort_by_value")]
    pub sort_by: StSortBy,
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: StRef,
    #[xmlserde(name = b"customList", ty = "attr")]
    pub custom_list: Option<String>,
    #[xmlserde(name = b"dxfId", ty = "attr")]
    pub dxf_id: Option<StDxfId>,
    #[xmlserde(name = b"iconSet", ty = "attr", default = "st_icon_set_type_3arrows")]
    pub icon_set: StIconSetType,
    #[xmlserde(name = b"iconId", ty = "attr")]
    pub icon_id: Option<u32>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtPageMargins {
    #[xmlserde(name = b"left", ty = "attr")]
    pub left: f64,
    #[xmlserde(name = b"right", ty = "attr")]
    pub right: f64,
    #[xmlserde(name = b"top", ty = "attr")]
    pub top: f64,
    #[xmlserde(name = b"bottom", ty = "attr")]
    pub bottom: f64,
    #[xmlserde(name = b"header", ty = "attr")]
    pub header: f64,
    #[xmlserde(name = b"footer", ty = "attr")]
    pub footer: f64,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtAutoFilter {
    #[xmlserde(name = b"filterColumn", ty = "child")]
    pub filter_columns: Vec<CtFilterColumn>,
    #[xmlserde(name = b"sortState", ty = "child")]
    pub sort_state: Option<CtSortState>,
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: StRef,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFilterColumn {
    // Choice start todo!
    #[xmlserde(name = b"filters", ty = "child")]
    pub filters: Option<CtFilters>,
    #[xmlserde(name = b"top10", ty = "child")]
    pub top10: Option<CtTop10>,
    #[xmlserde(name = b"customFilters", ty = "child")]
    pub custom_filters: Option<CtCustomFilters>,
    #[xmlserde(name = b"dynamicFilter", ty = "child")]
    pub dynamic_filter: Option<CtDynamicFilter>,
    #[xmlserde(name = b"colorFilter", ty = "child")]
    pub color_filter: Option<CtColorFilter>,
    #[xmlserde(name = b"iconFilter", ty = "child")]
    pub icon_filter: Option<CtIconFilter>,
    // Choice end
    #[xmlserde(name = b"colId", ty = "attr")]
    pub col_id: u32,
    #[xmlserde(name = b"hiddenButton", ty = "attr", default = "default_false")]
    pub hidden_button: bool,
    #[xmlserde(name = b"showButton", ty = "attr", default = "default_true")]
    pub show_button: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFilters {
    #[xmlserde(name = b"filter", ty = "child")]
    pub filters: Vec<CtFilter>,
    #[xmlserde(name = b"dateGroupItem", ty = "child")]
    pub date_group_item: Vec<CtDateGroupItem>,
    #[xmlserde(name = b"blank", ty = "attr", default = "default_false")]
    pub blank: bool,
    #[xmlserde(name = b"calendarType", ty = "attr", default = "st_calendar_type_none")]
    pub calendar_type: StCalendarType,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDateGroupItem {
    #[xmlserde(name = b"year", ty = "attr")]
    pub year: u16,
    #[xmlserde(name = b"month", ty = "attr")]
    pub month: u8,
    #[xmlserde(name = b"day", ty = "attr")]
    pub day: u8,
    #[xmlserde(name = b"hour", ty = "attr")]
    pub hour: u8,
    #[xmlserde(name = b"minute", ty = "attr")]
    pub minute: u8,
    #[xmlserde(name = b"second", ty = "attr")]
    pub second: u8,
    #[xmlserde(name = b"dateTimeGrouping", ty = "attr")]
    pub date_time_grouping: StDateTimeGrouping,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFilter {
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCustomFilters {
    #[xmlserde(name = b"customFilter", ty = "child")]
    pub filters: Vec<CtCustomFilter>,
    #[xmlserde(name = b"and", ty = "attr", default = "default_false")]
    pub and: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCustomFilter {
    #[xmlserde(name = b"operator", ty = "attr", default = "st_filter_operator_equal")]
    pub operator: StFilterOperator,
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtTop10 {
    #[xmlserde(name = b"top", ty = "attr", default = "default_true")]
    pub top: bool,
    #[xmlserde(name = b"percent", ty = "attr", default = "default_false")]
    pub percent: bool,
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: f64,
    #[xmlserde(name = b"filterVal", ty = "attr")]
    pub filter_val: Option<f64>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtColorFilter {
    #[xmlserde(name = b"dxfId", ty = "attr")]
    pub dxf_id: Option<StDxfId>,
    #[xmlserde(name = b"cellColor", ty = "attr", default = "default_true")]
    pub cell_color: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtIconFilter {
    #[xmlserde(name = b"iconSet", ty = "attr")]
    pub icon_set: StIconSetType,
    #[xmlserde(name = b"iconId", ty = "attr")]
    pub icon_id: Option<u32>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDynamicFilter {
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: StDynamicFilterType,
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: Option<f64>,
    #[xmlserde(name = b"valIso", ty = "attr")]
    pub val_iso: Option<String>,
    #[xmlserde(name = b"maxValIso", ty = "attr")]
    pub max_val_iso: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtHyperlinks {
    #[xmlserde(name = b"hyperlink", ty = "child")]
    pub links: Vec<CtHyperlink>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtHyperlink {
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: StRef,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: Option<String>,
    #[xmlserde(name = b"location", ty = "attr")]
    pub location: Option<String>,
    #[xmlserde(name = b"tooltip", ty = "attr")]
    pub tooltip: Option<String>,
    #[xmlserde(name = b"display", ty = "attr")]
    pub display: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDataConsolidate {
    #[xmlserde(name = b"dataRefs", ty = "child")]
    pub data_refs: Option<CtDataRefs>,
    #[xmlserde(
        name = b"function",
        ty = "attr",
        default = "st_data_consolidate_function_sum"
    )]
    pub function: StDataConsolidateFunction,
    #[xmlserde(name = b"startLabels", ty = "attr", default = "default_false")]
    pub start_labels: bool,
    #[xmlserde(name = b"topLabels", ty = "attr", default = "default_false")]
    pub top_labels: bool,
    #[xmlserde(name = b"link", ty = "attr", default = "default_false")]
    pub link: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDataRefs {
    #[xmlserde(name = b"dataRef", ty = "child", vec_size = "count")]
    pub data_ref: Vec<CtDataRef>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDataRef {
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: Option<StRef>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: Option<String>,
    #[xmlserde(name = b"sheet", ty = "attr")]
    pub sheet: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtScenarios {
    #[xmlserde(name = b"scenario", ty = "child")]
    pub scearios: Vec<CtScenario>,
    #[xmlserde(name = b"current", ty = "attr")]
    pub current: Option<u32>,
    #[xmlserde(name = b"show", ty = "attr")]
    pub show: Option<u32>,
    #[xmlserde(name = b"sqref", ty = "attr")]
    pub sqref: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtScenario {
    #[xmlserde(name = b"CtInputCells", ty = "child")]
    pub input_cells: Vec<CtInputCells>,
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"locked", ty = "attr", default = "default_false")]
    pub locked: bool,
    #[xmlserde(name = b"hidden", ty = "attr", default = "default_false")]
    pub hidden: bool,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
    #[xmlserde(name = b"user", ty = "attr")]
    pub user: Option<String>,
    #[xmlserde(name = b"comment", ty = "attr")]
    pub comment: Option<String>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtInputCells {
    #[xmlserde(name = b"r", ty = "attr")]
    pub r: StCellRef,
    #[xmlserde(name = b"deleted", ty = "attr", default = "default_false")]
    pub deleted: bool,
    #[xmlserde(name = b"undone", ty = "attr", default = "default_false")]
    pub undone: bool,
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: String,
    #[xmlserde(name = b"numFmtId", ty = "attr")]
    pub num_fmt_id: Option<StNumFmtId>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtHeaderFooter {
    #[xmlserde(name = b"oddHeader", ty = "child")]
    pub odd_header: Option<PlainTextString>,
    #[xmlserde(name = b"oddFooter", ty = "child")]
    pub odd_footer: Option<PlainTextString>,
    #[xmlserde(name = b"evenHeader", ty = "child")]
    pub even_header: Option<PlainTextString>,
    #[xmlserde(name = b"evenFooter", ty = "child")]
    pub even_footer: Option<PlainTextString>,
    #[xmlserde(name = b"firstHeader", ty = "child")]
    pub first_header: Option<PlainTextString>,
    #[xmlserde(name = b"firstFooter", ty = "child")]
    pub first_footer: Option<PlainTextString>,
    #[xmlserde(name = b"differentOddEven", ty = "attr", default = "default_false")]
    pub different_odd_even: bool,
    #[xmlserde(name = b"differentFirst", ty = "attr", default = "default_false")]
    pub different_first: bool,
    #[xmlserde(name = b"scaleWithDoc", ty = "attr", default = "default_true")]
    pub scale_with_doc: bool,
    #[xmlserde(name = b"alignWithMargins", ty = "attr", default = "default_true")]
    pub align_with_margins: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDataValidations {
    #[xmlserde(name = b"dataValidation", ty = "child", vec_size = "count")]
    pub data_validations: Vec<CtDataValidation>,
    #[xmlserde(name = b"disablePrompts", ty = "attr", default = "default_false")]
    pub disable_prompts: bool,
    #[xmlserde(name = b"xWindow", ty = "attr")]
    pub x_window: Option<u32>,
    #[xmlserde(name = b"yWindow", ty = "attr")]
    pub y_window: Option<u32>,
    #[xmlserde(name = b"count", ty = "attr", default = "default_zero_u32")]
    pub count: u32,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDataValidation {
    #[xmlserde(name = b"formula1", ty = "child")]
    pub formula1: Option<PlainTextString>,
    #[xmlserde(name = b"formula2", ty = "child")]
    pub formula2: Option<PlainTextString>,
    #[xmlserde(name = b"type", ty = "attr", default = "st_data_validation_type_none")]
    pub ty: StDataValidationType,
    #[xmlserde(
        name = b"errorStyle",
        ty = "attr",
        default = "st_data_validation_error_style_stop"
    )]
    pub error_style: StDataValidationErrorStyle,
    #[xmlserde(
        name = b"imeMode",
        ty = "attr",
        default = "st_data_validation_ime_mode_no_control"
    )]
    pub ime_mode: StDataValidationImeMode,
    #[xmlserde(
        name = b"operator",
        ty = "attr",
        default = "st_data_validation_operator_between"
    )]
    pub operator: StDataValidationOperator,
    #[xmlserde(name = b"blank", ty = "attr", default = "default_false")]
    pub blank: bool,
    #[xmlserde(name = b"showDropDown", ty = "attr", default = "default_false")]
    pub show_drop_down: bool,
    #[xmlserde(name = b"showInputMessage", ty = "attr", default = "default_false")]
    pub show_input_message: bool,
    #[xmlserde(name = b"showErrorMessage", ty = "attr", default = "default_false")]
    pub show_error_message: bool,
    #[xmlserde(name = b"promptTitle", ty = "attr")]
    pub prompt_title: Option<String>,
    #[xmlserde(name = b"prompt", ty = "attr")]
    pub prompt: Option<String>,
    #[xmlserde(name = b"sqref", ty = "attr")]
    pub sqref: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtConditionalFormatting {
    #[xmlserde(name = b"cfRule", ty = "child")]
    pub cf_rules: Vec<CtCfRule>,
    #[xmlserde(name = b"pivot", ty = "attr", default = "default_false")]
    pub pviot: bool,
    #[xmlserde(name = b"sqref", ty = "attr")]
    pub sqref: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCfRule {
    #[xmlserde(name = b"formula", ty = "child")]
    pub formulas: Vec<PlainTextString>,
    #[xmlserde(name = b"colorScale", ty = "child")]
    pub color_scale: Option<CtColorScale>,
    #[xmlserde(name = b"dataBar", ty = "child")]
    pub data_bar: Option<CtDataBar>,
    #[xmlserde(name = b"iconSet", ty = "child")]
    pub icon_set: Option<CtIconSet>,
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: StCfType,
    #[xmlserde(name = b"dxfId", ty = "attr")]
    pub dxf_id: Option<StDxfId>,
    #[xmlserde(name = b"priority", ty = "attr")]
    pub priority: i32,
    #[xmlserde(name = b"stopIfTrue", ty = "attr", default = "default_false")]
    pub stop_if_true: bool,
    #[xmlserde(name = b"aboveAverage", ty = "attr", default = "default_true")]
    pub above_average: bool,
    #[xmlserde(name = b"percent", ty = "attr", default = "default_false")]
    pub percent: bool,
    #[xmlserde(name = b"bottom", ty = "attr", default = "default_false")]
    pub bottom: bool,
    #[xmlserde(name = b"operator", ty = "attr")]
    pub operator: Option<StConditionalFormattingOperator>,
    #[xmlserde(name = b"text", ty = "attr")]
    pub text: Option<String>,
    #[xmlserde(name = b"timePeriod", ty = "attr")]
    pub time_period: Option<StTimePeriod>,
    #[xmlserde(name = b"rank", ty = "attr")]
    pub rank: Option<u32>,
    #[xmlserde(name = b"stdDev", ty = "attr")]
    pub std_dev: Option<i32>,
    #[xmlserde(name = b"equalAverage", ty = "attr", default = "default_false")]
    pub equal_average: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtDataBar {
    #[xmlserde(name = b"cfvo", ty = "child")]
    pub cfvos: Vec<CtCfvo>, // must has 2 elements
    #[xmlserde(name = b"color", ty = "child")]
    pub color: CtColor,
    #[xmlserde(name = b"minLength", ty = "attr", default = "default_10_u32")]
    pub min_length: u32,
    #[xmlserde(name = b"maxLength", ty = "attr", default = "default_90_u32")]
    pub max_length: u32,
    #[xmlserde(name = b"showValue", ty = "attr", default = "default_true")]
    pub show_value: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtIconSet {
    #[xmlserde(name = b"cfvo", ty = "child")]
    pub cfvos: Vec<CtCfvo>, // at least 2 elements
    #[xmlserde(
        name = b"iconSet",
        ty = "attr",
        default = "st_icon_set_type_3_traffic_lights1"
    )]
    pub icon_set: StIconSetType,
    #[xmlserde(name = b"showValue", ty = "attr", default = "default_true")]
    pub show_value: bool,
    #[xmlserde(name = b"percent", ty = "attr", default = "default_true")]
    pub percent: bool,
    #[xmlserde(name = b"reverse", ty = "attr", default = "default_false")]
    pub reverse: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCfvo {
    #[xmlserde(name = b"type", ty = "attr")]
    pub ty: StCfvoType,
    #[xmlserde(name = b"val", ty = "attr")]
    pub val: Option<String>,
    #[xmlserde(name = b"gte", ty = "attr", default = "default_true")]
    pub gte: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtColorScale {
    #[xmlserde(name = b"cfvo", ty = "child")]
    pub cfvos: Vec<CtCfvo>, // at least 2
    #[xmlserde(name = b"color", ty = "child")]
    pub colors: Vec<CtColor>, // at least 2
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCustomProperties {
    #[xmlserde(name = b"customPr", ty = "child")]
    pub custom_prs: Vec<CtCustomProperty>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCustomProperty {
    #[xmlserde(name = b"name", ty = "attr")]
    pub name: String,
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCustomSheetViews {
    #[xmlserde(name = b"custom_sheet_view", ty = "child")]
    pub views: Vec<CtCustomSheetView>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCustomSheetView {
    #[xmlserde(name = b"pane", ty = "child")]
    pub pane: Option<CtPane>,
    #[xmlserde(name = b"selection", ty = "child")]
    pub selection: Option<CtSelection>,
    #[xmlserde(name = b"rowBreaks", ty = "child")]
    pub row_breaks: Option<CtPageBreak>,
    #[xmlserde(name = b"colBreaks", ty = "child")]
    pub col_breaks: Option<CtPageBreak>,
    #[xmlserde(name = b"pageMargins", ty = "child")]
    pub page_margins: Option<CtPageMargins>,
    #[xmlserde(name = b"printOptions", ty = "child")]
    pub print_options: Option<CtPrintOptions>,
    #[xmlserde(name = b"pageSetup", ty = "child")]
    pub page_setup: Option<CtPageSetup>,
    #[xmlserde(name = b"headerFooter", ty = "child")]
    pub header_footer: Option<CtHeaderFooter>,
    #[xmlserde(name = b"autoFilter", ty = "child")]
    pub auto_filter: Option<CtAutoFilter>,
    #[xmlserde(name = b"guid", ty = "attr")]
    pub guid: String,
    #[xmlserde(name = b"scale", ty = "attr", default = "default_100_u32")]
    pub scale: u32,
    #[xmlserde(name = b"colorId", ty = "attr", default = "default_color_id")]
    pub color_id: u32,
    #[xmlserde(name = b"showPageBreaks", ty = "attr", default = "default_false")]
    pub show_page_breaks: bool,
    #[xmlserde(name = b"showFormulas", ty = "attr", default = "default_false")]
    pub show_formulas: bool,
    #[xmlserde(name = b"showGridLines", ty = "attr", default = "default_true")]
    pub show_grid_lines: bool,
    #[xmlserde(name = b"showRowCol", ty = "attr", default = "default_true")]
    pub show_row_col: bool,
    #[xmlserde(name = b"outlineSymbols", ty = "attr", default = "default_true")]
    pub outline_symbols: bool,
    #[xmlserde(name = b"", ty = "attr", default = "default_true")]
    pub zero_values: bool,
    #[xmlserde(name = b"fitToPage", ty = "attr", default = "default_false")]
    pub fit_to_page: bool,
    #[xmlserde(name = b"printArea", ty = "attr", default = "default_false")]
    pub print_area: bool,
    #[xmlserde(name = b"filter", ty = "attr", default = "default_false")]
    pub filter: bool,
    #[xmlserde(name = b"showAutoFilter", ty = "attr", default = "default_false")]
    pub show_auto_filter: bool,
    #[xmlserde(name = b"hiddenRows", ty = "attr", default = "default_false")]
    pub hidden_rows: bool,
    #[xmlserde(name = b"hiddenColumns", ty = "attr", default = "default_false")]
    pub hidden_columns: bool,
    #[xmlserde(name = b"state", ty = "attr", default = "st_sheet_state_visible")]
    pub state: StSheetState,
    #[xmlserde(name = b"filterUnique", ty = "attr", default = "default_false")]
    pub filter_unique: bool,
    #[xmlserde(name = b"view", ty = "attr", default = "st_sheet_view_type_normal")]
    pub view: StSheetViewType,
    #[xmlserde(name = b"showRuler", ty = "attr", default = "default_true")]
    pub show_ruler: bool,
    #[xmlserde(name = b"topLeftCell", ty = "attr")]
    pub top_left_cell: Option<StCellRef>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetBackgroundPicture {
    #[xmlserde(name = b"r:id", ty = "attr")]
    pub id: String,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtSheetData {
    #[xmlserde(name = b"row", ty = "child")]
    pub rows: Vec<CtRow>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtRow {
    #[xmlserde(name = b"c", ty = "child")]
    pub cells: Vec<CtCell>,
    #[xmlserde(name = b"r", ty = "attr")]
    pub r: Option<u32>,
    #[xmlserde(name = b"spans", ty = "attr")]
    pub spans: Option<String>, // StCellSpans
    #[xmlserde(name = b"s", ty = "attr", default = "default_zero_u32")]
    pub s: u32,
    #[xmlserde(name = b"customFormat", ty = "attr", default = "default_false")]
    pub custom_format: bool,
    #[xmlserde(name = b"ht", ty = "attr")]
    pub ht: Option<f64>,
    #[xmlserde(name = b"hidden", ty = "attr", default = "default_false")]
    pub hidden: bool,
    #[xmlserde(name = b"customHeight", ty = "attr", default = "default_false")]
    pub custom_height: bool,
    #[xmlserde(name = b"outlineLevel", ty = "attr", default = "default_zero_u8")]
    pub outline_level: u8,
    #[xmlserde(name = b"collapsed", ty = "attr", default = "default_false")]
    pub collapsed: bool,
    #[xmlserde(name = b"thickTop", ty = "attr", default = "default_false")]
    pub thick_top: bool,
    #[xmlserde(name = b"thickBot", ty = "attr", default = "default_false")]
    pub thick_bot: bool,
    #[xmlserde(name = b"ph", ty = "attr", default = "default_false")]
    pub ph: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtCell {
    #[xmlserde(name = b"f", ty = "child")]
    pub f: Option<CtFormula>,
    #[xmlserde(name = b"v", ty = "child")]
    pub v: Option<PlainTextString>,
    #[xmlserde(name = b"is", ty = "child")]
    pub is: Option<CtRst>,
    #[xmlserde(name = b"r", ty = "attr")]
    pub r: Option<StCellRef>,
    #[xmlserde(name = b"s", ty = "attr", default = "default_zero_u32")]
    pub s: u32,
    #[xmlserde(name = b"t", ty = "attr", default = "st_cell_type_n")]
    pub t: StCellType,
    #[xmlserde(name = b"cm", ty = "attr", default = "default_zero_u32")]
    pub cm: u32,
    #[xmlserde(name = b"vm", ty = "attr", default = "default_zero_u32")]
    pub vm: u32,
    #[xmlserde(name = b"ph", ty = "attr", default = "default_false")]
    pub ph: bool,
}

mod tests {
    use super::*;

    #[derive(Debug, XmlSerialize, XmlDeserialize)]
    pub struct CtFormula {
        #[xmlserde(ty = "text")]
        pub formula: Option<String>,
        #[xmlserde(name = b"t", ty = "attr", default = "st_cell_formula_type_normal")]
        pub t: StCellFormulaType,
        #[xmlserde(name = b"aca", ty = "attr", default = "default_false")]
        pub aca: bool,
        #[xmlserde(name = b"ref", ty = "attr")]
        pub reference: Option<StRef>,
        #[xmlserde(name = b"dt2D", ty = "attr", default = "default_false")]
        pub dt_2d: bool,
        #[xmlserde(name = b"del1", ty = "attr", default = "default_false")]
        pub del1: bool,
        #[xmlserde(name = b"del2", ty = "attr", default = "default_false")]
        pub del2: bool,
        #[xmlserde(name = b"r1", ty = "attr")]
        pub r1: Option<StCellRef>,
        #[xmlserde(name = b"r2", ty = "attr")]
        pub r2: Option<StCellRef>,
        #[xmlserde(name = b"ca", ty = "attr", default = "default_false")]
        pub ca: bool,
        #[xmlserde(name = b"si", ty = "attr")]
        pub si: Option<u32>,
        #[xmlserde(name = b"bx", ty = "attr", default = "default_false")]
        pub bx: bool,
    }
}
#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtFormula {
    #[xmlserde(ty = "text")]
    pub formula: Option<String>,
    #[xmlserde(name = b"t", ty = "attr", default = "st_cell_formula_type_normal")]
    pub t: StCellFormulaType,
    #[xmlserde(name = b"aca", ty = "attr", default = "default_false")]
    pub aca: bool,
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: Option<StRef>,
    #[xmlserde(name = b"dt2D", ty = "attr", default = "default_false")]
    pub dt_2d: bool,
    #[xmlserde(name = b"del1", ty = "attr", default = "default_false")]
    pub del1: bool,
    #[xmlserde(name = b"del2", ty = "attr", default = "default_false")]
    pub del2: bool,
    #[xmlserde(name = b"r1", ty = "attr")]
    pub r1: Option<StCellRef>,
    #[xmlserde(name = b"r2", ty = "attr")]
    pub r2: Option<StCellRef>,
    #[xmlserde(name = b"ca", ty = "attr", default = "default_false")]
    pub ca: bool,
    #[xmlserde(name = b"si", ty = "attr")]
    pub si: Option<u32>,
    #[xmlserde(name = b"bx", ty = "attr", default = "default_false")]
    pub bx: bool,
}
