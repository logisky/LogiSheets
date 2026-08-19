//! Translate a conditional-formatting rule into the formula a shadow cell can
//! evaluate. `#PLACEHOLDER` stands for the cell being formatted; `{range}` is
//! filled with the rule's own `sqref`, rendered from its current anchors, so
//! statistical rules (`top10`, `aboveAverage`, colour scales, ...) aggregate
//! over exactly the cells Excel would.
//!
//! Two shapes come out of here:
//!   * a **condition** — a boolean expression, one per rule, combined by
//!     [`match_bitmask`] into a single formula reporting *every* rule that
//!     matches the cell;
//!   * a **scale** — a number in `0..=1` giving the cell's position within the
//!     range, which is what a colour scale / data bar / icon set needs.

use logisheets_workbook::prelude::{
    CtCfRule, CtCfvo, StCfType as Ty, StCfvoType, StConditionalFormattingOperator as Op,
    StTimePeriod,
};

use super::a1_shift::shift_formula;

const P: &str = "#PLACEHOLDER";

/// The rule's `formulas` children, trimmed. Excel puts operands here in order.
fn operands(rule: &CtCfRule) -> Vec<String> {
    rule.formulas
        .iter()
        .map(|f| f.value.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// A boolean expression (no leading `=`) deciding whether `rule` matches the
/// cell at `offset` rows/cols from the top-left of `range`. `None` for rule
/// types that carry no condition (the visual ones — see [`rule_to_scale`]) or
/// whose operands are missing.
///
/// `range` is an A1 range string (`"$A$1:$A$10"`); `offset` is `(dr, dc)` from
/// the range's top-left, used to shift an `expression` rule's own references.
pub(crate) fn rule_to_condition(
    rule: &CtCfRule,
    range: &str,
    offset: (i32, i32),
) -> Option<String> {
    let ops = operands(rule);
    match rule.ty {
        // The rule *is* a formula, authored against the range's top-left.
        Ty::Expression => {
            let body = ops.first()?;
            let body = body.strip_prefix('=').unwrap_or(body);
            Some(shift_formula(body, offset.0, offset.1))
        }
        Ty::CellIs => {
            let op = rule.operator.as_ref()?;
            cell_is(op, &ops)
        }
        Ty::ContainsText => {
            let t = search_text(rule, &ops)?;
            Some(format!("ISNUMBER(SEARCH({t},{P}))"))
        }
        Ty::NotContainsText => {
            let t = search_text(rule, &ops)?;
            Some(format!("NOT(ISNUMBER(SEARCH({t},{P})))"))
        }
        Ty::BeginsWith => {
            let t = search_text(rule, &ops)?;
            Some(format!("EXACT(LEFT({P},LEN({t})),{t})"))
        }
        Ty::EndsWith => {
            let t = search_text(rule, &ops)?;
            Some(format!("EXACT(RIGHT({P},LEN({t})),{t})"))
        }
        Ty::ContainsBlanks => Some(format!("LEN({P})=0")),
        Ty::NotContainsBlanks => Some(format!("LEN({P})>0")),
        Ty::ContainsErrors => Some(format!("ISERROR({P})")),
        Ty::NotContainsErrors => Some(format!("NOT(ISERROR({P}))")),
        Ty::DuplicateValues => Some(format!("COUNTIF({range},{P})>1")),
        Ty::UniqueValues => Some(format!("COUNTIF({range},{P})=1")),
        Ty::Top10 => {
            let rank = rule.rank?;
            if rank == 0 {
                return None;
            }
            Some(top10(rule, range, rank))
        }
        Ty::AboveAverage => Some(above_average(rule, range)),
        Ty::TimePeriod => time_period(rule.time_period.as_ref()?),
        // Visual rules carry no boolean condition.
        Ty::ColorScale | Ty::DataBar | Ty::IconSet => None,
    }
}

/// Where the cell sits between the rule's first and last `cfvo`, clamped to
/// `0..=1`. `None` for non-visual rules or a rule missing its endpoints.
///
/// Normalizing against the *cfvo endpoints* rather than the raw range min/max is
/// what makes the rest computable without a second trip to the engine: a colour
/// scale's stops, a data bar's length and an icon set's thresholds are all
/// positions on this same scale, so once the shadow reports it the merge step
/// needs no further aggregation.
pub(crate) fn rule_to_scale(rule: &CtCfRule, range: &str) -> Option<String> {
    let cfvos = cfvos_of(rule)?;
    let lo = cfvo_expr(cfvos.first()?, range)?;
    let hi = cfvo_expr(cfvos.last()?, range)?;
    // Clamp, and guard the degenerate hi == lo (an all-equal range) which would
    // otherwise divide by zero.
    Some(format!(
        "IF({hi}={lo},0,MAX(0,MIN(1,({P}-{lo})/({hi}-{lo}))))"
    ))
}

/// The `<cfvo>` list of whichever visual rule this is.
pub(crate) fn cfvos_of(rule: &CtCfRule) -> Option<&Vec<CtCfvo>> {
    match rule.ty {
        Ty::ColorScale => Some(&rule.color_scale.as_ref()?.cfvos),
        Ty::DataBar => Some(&rule.data_bar.as_ref()?.cfvos),
        Ty::IconSet => Some(&rule.icon_set.as_ref()?.cfvos),
        _ => None,
    }
}

/// A `<cfvo>` as a formula expression yielding the value it stands for.
fn cfvo_expr(cfvo: &CtCfvo, range: &str) -> Option<String> {
    let val = || cfvo.val.as_deref().map(|v| v.trim().to_string());
    let s = match cfvo.ty {
        StCfvoType::Min => format!("MIN({range})"),
        StCfvoType::Max => format!("MAX({range})"),
        StCfvoType::Num | StCfvoType::Formula => val()?,
        StCfvoType::Percent => {
            let p = val()?;
            format!("MIN({range})+({p})/100*(MAX({range})-MIN({range}))")
        }
        StCfvoType::Percentile => {
            let p = val()?;
            format!("PERCENTILE({range},({p})/100)")
        }
    };
    Some(s)
}

/// Where a middle `<cfvo>` sits on the `0..=1` scale [`rule_to_scale`] reports,
/// for picking an icon out of an icon set.
///
/// Only derivable without another engine round-trip when the endpoints and the
/// middle stop are expressed in the same numeric terms — which `percent` and
/// `percentile` cfvos are, and they are what Excel writes for icon sets. For
/// anything else (`num`, `formula`, or a mix) the caller falls back to even
/// steps; see docs/conditional-formatting.md.
pub(crate) fn cfvo_position(cfvos: &[CtCfvo], idx: usize) -> Option<f64> {
    let parse = |c: &CtCfvo| -> Option<f64> {
        match c.ty {
            StCfvoType::Percent | StCfvoType::Percentile => {
                c.val.as_deref()?.trim().parse::<f64>().ok()
            }
            StCfvoType::Min => Some(0.0),
            StCfvoType::Max => Some(100.0),
            _ => None,
        }
    };
    let lo = parse(cfvos.first()?)?;
    let hi = parse(cfvos.last()?)?;
    let mid = parse(cfvos.get(idx)?)?;
    if (hi - lo).abs() < f64::EPSILON {
        return None;
    }
    Some((mid - lo) / (hi - lo))
}

/// Fold per-rule conditions into ONE formula whose value is a bitmask of the
/// rules that match: bit `k` is set when the condition passed as `(k, cond)`
/// holds. Callers decode the bits and merge the matching rules' formats.
///
/// A bitmask rather than "the first match" because Excel applies *every*
/// matching rule, merging their differential formats in `priority` order — a
/// rule setting the font and a rule setting the fill both take effect.
/// `stopIfTrue` then halts application after a matching rule, which is a
/// decision about the decoded results, so it stays with the caller; encoding it
/// here would throw away the information needed to make it.
///
/// Each term is guarded with `IFERROR`: Excel treats a rule whose condition
/// errors as simply not matching, and without the guard one erroring rule would
/// poison the whole sum and lose the other rules' results.
///
/// `None` when there is nothing to test. Bit indices must stay under 53 (f64
/// mantissa); callers cap the rule count.
pub(crate) fn match_bitmask(conditions: &[(u32, String)]) -> Option<String> {
    if conditions.is_empty() {
        return None;
    }
    let terms: Vec<String> = conditions
        .iter()
        .map(|(bit, cond)| format!("IFERROR(IF({cond},{},0),0)", 1u64 << bit))
        .collect();
    Some(terms.join("+"))
}

/// The largest number of rules one cell's bitmask can carry, bounded by what an
/// f64 can represent exactly.
pub(crate) const MAX_RULES_PER_CELL: usize = 53;

fn cell_is(op: &Op, ops: &[String]) -> Option<String> {
    let f1 = ops.first()?;
    let s = match op {
        Op::LessThan => format!("{P}<{f1}"),
        Op::LessThanOrEqual => format!("{P}<={f1}"),
        Op::Equal => format!("{P}={f1}"),
        Op::NotEqual => format!("{P}<>{f1}"),
        Op::GreaterThanOrEqual => format!("{P}>={f1}"),
        Op::GreaterThan => format!("{P}>{f1}"),
        Op::Between => {
            let f2 = ops.get(1)?;
            format!("AND({P}>={f1},{P}<={f2})")
        }
        Op::NotBetween => {
            let f2 = ops.get(1)?;
            format!("OR({P}<{f1},{P}>{f2})")
        }
        // Excel also allows the text operators on a `cellIs` rule.
        Op::ContainsText => format!("ISNUMBER(SEARCH({f1},{P}))"),
        Op::NotContains => format!("NOT(ISNUMBER(SEARCH({f1},{P})))"),
        Op::BeginsWith => format!("EXACT(LEFT({P},LEN({f1})),{f1})"),
        Op::EndsWith => format!("EXACT(RIGHT({P},LEN({f1})),{f1})"),
    };
    Some(s)
}

/// `top10`: `bottom` picks the low end, `percent` switches from "top N" to
/// "top N%" (Excel rounds the resulting count up, hence `ROUNDUP`).
fn top10(rule: &CtCfRule, range: &str, rank: u32) -> String {
    let n = if rule.percent {
        format!("ROUNDUP(COUNT({range})*{rank}/100,0)")
    } else {
        rank.to_string()
    };
    if rule.bottom {
        format!("{P}<=SMALL({range},{n})")
    } else {
        format!("{P}>=LARGE({range},{n})")
    }
}

/// `aboveAverage`: `aboveAverage=false` flips to below, `equalAverage` makes the
/// comparison inclusive, and `stdDev` shifts the threshold by N deviations.
fn above_average(rule: &CtCfRule, range: &str) -> String {
    let threshold = match rule.std_dev {
        Some(n) if n != 0 => {
            let sign = if rule.above_average { '+' } else { '-' };
            format!("AVERAGE({range}){sign}{}*STDEV.P({range})", n.abs())
        }
        _ => format!("AVERAGE({range})"),
    };
    let op = match (rule.above_average, rule.equal_average) {
        (true, false) => ">",
        (true, true) => ">=",
        (false, false) => "<",
        (false, true) => "<=",
    };
    format!("{P}{op}{threshold}")
}

fn time_period(period: &StTimePeriod) -> Option<String> {
    // WEEKDAY(d,2) is Monday=1..Sunday=7, so `TODAY()-WEEKDAY(TODAY(),2)+1` is
    // this week's Monday — the anchor the week-relative periods build on.
    const MONDAY: &str = "TODAY()-WEEKDAY(TODAY(),2)+1";
    let s = match period {
        StTimePeriod::Today => format!("INT({P})=TODAY()"),
        StTimePeriod::Yesterday => format!("INT({P})=TODAY()-1"),
        StTimePeriod::Tomorrow => format!("INT({P})=TODAY()+1"),
        StTimePeriod::Last7Days => {
            format!("AND(INT({P})<=TODAY(),INT({P})>=TODAY()-6)")
        }
        StTimePeriod::ThisWeek => {
            format!("AND(INT({P})>={MONDAY},INT({P})<={MONDAY}+6)")
        }
        StTimePeriod::LastWeek => {
            format!("AND(INT({P})>={MONDAY}-7,INT({P})<={MONDAY}-1)")
        }
        StTimePeriod::NextWeek => {
            format!("AND(INT({P})>={MONDAY}+7,INT({P})<={MONDAY}+13)")
        }
        StTimePeriod::ThisMonth => {
            format!("AND(YEAR({P})=YEAR(TODAY()),MONTH({P})=MONTH(TODAY()))")
        }
        // Month arithmetic via a day-1 anchor keeps December/January correct.
        StTimePeriod::LastMonth => month_offset(-1),
        StTimePeriod::NextMonth => month_offset(1),
    };
    Some(s)
}

/// True when the cell's date falls in the month `delta` months from today.
/// `DATE` normalizes an out-of-range month, so month 0 becomes last December.
fn month_offset(delta: i32) -> String {
    let m = format!("MONTH(TODAY())+{delta}");
    format!(
        "AND(YEAR({P})=YEAR(DATE(YEAR(TODAY()),{m},1)),MONTH({P})=MONTH(DATE(YEAR(TODAY()),{m},1)))"
    )
}

/// The needle for a text rule, as a quoted formula literal.
///
/// It comes from the `text` ATTRIBUTE, not from `<formula>`. Writers emit both:
/// `text` holds the string the user typed, while the formula child holds an
/// equivalent expression anchored somewhere in the range —
/// `NOT(ISERROR(SEARCH("abc",G2)))`. Reading the operand as if it were the
/// needle produced a nonsense condition that searched for the whole formula's
/// source text, so a real file's rule silently never matched. Falls back to the
/// operand only when `text` is absent, and rejects an operand that is plainly a
/// formula rather than a literal.
fn search_text(rule: &CtCfRule, ops: &[String]) -> Option<String> {
    if let Some(t) = rule.text.as_deref() {
        return Some(format!("\"{}\"", t.replace('"', "\"\"")));
    }
    let raw = ops.first()?;
    if raw.contains('(') {
        return None;
    }
    Some(quoted(raw))
}

/// Operands arrive as formula text: a text operand is already `"abc"`, but be
/// tolerant of a bare word (some writers emit it unquoted).
fn quoted(raw: &str) -> String {
    if raw.starts_with('"') && raw.ends_with('"') && raw.len() >= 2 {
        raw.to_string()
    } else if raw
        .chars()
        .all(|c| c.is_ascii_digit() || c == '.' || c == '-')
    {
        raw.to_string()
    } else {
        format!("\"{}\"", raw.replace('"', "\"\""))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use logisheets_workbook::prelude::{
        CtCfvo, CtColor, CtColorScale, PlainTextString, StCfvoType,
    };

    fn rule(ty: Ty) -> CtCfRule {
        CtCfRule {
            formulas: vec![],
            color_scale: None,
            data_bar: None,
            icon_set: None,
            ty,
            dxf_id: Some(0),
            priority: 1,
            stop_if_true: false,
            above_average: true,
            percent: false,
            bottom: false,
            operator: None,
            text: None,
            time_period: None,
            rank: None,
            std_dev: None,
            equal_average: false,
        }
    }

    fn with_operands(mut r: CtCfRule, ops: &[&str]) -> CtCfRule {
        r.formulas = ops
            .iter()
            .map(|s| PlainTextString {
                value: s.to_string(),
                space: None,
            })
            .collect();
        r
    }

    const R: &str = "$A$1:$A$10";

    #[test]
    fn cell_is_operators() {
        let mut r = with_operands(rule(Ty::CellIs), &["100"]);
        r.operator = Some(Op::GreaterThan);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER>100"
        );

        let mut r = with_operands(rule(Ty::CellIs), &["1", "50"]);
        r.operator = Some(Op::Between);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "AND(#PLACEHOLDER>=1,#PLACEHOLDER<=50)"
        );

        // `between` without a second operand is not translatable.
        let mut r = with_operands(rule(Ty::CellIs), &["1"]);
        r.operator = Some(Op::Between);
        assert!(rule_to_condition(&r, R, (0, 0)).is_none());
    }

    /// An `expression` rule is anchored on the range's top-left, so the cell
    /// three rows down must test three rows down.
    #[test]
    fn expression_shifts_per_cell() {
        let r = with_operands(rule(Ty::Expression), &["$B1>10"]);
        assert_eq!(rule_to_condition(&r, R, (0, 0)).unwrap(), "$B1>10");
        assert_eq!(rule_to_condition(&r, R, (3, 0)).unwrap(), "$B4>10");
        // A leading `=` in the stored operand is tolerated.
        let r = with_operands(rule(Ty::Expression), &["=$B1>10"]);
        assert_eq!(rule_to_condition(&r, R, (2, 0)).unwrap(), "$B3>10");
    }

    #[test]
    fn text_rules() {
        // The needle comes from the `text` attribute. A real file also carries an
        // equivalent formula child, which must NOT be mistaken for the needle.
        let mut r = with_operands(
            rule(Ty::ContainsText),
            &["NOT(ISERROR(SEARCH(\"foo\",G2)))"],
        );
        r.text = Some("foo".to_string());
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "ISNUMBER(SEARCH(\"foo\",#PLACEHOLDER))"
        );
        // A formula operand with no `text` attribute is not a usable needle.
        let r = with_operands(
            rule(Ty::ContainsText),
            &["NOT(ISERROR(SEARCH(\"foo\",G2)))"],
        );
        assert!(rule_to_condition(&r, R, (0, 0)).is_none());

        let r = with_operands(rule(Ty::ContainsText), &["\"foo\""]);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "ISNUMBER(SEARCH(\"foo\",#PLACEHOLDER))"
        );
        let mut r = with_operands(rule(Ty::BeginsWith), &[]);
        r.text = Some("a".to_string());
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "EXACT(LEFT(#PLACEHOLDER,LEN(\"a\")),\"a\")"
        );
        // An unquoted operand gets quoted rather than producing a bad formula.
        let r = with_operands(rule(Ty::NotContainsText), &["bar"]);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "NOT(ISNUMBER(SEARCH(\"bar\",#PLACEHOLDER)))"
        );
    }

    #[test]
    fn blank_and_error_rules() {
        assert_eq!(
            rule_to_condition(&rule(Ty::ContainsBlanks), R, (0, 0)).unwrap(),
            "LEN(#PLACEHOLDER)=0"
        );
        assert_eq!(
            rule_to_condition(&rule(Ty::ContainsErrors), R, (0, 0)).unwrap(),
            "ISERROR(#PLACEHOLDER)"
        );
        assert_eq!(
            rule_to_condition(&rule(Ty::NotContainsErrors), R, (0, 0)).unwrap(),
            "NOT(ISERROR(#PLACEHOLDER))"
        );
    }

    #[test]
    fn duplicate_and_unique_aggregate_over_the_rule_range() {
        assert_eq!(
            rule_to_condition(&rule(Ty::DuplicateValues), R, (0, 0)).unwrap(),
            "COUNTIF($A$1:$A$10,#PLACEHOLDER)>1"
        );
        assert_eq!(
            rule_to_condition(&rule(Ty::UniqueValues), R, (0, 0)).unwrap(),
            "COUNTIF($A$1:$A$10,#PLACEHOLDER)=1"
        );
    }

    #[test]
    fn top10_variants() {
        let mut r = rule(Ty::Top10);
        r.rank = Some(3);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER>=LARGE($A$1:$A$10,3)"
        );
        r.bottom = true;
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER<=SMALL($A$1:$A$10,3)"
        );
        r.bottom = false;
        r.percent = true;
        r.rank = Some(10);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER>=LARGE($A$1:$A$10,ROUNDUP(COUNT($A$1:$A$10)*10/100,0))"
        );
        // A zero rank has no meaning.
        r.rank = Some(0);
        assert!(rule_to_condition(&r, R, (0, 0)).is_none());
    }

    #[test]
    fn above_average_variants() {
        let mut r = rule(Ty::AboveAverage);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER>AVERAGE($A$1:$A$10)"
        );
        r.equal_average = true;
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER>=AVERAGE($A$1:$A$10)"
        );
        r.equal_average = false;
        r.above_average = false;
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER<AVERAGE($A$1:$A$10)"
        );
        // `stdDev` shifts the threshold, in the rule's own direction.
        r.above_average = true;
        r.std_dev = Some(2);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER>AVERAGE($A$1:$A$10)+2*STDEV.P($A$1:$A$10)"
        );
        r.above_average = false;
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "#PLACEHOLDER<AVERAGE($A$1:$A$10)-2*STDEV.P($A$1:$A$10)"
        );
    }

    #[test]
    fn time_periods() {
        let mut r = rule(Ty::TimePeriod);
        r.time_period = Some(StTimePeriod::Today);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "INT(#PLACEHOLDER)=TODAY()"
        );
        r.time_period = Some(StTimePeriod::Last7Days);
        assert_eq!(
            rule_to_condition(&r, R, (0, 0)).unwrap(),
            "AND(INT(#PLACEHOLDER)<=TODAY(),INT(#PLACEHOLDER)>=TODAY()-6)"
        );
        // A rule with no timePeriod attribute is not translatable.
        r.time_period = None;
        assert!(rule_to_condition(&r, R, (0, 0)).is_none());
    }

    /// Visual rules have no boolean condition; they produce a scale instead.
    #[test]
    fn visual_rules_have_no_condition_but_do_have_a_scale() {
        let mut r = rule(Ty::ColorScale);
        r.color_scale = Some(CtColorScale {
            cfvos: vec![
                CtCfvo {
                    ty: StCfvoType::Min,
                    val: None,
                    gte: true,
                },
                CtCfvo {
                    ty: StCfvoType::Max,
                    val: None,
                    gte: true,
                },
            ],
            colors: vec![
                CtColor {
                    auto: None,
                    indexed: None,
                    rgb: Some("FFFF0000".into()),
                    theme: None,
                    tint: 0.0,
                },
                CtColor {
                    auto: None,
                    indexed: None,
                    rgb: Some("FF00FF00".into()),
                    theme: None,
                    tint: 0.0,
                },
            ],
        });
        assert!(rule_to_condition(&r, R, (0, 0)).is_none());
        assert_eq!(
            rule_to_scale(&r, R).unwrap(),
            "IF(MAX($A$1:$A$10)=MIN($A$1:$A$10),0,MAX(0,MIN(1,\
             (#PLACEHOLDER-MIN($A$1:$A$10))/(MAX($A$1:$A$10)-MIN($A$1:$A$10)))))"
        );

        // Explicit numeric endpoints need no aggregation at all.
        {
            let cs = r.color_scale.as_mut().unwrap();
            cs.cfvos[0].ty = StCfvoType::Num;
            cs.cfvos[0].val = Some("10".into());
            cs.cfvos[1].ty = StCfvoType::Num;
            cs.cfvos[1].val = Some("20".into());
        }
        assert_eq!(
            rule_to_scale(&r, R).unwrap(),
            "IF(20=10,0,MAX(0,MIN(1,(#PLACEHOLDER-10)/(20-10))))"
        );

        // Non-visual rules have no scale.
        assert!(rule_to_scale(&rule(Ty::CellIs), R).is_none());
    }

    /// Every matching rule must be reported, not just the first — Excel merges
    /// the formats of all of them.
    #[test]
    fn bitmask_reports_every_match() {
        assert_eq!(
            match_bitmask(&[(0, "A".into()), (1, "B".into()), (2, "C".into())]).unwrap(),
            "IFERROR(IF(A,1,0),0)+IFERROR(IF(B,2,0),0)+IFERROR(IF(C,4,0),0)"
        );
        assert_eq!(
            match_bitmask(&[(3, "X".into())]).unwrap(),
            "IFERROR(IF(X,8,0),0)"
        );
        assert!(match_bitmask(&[]).is_none());
    }
}
