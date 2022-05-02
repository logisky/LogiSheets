use crate::style_manager::RawStyle;
use crate::theme_manager::ThemeManager;
use logisheets_workbook::prelude::{
    CtBorder, CtBorderPr, CtCellAlignment, CtCellProtection, CtColor, CtFill, CtFont, CtFontFamily,
    CtFontName, CtFontScheme, CtUnderlineProperty, CtVerticalAlignFontProperty, StBorderStyle,
    StGradientType, StPatternType,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/style.ts")]
#[serde(rename_all = "camelCase")]
pub struct Style {
    pub font: Font,
    pub fill: Fill,
    pub border: Border,
    pub alignment: Option<CtCellAlignment>,
    pub protection: Option<CtCellProtection>,
    pub formatter: String,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export_to = "../../src/bindings/font.ts")]
#[serde(rename_all = "camelCase")]
pub struct Font {
    pub bold: bool,
    pub italic: bool,
    pub underline: Option<CtUnderlineProperty>,
    pub color: Color,
    pub sz: Option<f64>,
    pub name: Option<CtFontName>,
    pub charset: Option<i32>,
    pub family: Option<CtFontFamily>,
    pub strike: bool,
    pub outline: bool,
    pub shadow: bool,
    pub condense: bool,
    pub extend: bool,
    pub vert_align: Option<CtVerticalAlignFontProperty>,
    pub scheme: Option<CtFontScheme>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/fill.ts")]
#[serde(rename_all = "camelCase")]
pub enum Fill {
    PatternFill(PatternFill),
    GradientFill(GradientFill),
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export_to = "../../src/bindings/pattern_fill.ts")]
#[serde(rename_all = "camelCase")]
pub struct PatternFill {
    pub fg_color: Option<Color>,
    pub bg_color: Option<Color>,
    pub pattern_type: Option<StPatternType>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export_to = "../../src/bindings/gradient_fill.ts")]
#[serde(rename_all = "camelCase")]
pub struct GradientFill {
    pub stops: Vec<GradientStop>,
    pub ty: StGradientType,
    pub degree: f64,
    pub left: f64,
    pub right: f64,
    pub top: f64,
    pub bottom: f64,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/gradient_stop.ts")]
#[serde(rename_all = "camelCase")]
pub struct GradientStop {
    pub color: Color,
    pub position: f64,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export_to = "../../src/bindings/border_pr.ts")]
#[serde(rename_all = "camelCase")]
pub struct BorderPr {
    pub color: Option<Color>,
    pub style: StBorderStyle,
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/bindings/border.ts")]
#[serde(rename_all = "camelCase")]
pub struct Border {
    pub left: Option<BorderPr>,
    pub right: Option<BorderPr>,
    pub top: Option<BorderPr>,
    pub bottom: Option<BorderPr>,
    pub diagonal: Option<BorderPr>,
    pub vertical: Option<BorderPr>,
    pub horizontal: Option<BorderPr>,
    pub diagonal_up: Option<bool>,
    pub diagonal_down: Option<bool>,
    pub outline: bool,
}

#[derive(Debug, Clone, Serialize, TS, Default)]
#[ts(export, export_to = "../../src/bindings/color.ts")]
#[serde(rename_all = "camelCase")]
pub struct Color {
    pub rgb: String,
    pub tint: f64,
}

pub struct StyleConverter<'a> {
    pub theme_manager: &'a ThemeManager,
}

impl<'a> StyleConverter<'a> {
    pub fn convert_style(&self, raw_style: RawStyle) -> Style {
        Style {
            font: self.convert_font(raw_style.font),
            fill: self.convert_fill(raw_style.fill),
            border: self.convert_border(raw_style.border),
            alignment: raw_style.alignment,
            protection: raw_style.protection,
            formatter: raw_style.formatter,
        }
    }

    fn convert_font(&self, font: CtFont) -> Font {
        Font {
            bold: font.bold,
            italic: font.italic,
            underline: font.underline.clone(),
            color: font
                .color
                .map_or(Color::default(), |c| self.convert_color(c)),
            sz: font.sz.as_ref().map_or(None, |s| Some(s.val)),
            name: font.name.clone(),
            charset: font.charset.as_ref().map_or(None, |s| Some(s.val)),
            family: font.family.clone(),
            strike: font.strike,
            outline: font.outline,
            shadow: font.shadow,
            condense: font.condense,
            extend: font.extend,
            vert_align: font.vert_align.clone(),
            scheme: font.scheme.clone(),
        }
    }

    fn convert_fill(&self, fill: CtFill) -> Fill {
        match fill {
            CtFill::PatternFill(pf) => Fill::PatternFill(PatternFill {
                fg_color: pf.fg_color.map_or(None, |c| Some(self.convert_color(c))),
                bg_color: pf.bg_color.map_or(None, |c| Some(self.convert_color(c))),
                pattern_type: pf.pattern_type.clone(),
            }),
            CtFill::GradientFill(gf) => Fill::GradientFill(GradientFill {
                stops: gf
                    .stops
                    .into_iter()
                    .map(|stop| GradientStop {
                        color: self.convert_color(stop.color),
                        position: stop.position,
                    })
                    .collect(),
                ty: gf.ty.clone(),
                degree: gf.degree,
                left: gf.left,
                right: gf.right,
                top: gf.top,
                bottom: gf.bottom,
            }),
        }
    }

    fn convert_border(&self, border: CtBorder) -> Border {
        Border {
            left: border
                .left
                .map_or(None, |pr| Some(self.convert_border_pr(pr))),
            right: border
                .right
                .map_or(None, |pr| Some(self.convert_border_pr(pr))),
            top: border
                .top
                .map_or(None, |pr| Some(self.convert_border_pr(pr))),
            bottom: border
                .bottom
                .map_or(None, |pr| Some(self.convert_border_pr(pr))),
            diagonal: border
                .diagonal
                .map_or(None, |pr| Some(self.convert_border_pr(pr))),
            vertical: border
                .vertical
                .map_or(None, |pr| Some(self.convert_border_pr(pr))),
            horizontal: border
                .horizontal
                .map_or(None, |pr| Some(self.convert_border_pr(pr))),
            diagonal_up: border.diagonal_up,
            diagonal_down: border.diagonal_down,
            outline: border.outline,
        }
    }

    fn convert_border_pr(&self, border_pr: CtBorderPr) -> BorderPr {
        BorderPr {
            color: border_pr
                .color
                .map_or(None, |c| Some(self.convert_color(c))),
            style: border_pr.style.clone(),
        }
    }

    fn convert_color(&self, color: CtColor) -> Color {
        let tint = color.tint;
        let rgb = {
            if let Some(rgb) = &color.rgb {
                rgb.clone()
            } else if let Some(indexed) = color.indexed {
                match indexed {
                    0 => String::from("00000000"),
                    1 => String::from("00FFFFFF"),
                    2 => String::from("00FF0000"),
                    3 => String::from("0000FF00"),
                    4 => String::from("000000FF"),
                    5 => String::from("00FFFF00"),
                    6 => String::from("00FF00FF"),
                    7 => String::from("0000FFFF"),
                    8 => String::from("00000000"),
                    9 => String::from("00FFFFFF"),
                    10 => String::from("00FF0000"),
                    11 => String::from("0000FF00"),
                    12 => String::from("000000FF"),
                    13 => String::from("00FFFF00"),
                    14 => String::from("00FF00FF"),
                    15 => String::from("0000FFFF"),
                    16 => String::from("00800000"),
                    17 => String::from("00008000"),
                    18 => String::from("00000080"),
                    19 => String::from("00808000"),
                    20 => String::from("00800080"),
                    21 => String::from("00008080"),
                    22 => String::from("00C0C0C0"),
                    23 => String::from("00808080"),
                    24 => String::from("009999FF"),
                    25 => String::from("00993366"),
                    26 => String::from("00FFFFCC"),
                    27 => String::from("00CCFFFF"),
                    28 => String::from("00660066"),
                    29 => String::from("00FF8080"),
                    30 => String::from("000066CC"),
                    31 => String::from("00CCCCFF"),
                    32 => String::from("00000080"),
                    33 => String::from("00FF00FF"),
                    34 => String::from("00FFFF00"),
                    35 => String::from("0000FFFF"),
                    36 => String::from("00800080"),
                    37 => String::from("00800000"),
                    38 => String::from("00008080"),
                    39 => String::from("000000FF"),
                    40 => String::from("0000CCFF"),
                    41 => String::from("00CCFFFF"),
                    42 => String::from("00CCFFCC"),
                    43 => String::from("00FFFF99"),
                    44 => String::from("0099CCFF"),
                    45 => String::from("00FF99CC"),
                    46 => String::from("00CC99FF"),
                    47 => String::from("00FFCC99"),
                    48 => String::from("003366FF"),
                    49 => String::from("0033CCCC"),
                    50 => String::from("0099CC00"),
                    51 => String::from("00FFCC00"),
                    52 => String::from("00FF9900"),
                    53 => String::from("00FF6600"),
                    54 => String::from("00666699"),
                    55 => String::from("00969696"),
                    56 => String::from("00003366"),
                    57 => String::from("00339966"),
                    58 => String::from("00003300"),
                    59 => String::from("00333300"),
                    60 => String::from("00993300"),
                    61 => String::from("00993366"),
                    62 => String::from("00333399"),
                    63 => String::from("00333333"),
                    _ => String::from(""),
                }
            } else if let Some(theme) = color.theme {
                self.theme_manager.get_color(theme)
            } else {
                String::from("")
            }
        };
        Color { rgb, tint }
    }
}
