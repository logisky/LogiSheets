//! The caller-facing shape of a conditional-formatting rule, and its conversion
//! into OOXML.
//!
//! Deliberately flat, mirroring `CtCfRule` itself: one struct with an `ty`
//! discriminator string and optional fields, rather than a tagged union. The
//! OOXML type is already shaped that way, a flat struct crosses the TS boundary
//! as a single interface, and validation lands in one place ([`spec_to_rule`])
//! instead of being spread over a dozen variant constructors.

use gents_derives::TS;
use logisheets_workbook::prelude::{
    CtCfRule, CtCfvo, CtColor, CtColorScale, CtDataBar, CtDxf, CtFill, CtFont, CtIconSet,
    PlainTextString, StCfType, StCfvoType, StConditionalFormattingOperator, StIconSetType,
    StPatternType, StTimePeriod,
};
use xmlserde::XmlValue;

use crate::Error;
use crate::style_manager::dxf_manager::DxfManager;

/// The differential format a rule applies when it matches. Every field is
/// optional and only the set ones are written, which is what makes a rule's
/// format layer over the cell's own style instead of replacing it.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "cf_format_spec.ts", builder, rename_all = "camelCase")]
pub struct CfFormatSpec {
    /// Cell background, ARGB hex (`"FFFFC7CE"`). Written as a solid pattern
    /// fill's foreground colour, which is where Excel puts a dxf fill.
    pub fill_color: Option<String>,
    /// Font colour, ARGB hex.
    pub font_color: Option<String>,
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub strike: Option<bool>,
}

impl CfFormatSpec {
    fn is_empty(&self) -> bool {
        self.fill_color.is_none()
            && self.font_color.is_none()
            && self.bold.is_none()
            && self.italic.is_none()
            && self.strike.is_none()
    }
}

/// What a rule tests, plus the format it applies.
///
/// `ty` takes an ECMA-376 `ST_CfType` value (`cellIs`, `expression`,
/// `containsText`, `colorScale`, `dataBar`, `iconSet`, `top10`, …). Which of the
/// remaining fields matter depends on it; the rest are ignored.
#[derive(Debug, Clone, Default, TS)]
#[ts(file_name = "cf_rule_spec.ts", builder, rename_all = "camelCase")]
pub struct CfRuleSpec {
    pub ty: String,
    /// For `cellIs`: an `ST_ConditionalFormattingOperator` value
    /// (`greaterThan`, `between`, …).
    pub operator: Option<String>,
    /// Formula operands, in order. `cellIs between` takes two; `expression`
    /// takes the condition formula as the single operand.
    pub operands: Vec<String>,
    /// The needle for the text rules (`containsText` and friends). This — not an
    /// operand — is where the search string belongs.
    pub text: Option<String>,
    /// For `timePeriod`: an `ST_TimePeriod` value (`today`, `lastWeek`, …).
    pub time_period: Option<String>,
    /// For `top10`: how many (or what percent, with `percent`).
    pub rank: Option<u32>,
    pub percent: bool,
    pub bottom: bool,
    /// For `aboveAverage`: `false` inverts it to below-average.
    pub above_average: bool,
    pub equal_average: bool,
    pub std_dev: Option<i32>,
    /// Colour-scale stops (2 or 3, ARGB hex) or, for `dataBar`, the single bar
    /// colour.
    pub colors: Vec<String>,
    /// For `iconSet`: an `ST_IconSetType` value (`3TrafficLights1`, …).
    pub icon_set: Option<String>,
    pub reverse: bool,
    /// Stop applying lower-priority rules once this one matches.
    pub stop_if_true: bool,
    /// Ignored for the visual types, which carry their own appearance.
    pub format: Option<CfFormatSpec>,
}

/// Build the `<dxf>` for a spec's format, or `None` when it sets nothing.
pub(crate) fn spec_to_dxf(format: &CfFormatSpec) -> Option<CtDxf> {
    if format.is_empty() {
        return None;
    }
    let font = if format.font_color.is_some()
        || format.bold.is_some()
        || format.italic.is_some()
        || format.strike.is_some()
    {
        // Built field-by-field rather than from a default font: a dxf must carry
        // ONLY what the rule overrides, or it would also stamp a font name and
        // size onto every matching cell.
        Some(CtFont {
            color: format.font_color.as_deref().map(argb),
            // Bare bools on `CtFont`, so "leave alone" and "explicitly off" are
            // indistinguishable once written — see the limitations doc.
            bold: format.bold.unwrap_or(false),
            italic: format.italic.unwrap_or(false),
            strike: format.strike.unwrap_or(false),
            ..empty_font()
        })
    } else {
        None
    };
    let fill = format.fill_color.as_deref().map(|c| {
        CtFill::PatternFill(logisheets_workbook::prelude::CtPatternFill {
            fg_color: Some(argb(c)),
            bg_color: None,
            pattern_type: Some(StPatternType::Solid),
        })
    });
    Some(CtDxf {
        font,
        num_fmt: None,
        fill,
        alignment: None,
        border: None,
        protection: None,
    })
}

/// Convert a spec into an OOXML rule at `priority`, referencing `dxf_id` (which
/// the caller has already interned) for its differential format.
pub(crate) fn spec_to_rule(
    spec: &CfRuleSpec,
    priority: i32,
    dxf_id: Option<u32>,
) -> Result<CtCfRule, Error> {
    let ty = StCfType::deserialize(&spec.ty).map_err(|_| {
        Error::PayloadError(format!("unknown conditional format type: {}", spec.ty))
    })?;

    let operator = match spec.operator.as_deref() {
        Some(op) => Some(
            StConditionalFormattingOperator::deserialize(op).map_err(|_| {
                Error::PayloadError(format!("unknown conditional format operator: {op}"))
            })?,
        ),
        None => None,
    };
    let time_period = match spec.time_period.as_deref() {
        Some(p) => Some(
            StTimePeriod::deserialize(p)
                .map_err(|_| Error::PayloadError(format!("unknown time period: {p}")))?,
        ),
        None => None,
    };

    // Reject the combinations that would produce a rule nothing can evaluate,
    // rather than storing something that silently never matches.
    match ty {
        StCfType::CellIs => {
            let op = operator.as_ref().ok_or_else(|| {
                Error::PayloadError("a cellIs rule needs an operator".to_string())
            })?;
            let needed = if matches!(
                op,
                StConditionalFormattingOperator::Between
                    | StConditionalFormattingOperator::NotBetween
            ) {
                2
            } else {
                1
            };
            if spec.operands.len() < needed {
                return Err(Error::PayloadError(format!(
                    "a cellIs rule with this operator needs {needed} operand(s), got {}",
                    spec.operands.len()
                )));
            }
        }
        StCfType::Expression => {
            if spec.operands.is_empty() {
                return Err(Error::PayloadError(
                    "an expression rule needs its formula as the single operand".to_string(),
                ));
            }
        }
        StCfType::ContainsText
        | StCfType::NotContainsText
        | StCfType::BeginsWith
        | StCfType::EndsWith => {
            if spec.text.as_deref().unwrap_or("").is_empty() {
                return Err(Error::PayloadError(
                    "a text rule needs `text` set to the string to search for".to_string(),
                ));
            }
        }
        StCfType::Top10 => {
            if spec.rank.unwrap_or(0) == 0 {
                return Err(Error::PayloadError(
                    "a top10 rule needs a non-zero rank".to_string(),
                ));
            }
        }
        StCfType::TimePeriod => {
            if time_period.is_none() {
                return Err(Error::PayloadError(
                    "a timePeriod rule needs `timePeriod` set".to_string(),
                ));
            }
        }
        StCfType::ColorScale => {
            if spec.colors.len() < 2 {
                return Err(Error::PayloadError(
                    "a colorScale rule needs at least 2 colours".to_string(),
                ));
            }
        }
        StCfType::DataBar => {
            if spec.colors.is_empty() {
                return Err(Error::PayloadError(
                    "a dataBar rule needs a colour".to_string(),
                ));
            }
        }
        _ => {}
    }

    let color_scale = if matches!(ty, StCfType::ColorScale) {
        Some(CtColorScale {
            cfvos: even_cfvos(spec.colors.len()),
            colors: spec.colors.iter().map(|c| argb(c)).collect(),
        })
    } else {
        None
    };
    let data_bar = if matches!(ty, StCfType::DataBar) {
        Some(CtDataBar {
            cfvos: even_cfvos(2),
            color: argb(&spec.colors[0]),
            min_length: 10,
            max_length: 90,
            show_value: true,
        })
    } else {
        None
    };
    let icon_set = if matches!(ty, StCfType::IconSet) {
        let name = spec.icon_set.as_deref().unwrap_or("3TrafficLights1");
        let set = StIconSetType::deserialize(name)
            .map_err(|_| Error::PayloadError(format!("unknown icon set: {name}")))?;
        // An icon set's cfvo count matches its icon count, and the leading digit
        // of every ST_IconSetType value is exactly that count.
        let n = name
            .chars()
            .next()
            .and_then(|c| c.to_digit(10))
            .unwrap_or(3) as usize;
        Some(CtIconSet {
            cfvos: even_cfvos(n),
            icon_set: set,
            show_value: true,
            percent: true,
            reverse: spec.reverse,
        })
    } else {
        None
    };

    Ok(CtCfRule {
        formulas: spec
            .operands
            .iter()
            .map(|o| PlainTextString {
                value: o.clone(),
                space: None,
            })
            .collect(),
        color_scale,
        data_bar,
        icon_set,
        ty,
        dxf_id,
        priority,
        stop_if_true: spec.stop_if_true,
        above_average: spec.above_average,
        percent: spec.percent,
        bottom: spec.bottom,
        operator,
        text: spec.text.clone(),
        time_period,
        rank: spec.rank,
        std_dev: spec.std_dev,
        equal_average: spec.equal_average,
    })
}

/// A `CtFont` with nothing set, for a dxf to override selectively.
fn empty_font() -> CtFont {
    CtFont {
        bold: false,
        italic: false,
        underline: None,
        color: None,
        sz: None,
        name: None,
        charset: None,
        family: None,
        strike: false,
        outline: false,
        shadow: false,
        condense: false,
        extend: false,
        vert_align: None,
        scheme: None,
    }
}

/// `n` stops spread evenly from 0% to 100% — what Excel writes for a fresh
/// colour scale or icon set.
fn even_cfvos(n: usize) -> Vec<CtCfvo> {
    if n < 2 {
        return Vec::new();
    }
    (0..n)
        .map(|i| {
            let pct = i * 100 / (n - 1);
            let ty = match i {
                0 => StCfvoType::Min,
                _ if i == n - 1 => StCfvoType::Max,
                _ => StCfvoType::Percent,
            };
            let val = match ty {
                StCfvoType::Percent => Some(pct.to_string()),
                _ => None,
            };
            CtCfvo { ty, val, gte: true }
        })
        .collect()
}

/// An ARGB / RGB hex string as a `<color rgb="...">`. Anything unparseable is
/// still stored verbatim — the renderer's own hex parser is the single place
/// that decides what is drawable.
fn argb(hex: &str) -> CtColor {
    let h = hex.trim().trim_start_matches('#').to_ascii_uppercase();
    let rgb = if h.len() == 6 { format!("FF{h}") } else { h };
    CtColor {
        auto: None,
        indexed: None,
        rgb: Some(rgb),
        theme: None,
        tint: 0.0,
    }
}

/// The inverse of [`spec_to_rule`]: describe an existing rule in the same shape
/// the create/update payloads accept.
///
/// This is what lets a UI round-trip — load a rule into an editor, change one
/// field, send it back — without every consumer having to know OOXML.
pub(crate) fn rule_to_spec(rule: &CtCfRule, dxfs: &DxfManager) -> CfRuleSpec {
    let colors = if let Some(cs) = &rule.color_scale {
        cs.colors.iter().filter_map(color_hex).collect()
    } else if let Some(db) = &rule.data_bar {
        color_hex(&db.color).into_iter().collect()
    } else {
        Vec::new()
    };
    CfRuleSpec {
        ty: rule.ty.serialize(),
        operator: rule.operator.as_ref().map(|o| o.serialize()),
        operands: rule
            .formulas
            .iter()
            .map(|f| f.value.trim().to_string())
            .collect(),
        text: rule.text.clone(),
        time_period: rule.time_period.as_ref().map(|p| p.serialize()),
        rank: rule.rank,
        percent: rule.percent,
        bottom: rule.bottom,
        above_average: rule.above_average,
        equal_average: rule.equal_average,
        std_dev: rule.std_dev,
        colors,
        icon_set: rule.icon_set.as_ref().map(|i| i.icon_set.serialize()),
        reverse: rule.icon_set.as_ref().map(|i| i.reverse).unwrap_or(false),
        stop_if_true: rule.stop_if_true,
        format: rule
            .dxf_id
            .and_then(|id| dxfs.get(id))
            .map(dxf_to_format_spec),
    }
}

fn dxf_to_format_spec(dxf: &CtDxf) -> CfFormatSpec {
    let fill_color = match &dxf.fill {
        Some(CtFill::PatternFill(p)) => p
            .fg_color
            .as_ref()
            .or(p.bg_color.as_ref())
            .and_then(color_hex),
        _ => None,
    };
    CfFormatSpec {
        fill_color,
        font_color: dxf
            .font
            .as_ref()
            .and_then(|f| f.color.as_ref())
            .and_then(color_hex),
        // A dxf font's booleans are bare, so a `false` here is indistinguishable
        // from "not set". Reported as `Some(false)`, which round-trips to the
        // same rule — see the limitations doc.
        bold: dxf.font.as_ref().map(|f| f.bold),
        italic: dxf.font.as_ref().map(|f| f.italic),
        strike: dxf.font.as_ref().map(|f| f.strike),
    }
}

/// A colour's ARGB hex, when it has one. `theme` / `indexed` colours have no
/// literal to report, so they come back as `None` rather than a wrong value.
fn color_hex(c: &CtColor) -> Option<String> {
    c.rgb.clone()
}
