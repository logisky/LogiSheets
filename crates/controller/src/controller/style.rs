use crate::style_manager::RawStyle;
use crate::theme_manager::ThemeManager;
use logisheets_workbook::prelude::{
    CtBorder, CtBorderPr, CtCellAlignment, CtCellProtection, CtColor, CtFill, CtFont, CtFontFamily,
    CtFontName, CtFontScheme, CtUnderlineProperty, CtVerticalAlignFontProperty, StBorderStyle,
    StGradientType, StPatternType,
};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "style.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct Style {
    pub font: Font,
    pub fill: Fill,
    pub border: Border,
    pub alignment: Option<CtCellAlignment>,
    pub protection: Option<CtCellProtection>,
    pub formatter: String,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(feature = "gents", ts(file_name = "font.ts", rename_all = "camelCase"))]
#[serde(rename_all = "camelCase")]
pub struct Font {
    pub bold: bool,
    pub italic: bool,
    pub underline: Option<CtUnderlineProperty>,
    pub color: Option<Color>,
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

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(feature = "gents", ts(file_name = "fill.ts", rename_all = "camelCase"))]
#[serde(rename_all = "camelCase")]
pub enum Fill {
    PatternFill(PatternFill),
    GradientFill(GradientFill),
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "pattern_fill.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct PatternFill {
    pub fg_color: Option<Color>,
    pub bg_color: Option<Color>,
    pub pattern_type: Option<StPatternType>,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "gradient_fill.ts", rename_all = "camelCase")
)]
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

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "gradient_stop.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct GradientStop {
    pub color: Color,
    pub position: f64,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "border_pr.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct BorderPr {
    pub color: Option<Color>,
    pub style: StBorderStyle,
}

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "border.ts", rename_all = "camelCase")
)]
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

#[derive(Debug, Clone, Serialize)]
#[cfg_attr(feature = "gents", derive(gents_derives::TS))]
#[cfg_attr(
    feature = "gents",
    ts(file_name = "color.ts", rename_all = "camelCase")
)]
#[serde(rename_all = "camelCase")]
pub struct Color {
    pub red: Option<f64>,
    pub green: Option<f64>,
    pub blue: Option<f64>,
    pub alpha: Option<f64>,
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
            color: font.color.map_or(None, |c| Some(self.convert_color(c))),
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
                    0 => String::from("FF000000"),
                    1 => String::from("FFFFFFFF"),
                    2 => String::from("FFFF0000"),
                    3 => String::from("FF00FF00"),
                    4 => String::from("FF0000FF"),
                    5 => String::from("FFFFFF00"),
                    6 => String::from("FFFF00FF"),
                    7 => String::from("FF00FFFF"),
                    8 => String::from("FF000000"),
                    9 => String::from("FFFFFFFF"),
                    10 => String::from("FFFF0000"),
                    11 => String::from("FF00FF00"),
                    12 => String::from("FF0000FF"),
                    13 => String::from("FFFFFF00"),
                    14 => String::from("FFFF00FF"),
                    15 => String::from("FF00FFFF"),
                    16 => String::from("FF800000"),
                    17 => String::from("FF008000"),
                    18 => String::from("FF000080"),
                    19 => String::from("FF808000"),
                    20 => String::from("FF800080"),
                    21 => String::from("FF008080"),
                    22 => String::from("FFC0C0C0"),
                    23 => String::from("FF808080"),
                    24 => String::from("FF9999FF"),
                    25 => String::from("FF993366"),
                    26 => String::from("FFFFFFCC"),
                    27 => String::from("FFCCFFFF"),
                    28 => String::from("FF660066"),
                    29 => String::from("FFFF8080"),
                    30 => String::from("FF0066CC"),
                    31 => String::from("FFCCCCFF"),
                    32 => String::from("FF000080"),
                    33 => String::from("FFFF00FF"),
                    34 => String::from("FFFFFF00"),
                    35 => String::from("FF00FFFF"),
                    36 => String::from("FF800080"),
                    37 => String::from("FF800000"),
                    38 => String::from("FF008080"),
                    39 => String::from("FF0000FF"),
                    40 => String::from("FF00CCFF"),
                    41 => String::from("FFCCFFFF"),
                    42 => String::from("FFCCFFCC"),
                    43 => String::from("FFFFFF99"),
                    44 => String::from("FF99CCFF"),
                    45 => String::from("FFFF99CC"),
                    46 => String::from("FFCC99FF"),
                    47 => String::from("FFFFCC99"),
                    48 => String::from("FF3366FF"),
                    49 => String::from("FF33CCCC"),
                    50 => String::from("FF99CC00"),
                    51 => String::from("FFFFCC00"),
                    52 => String::from("FFFF9900"),
                    53 => String::from("FFFF6600"),
                    54 => String::from("FF666699"),
                    55 => String::from("FF969696"),
                    56 => String::from("FF003366"),
                    57 => String::from("FF339966"),
                    58 => String::from("FF003300"),
                    59 => String::from("FF333300"),
                    60 => String::from("FF993300"),
                    61 => String::from("FF993366"),
                    62 => String::from("FF333399"),
                    63 => String::from("FF333333"),
                    _ => String::from("FF000000"),
                }
            } else if let Some(theme) = color.theme {
                self.theme_manager.get_color(theme)
            } else {
                // auto is true.
                // TODO: Figure out what auto means.
                String::from("FF000000")
            }
        };
        from_hex_str(rgb, tint)
    }
}

// Convert ARGB hex str and apply the tint to it.
fn from_hex_str(argb: String, tint: f64) -> Color {
    use colorsys::{Hsl, Rgb};
    if argb.len() < 8 {
        return Color {
            red: None,
            green: None,
            blue: None,
            alpha: None,
        };
    }
    let a = u32::from_str_radix(&argb[0..2], 16).unwrap_or(0) as f64;
    let r = u32::from_str_radix(&argb[2..4], 16).unwrap_or(0) as f64;
    let g = u32::from_str_radix(&argb[4..6], 16).unwrap_or(0) as f64;
    let b = u32::from_str_radix(&argb[6..8], 16).unwrap_or(0) as f64;
    let rgb = Rgb::new(r, g, b, None);
    let mut hsl = Hsl::from(rgb);
    let lum = {
        let lum_max = 100.;
        let lum = hsl.lightness();
        if tint < 0. {
            lum * (1. + tint)
        } else if tint == 0. {
            lum
        } else {
            lum * (1. - tint) + lum_max - lum_max * (1. - tint)
        }
    };
    hsl.set_lightness(lum);
    let rgb = Rgb::from(hsl);
    Color {
        red: Some(rgb.red()),
        green: Some(rgb.green()),
        blue: Some(rgb.blue()),
        alpha: Some(a),
    }
}

#[cfg(test)]
mod tests {
    use super::from_hex_str;

    #[test]
    fn test_from_hex_str() {
        let argb = "FF2F4B1A".to_string();
        let tint = 0.1;
        let color = from_hex_str(argb, tint);
        println!("{:?}", color);
    }
}
