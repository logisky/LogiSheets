//! "Which conditional-formatting rules apply to this cell, and what formula
//! should its shadow hold?"
//!
//! This is the bridge between the rule store and the calc engine: it resolves a
//! cell's covering rules, orders them the way Excel does, and hands back the two
//! shadow formulas (match bitmask + scale) to install.

use logisheets_base::SheetId;
use logisheets_workbook::prelude::{CtCfRule, CtColor, StCfType};
use xmlserde::XmlValue;

use super::resolve::{range_bounds, ranges_to_sqref};
use super::translate::{
    MAX_RULES_PER_CELL, cfvo_position, match_bitmask, rule_to_condition, rule_to_scale,
};
use super::{CfBlock, ConditionalFormattingManager};
use crate::navigator::Navigator;

/// A rule that covers a given cell, with everything needed to evaluate it.
pub(crate) struct ApplicableRule<'a> {
    /// Bit this rule occupies in the cell's match bitmask.
    pub bit: u32,
    pub rule: &'a CtCfRule,
    /// The owning element's `sqref`, rendered from its current anchors — what
    /// the statistical rules aggregate over.
    pub range: String,
    /// The cell's offset from the top-left of the covering rectangle, used to
    /// shift an `expression` rule's references.
    pub offset: (i32, i32),
}

/// Every rule covering `(row, col)`, in the order Excel applies them: `priority`
/// ascending. Bits are assigned in that same order, so bit 0 is the
/// highest-priority rule.
///
/// Capped at [`MAX_RULES_PER_CELL`]; beyond that the extra rules are dropped
/// rather than silently corrupting the bitmask.
pub(crate) fn rules_for_cell<'a>(
    manager: &'a ConditionalFormattingManager,
    nav: &Navigator,
    sheet_id: SheetId,
    row: usize,
    col: usize,
) -> Vec<ApplicableRule<'a>> {
    let Some(blocks) = manager.get_sheet(sheet_id) else {
        return Vec::new();
    };
    let mut found: Vec<(i32, &CfBlock, &CtCfRule, (i32, i32))> = Vec::new();
    for block in blocks.iter() {
        // A cell is covered if any of the element's rectangles contains it. The
        // offset comes from the rectangle that covers it, which is the anchor
        // Excel shifts `expression` references against.
        let mut offset = None;
        for range in block.ranges.iter() {
            let Some((r0, c0, r1, c1)) = range_bounds(nav, sheet_id, range) else {
                continue;
            };
            if row >= r0 && row <= r1 && col >= c0 && col <= c1 {
                offset = Some((row as i32 - r0 as i32, col as i32 - c0 as i32));
                break;
            }
        }
        let Some(offset) = offset else { continue };
        for rule in block.rules.iter() {
            found.push((rule.rule.priority, block, &rule.rule, offset));
        }
    }
    found.sort_by_key(|(priority, _, _, _)| *priority);
    found.truncate(MAX_RULES_PER_CELL);
    found
        .into_iter()
        .enumerate()
        .map(|(bit, (_, block, rule, offset))| ApplicableRule {
            bit: bit as u32,
            rule,
            range: ranges_to_sqref(nav, sheet_id, &block.ranges),
            offset,
        })
        .collect()
}

/// The two shadow formulas for a cell, each `=`-prefixed and ready for
/// `EphemeralCellInput`. `None` means no shadow of that kind is needed.
pub(crate) struct ShadowFormulas {
    /// Bitmask of matching boolean rules.
    pub match_formula: Option<String>,
    /// Position within the range for the cell's colour scale / data bar.
    pub scale_formula: Option<String>,
}

/// Build the shadow formulas for a cell from its applicable rules.
pub(crate) fn shadow_formulas(applicable: &[ApplicableRule<'_>]) -> ShadowFormulas {
    let conditions: Vec<(u32, String)> = applicable
        .iter()
        .filter_map(|a| rule_to_condition(a.rule, &a.range, a.offset).map(|c| (a.bit, c)))
        .collect();

    // Only one visual rule can drive the cell's magnitude; the highest-priority
    // one wins, which is the first in this list.
    let scale = applicable
        .iter()
        .find(|a| {
            matches!(
                a.rule.ty,
                StCfType::ColorScale | StCfType::DataBar | StCfType::IconSet
            )
        })
        .and_then(|a| rule_to_scale(a.rule, &a.range));

    ShadowFormulas {
        match_formula: match_bitmask(&conditions).map(|f| format!("={f}")),
        scale_formula: scale.map(|f| format!("={f}")),
    }
}

/// Rules whose bit is set in `mask`, in priority order, honouring `stopIfTrue`:
/// application halts after the first matching rule that carries it.
///
/// The mask comes from the cell's `ConditionalFormat` shadow, so a non-integer
/// or negative value (an error propagating through, say) yields nothing.
pub(crate) fn matched_rules<'a>(
    applicable: &'a [ApplicableRule<'a>],
    mask: f64,
) -> Vec<&'a ApplicableRule<'a>> {
    if !mask.is_finite() || mask < 0.0 {
        return Vec::new();
    }
    let bits = mask.round() as u64;
    let mut out = Vec::new();
    for a in applicable {
        if a.bit >= 64 || bits & (1u64 << a.bit) == 0 {
            continue;
        }
        let stop = a.rule.stop_if_true;
        out.push(a);
        if stop {
            break;
        }
    }
    out
}

/// Interpolate a colour scale's stops at position `scale` (0..=1).
///
/// Stops sit at the cfvo positions; with only endpoint cfvos that is a straight
/// two-colour ramp, and a three-stop scale puts the middle colour at its cfvo's
/// own position rather than assuming the midpoint. Falls back to even spacing
/// when a middle cfvo isn't expressed in terms this can place (see
/// docs/conditional-formatting.md).
pub(crate) fn color_scale_at(rule: &CtCfRule, scale: f64) -> Option<CtColor> {
    let cs = rule.color_scale.as_ref()?;
    let colors = &cs.colors;
    if colors.is_empty() {
        return None;
    }
    if colors.len() == 1 {
        return Some(colors[0].clone());
    }
    let n = colors.len();
    let positions: Vec<f64> = (0..n)
        .map(|i| {
            if i == 0 {
                0.0
            } else if i == n - 1 {
                1.0
            } else {
                cfvo_position(&cs.cfvos, i).unwrap_or(i as f64 / (n - 1) as f64)
            }
        })
        .collect();
    let s = scale.clamp(0.0, 1.0);
    // Find the segment containing `s`.
    let mut seg = 0usize;
    while seg + 2 < n && s > positions[seg + 1] {
        seg += 1;
    }
    let (p0, p1) = (positions[seg], positions[seg + 1]);
    let t = if (p1 - p0).abs() < f64::EPSILON {
        0.0
    } else {
        ((s - p0) / (p1 - p0)).clamp(0.0, 1.0)
    };
    Some(lerp_color(&colors[seg], &colors[seg + 1], t))
}

/// Blend two colours in sRGB. Only `rgb`-specified colours can be blended;
/// indexed / theme colours fall back to the nearer endpoint.
fn lerp_color(a: &CtColor, b: &CtColor, t: f64) -> CtColor {
    let parse = |c: &CtColor| -> Option<(u8, u8, u8, u8)> {
        let hex = c.rgb.as_deref()?;
        let hex = hex.trim_start_matches('#');
        // ARGB (8) or RGB (6).
        let (a, rest) = match hex.len() {
            8 => (u8::from_str_radix(&hex[0..2], 16).ok()?, &hex[2..]),
            6 => (255u8, hex),
            _ => return None,
        };
        Some((
            a,
            u8::from_str_radix(&rest[0..2], 16).ok()?,
            u8::from_str_radix(&rest[2..4], 16).ok()?,
            u8::from_str_radix(&rest[4..6], 16).ok()?,
        ))
    };
    let (Some(x), Some(y)) = (parse(a), parse(b)) else {
        return if t < 0.5 { a.clone() } else { b.clone() };
    };
    let mix = |p: u8, q: u8| -> u8 {
        (p as f64 + (q as f64 - p as f64) * t)
            .round()
            .clamp(0.0, 255.0) as u8
    };
    CtColor {
        auto: None,
        indexed: None,
        rgb: Some(format!(
            "{:02X}{:02X}{:02X}{:02X}",
            mix(x.0, y.0),
            mix(x.1, y.1),
            mix(x.2, y.2),
            mix(x.3, y.3)
        )),
        theme: None,
        tint: 0.0,
    }
}

/// The data bar to draw for a cell at position `scale`.
///
/// `minLength` / `maxLength` are percentages of the cell width that bound the
/// bar, so the reported fraction is `scale` mapped into that band.
pub(crate) fn data_bar_at(rule: &CtCfRule, scale: f64) -> Option<(CtColor, f64, bool)> {
    let db = rule.data_bar.as_ref()?;
    let lo = (db.min_length as f64 / 100.0).clamp(0.0, 1.0);
    let hi = (db.max_length as f64 / 100.0).clamp(0.0, 1.0);
    let (lo, hi) = if lo <= hi { (lo, hi) } else { (hi, lo) };
    let fraction = lo + scale.clamp(0.0, 1.0) * (hi - lo);
    Some((db.color.clone(), fraction, db.show_value))
}

/// Which icon of the set applies at position `scale`.
///
/// Bands are delimited by the cfvo positions; `reverse` flips the order, which
/// is what Excel's "Reverse Icon Order" does.
pub(crate) fn icon_at(rule: &CtCfRule, scale: f64) -> Option<(String, usize, usize, bool)> {
    let is = rule.icon_set.as_ref()?;
    let count = is.cfvos.len();
    if count < 3 {
        return None;
    }
    let s = scale.clamp(0.0, 1.0);
    // Band i spans [pos(i), pos(i+1)); the first cfvo is always at 0.
    let mut index = 0usize;
    for i in 1..count {
        let p = cfvo_position(&is.cfvos, i).unwrap_or(i as f64 / count as f64);
        if s >= p {
            index = i;
        }
    }
    if is.reverse {
        index = count - 1 - index;
    }
    Some((is.icon_set.serialize(), index, count, is.show_value))
}
