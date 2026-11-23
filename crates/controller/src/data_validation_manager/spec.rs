//! The caller-facing shape of a data-validation rule, and its conversion to and
//! from OOXML.
//!
//! Flat like `CfRuleSpec`, and for the same reasons: `CtDataValidation` is
//! already flat, one interface crosses the TS boundary, and validation lives in
//! one place ([`spec_to_rule`]).

use gents_derives::TS;
use logisheets_workbook::prelude::{
    CtDataValidation, PlainTextString, StDataValidationErrorStyle, StDataValidationImeMode,
    StDataValidationOperator, StDataValidationType,
};
use xmlserde::XmlValue;

use crate::Error;

/// One data-validation rule, as the Data validation dialog edits it.
#[derive(Debug, Clone, Default, TS)]
#[ts(
    file_name = "data_validation_spec.ts",
    builder,
    rename_all = "camelCase"
)]
pub struct DataValidationSpec {
    /// An `ST_DataValidationType` other than `none`: `whole`, `decimal`,
    /// `list`, `date`, `time`, `textLength` or `custom`.
    pub ty: String,
    /// An `ST_DataValidationOperator` (`between`, `greaterThan`, …). Ignored by
    /// `list` and `custom`.
    pub operator: String,
    /// Formulas WITHOUT a leading `=`, written against the top-left cell of the
    /// range: a `list` takes `"a,b,c"` (quotes included) or a range such as
    /// `$D$1:$D$5`; `custom` takes the condition, e.g. `COUNTIF($A:$A,A1)=1`.
    /// Dates are serial numbers or a formula such as `DATE(2026,1,1)`.
    pub formula1: String,
    /// The upper bound for `between` / `notBetween`; empty otherwise.
    pub formula2: String,
    /// Empty cells pass. Stored for Excel; LogiSheets never flags a blank.
    pub allow_blank: bool,
    /// Show the dropdown arrow on a `list` cell. (OOXML stores the inverse.)
    pub in_cell_dropdown: bool,
    /// `stop` refuses the value, `warning` and `information` let it through
    /// with a notice. Only consulted when the host enforces at input time.
    pub error_style: String,
    pub error_title: String,
    /// Shown when a value is refused; empty for a generic message.
    pub error: String,
    pub prompt_title: String,
    /// Shown when the cell is selected; empty for none.
    pub prompt: String,
}

fn text(s: &str) -> Option<PlainTextString> {
    let s = s.trim().trim_start_matches('=').trim();
    (!s.is_empty()).then(|| PlainTextString {
        value: s.to_string(),
        space: None,
    })
}

fn opt(s: &str) -> Option<String> {
    (!s.is_empty()).then(|| s.to_string())
}

/// Check a spec and build the OOXML rule. `sqref` is left empty: the ranges a
/// rule covers are held as anchors and rendered at save.
pub fn spec_to_rule(spec: &DataValidationSpec) -> Result<CtDataValidation, Error> {
    let bad = |what: &str| Error::PayloadError(format!("data validation: {what}"));
    let ty = StDataValidationType::deserialize(&spec.ty)
        .map_err(|_| bad(&format!("unknown type `{}`", spec.ty)))?;
    if matches!(ty, StDataValidationType::None) {
        return Err(bad("type `none` is a cleared rule; send no rule instead"));
    }
    let operator = if spec.operator.is_empty() {
        StDataValidationOperator::Between
    } else {
        StDataValidationOperator::deserialize(&spec.operator)
            .map_err(|_| bad(&format!("unknown operator `{}`", spec.operator)))?
    };
    let error_style = if spec.error_style.is_empty() {
        StDataValidationErrorStyle::Stop
    } else {
        StDataValidationErrorStyle::deserialize(&spec.error_style)
            .map_err(|_| bad(&format!("unknown error style `{}`", spec.error_style)))?
    };
    let formula1 = text(&spec.formula1);
    if formula1.is_none() {
        return Err(bad("formula1 is required"));
    }
    let ranged = !matches!(
        ty,
        StDataValidationType::List | StDataValidationType::Custom
    );
    let two = matches!(
        operator,
        StDataValidationOperator::Between | StDataValidationOperator::NotBetween
    );
    let formula2 = if ranged && two {
        Some(text(&spec.formula2).ok_or_else(|| bad("`between` needs formula2"))?)
    } else {
        None
    };
    Ok(CtDataValidation {
        formula1,
        formula2,
        ty,
        error_style,
        ime_mode: StDataValidationImeMode::NoControl,
        operator,
        allow_blank: spec.allow_blank,
        show_drop_down: !spec.in_cell_dropdown,
        show_input_message: !spec.prompt.is_empty() || !spec.prompt_title.is_empty(),
        // Excel only enforces at input time when this is set; the dialog's
        // "Stop" means exactly that, so it is always on for authored rules.
        show_error_message: true,
        error_title: opt(&spec.error_title),
        error: opt(&spec.error),
        prompt_title: opt(&spec.prompt_title),
        prompt: opt(&spec.prompt),
        sqref: String::new(),
    })
}

/// The inverse of [`spec_to_rule`], for prefilling the dialog.
pub fn rule_to_spec(rule: &CtDataValidation) -> DataValidationSpec {
    let f = |p: &Option<PlainTextString>| p.as_ref().map(|t| t.value.clone()).unwrap_or_default();
    DataValidationSpec {
        ty: rule.ty.serialize(),
        operator: rule.operator.serialize(),
        formula1: f(&rule.formula1),
        formula2: f(&rule.formula2),
        allow_blank: rule.allow_blank,
        in_cell_dropdown: !rule.show_drop_down,
        error_style: rule.error_style.serialize(),
        error_title: rule.error_title.clone().unwrap_or_default(),
        error: rule.error.clone().unwrap_or_default(),
        prompt_title: rule.prompt_title.clone().unwrap_or_default(),
        prompt: rule.prompt.clone().unwrap_or_default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn whole_between() -> DataValidationSpec {
        DataValidationSpec {
            ty: "whole".into(),
            operator: "between".into(),
            formula1: "=1".into(),
            formula2: "100".into(),
            allow_blank: true,
            in_cell_dropdown: true,
            error_style: "stop".into(),
            error: "1 to 100 only".into(),
            ..Default::default()
        }
    }

    #[test]
    fn round_trips_through_ooxml() {
        let rule = spec_to_rule(&whole_between()).unwrap();
        // A leading `=` is accepted and dropped, as Excel stores operands.
        assert_eq!(rule.formula1.as_ref().unwrap().value, "1");
        assert!(!rule.show_drop_down, "OOXML stores the dropdown inverted");
        let back = rule_to_spec(&rule);
        assert_eq!(back.ty, "whole");
        assert_eq!(back.formula1, "1");
        assert_eq!(back.formula2, "100");
        assert_eq!(back.error, "1 to 100 only");
        assert!(back.in_cell_dropdown);
    }

    #[test]
    fn refuses_what_excel_would_not_save() {
        let mut s = whole_between();
        s.formula2 = String::new();
        assert!(spec_to_rule(&s).is_err(), "between without an upper bound");
        s.ty = "none".into();
        assert!(spec_to_rule(&s).is_err());
        s.ty = "list".into();
        s.formula1 = String::new();
        assert!(spec_to_rule(&s).is_err(), "a list with no source");
    }

    #[test]
    fn a_list_ignores_the_operator_bounds() {
        let s = DataValidationSpec {
            ty: "list".into(),
            formula1: "\"Yes,No\"".into(),
            ..Default::default()
        };
        let rule = spec_to_rule(&s).unwrap();
        assert!(rule.formula2.is_none());
    }
}
