//! Translate an Excel data-validation rule into a boolean formula the shadow
//! cell can evaluate. The formula uses `#PLACEHOLDER` for the validated cell
//! and returns TRUE when the value is valid, FALSE when invalid.
//!
//! Because shadows are only installed on non-empty cells, `allowBlank` is a
//! no-op here (empty cells never get a shadow). `custom` is not yet supported
//! (its formula1 references shift relative to the sqref anchor — deferred).

use logisheets_workbook::prelude::{
    CtDataValidation, StDataValidationOperator as Op, StDataValidationType as Ty,
};

const P: &str = "#PLACEHOLDER";

/// Returns the formula body (WITHOUT a leading `=`), or `None` for rule types
/// we don't translate (`none`, `custom`, or missing operands).
pub fn rule_to_formula(dv: &CtDataValidation) -> Option<String> {
    let f1 = dv.formula1.as_ref().map(|s| s.value.trim().to_string());
    let f2 = dv.formula2.as_ref().map(|s| s.value.trim().to_string());

    match dv.ty {
        Ty::List => {
            let src = f1?;
            if src.len() >= 2 && src.starts_with('"') && src.ends_with('"') {
                // Inline comma-separated literals: "Apple,Banana,Cherry".
                let inner = &src[1..src.len() - 1];
                let items: Vec<&str> = inner.split(',').map(|s| s.trim()).collect();
                if items.is_empty() {
                    return None;
                }
                let terms: Vec<String> = items
                    .iter()
                    .map(|it| format!("{P}=\"{}\"", it.replace('"', "\"\"")))
                    .collect();
                Some(format!("OR({})", terms.join(",")))
            } else {
                // A range / named range reference.
                Some(format!("COUNTIF({src},{P})>0"))
            }
        }
        Ty::Whole => {
            let cmp = numeric_cmp(P, dv.operator, &f1?, f2.as_deref())?;
            Some(format!("AND(ISNUMBER({P}),INT({P})={P},{cmp})"))
        }
        Ty::Decimal | Ty::Date | Ty::Time => {
            let cmp = numeric_cmp(P, dv.operator, &f1?, f2.as_deref())?;
            Some(format!("AND(ISNUMBER({P}),{cmp})"))
        }
        Ty::TextLength => {
            let len_expr = format!("LEN({P})");
            numeric_cmp(&len_expr, dv.operator, &f1?, f2.as_deref())
        }
        // `none` and `custom` are not translated (yet).
        Ty::None | Ty::Custom => None,
    }
}

/// Build a comparison of `expr` against the operands per the operator.
/// `between`/`notBetween` need `f2`.
fn numeric_cmp(expr: &str, op: Op, f1: &str, f2: Option<&str>) -> Option<String> {
    let s = match op {
        Op::Between => format!("AND({expr}>={f1},{expr}<={f})", f = f2?),
        Op::NotBetween => format!("OR({expr}<{f1},{expr}>{f})", f = f2?),
        Op::Equal => format!("{expr}={f1}"),
        Op::NotEqual => format!("{expr}<>{f1}"),
        Op::GreaterThan => format!("{expr}>{f1}"),
        Op::LessThan => format!("{expr}<{f1}"),
        Op::GreaterThanOrEqual => format!("{expr}>={f1}"),
        Op::LessThanOrEqual => format!("{expr}<={f1}"),
    };
    Some(s)
}

#[cfg(test)]
mod tests {
    use super::*;
    use logisheets_workbook::prelude::{
        PlainTextString, StDataValidationErrorStyle, StDataValidationImeMode,
    };

    fn dv(ty: Ty, op: Op, f1: Option<&str>, f2: Option<&str>) -> CtDataValidation {
        CtDataValidation {
            formula1: f1.map(|s| PlainTextString {
                value: s.to_string(),
                space: None,
            }),
            formula2: f2.map(|s| PlainTextString {
                value: s.to_string(),
                space: None,
            }),
            ty,
            error_style: StDataValidationErrorStyle::Stop,
            ime_mode: StDataValidationImeMode::NoControl,
            operator: op,
            blank: true,
            show_drop_down: false,
            show_input_message: false,
            show_error_message: false,
            prompt_title: None,
            prompt: None,
            sqref: "A1".to_string(),
        }
    }

    #[test]
    fn list_inline() {
        let f = rule_to_formula(&dv(Ty::List, Op::Between, Some("\"a,b,c\""), None)).unwrap();
        assert_eq!(
            f,
            "OR(#PLACEHOLDER=\"a\",#PLACEHOLDER=\"b\",#PLACEHOLDER=\"c\")"
        );
    }

    #[test]
    fn list_range() {
        let f = rule_to_formula(&dv(Ty::List, Op::Between, Some("$D$1:$D$5"), None)).unwrap();
        assert_eq!(f, "COUNTIF($D$1:$D$5,#PLACEHOLDER)>0");
    }

    #[test]
    fn whole_between() {
        let f = rule_to_formula(&dv(Ty::Whole, Op::Between, Some("1"), Some("100"))).unwrap();
        assert_eq!(
            f,
            "AND(ISNUMBER(#PLACEHOLDER),INT(#PLACEHOLDER)=#PLACEHOLDER,AND(#PLACEHOLDER>=1,#PLACEHOLDER<=100))"
        );
    }

    #[test]
    fn decimal_ge() {
        let f = rule_to_formula(&dv(Ty::Decimal, Op::GreaterThanOrEqual, Some("0"), None)).unwrap();
        assert_eq!(f, "AND(ISNUMBER(#PLACEHOLDER),#PLACEHOLDER>=0)");
    }

    #[test]
    fn text_length_lte() {
        let f =
            rule_to_formula(&dv(Ty::TextLength, Op::LessThanOrEqual, Some("10"), None)).unwrap();
        assert_eq!(f, "LEN(#PLACEHOLDER)<=10");
    }

    #[test]
    fn custom_and_none_unsupported() {
        assert!(
            rule_to_formula(&dv(Ty::Custom, Op::Between, Some("ISNUMBER(A1)"), None)).is_none()
        );
        assert!(rule_to_formula(&dv(Ty::None, Op::Between, None, None)).is_none());
    }

    #[test]
    fn between_without_f2_is_none() {
        assert!(rule_to_formula(&dv(Ty::Whole, Op::Between, Some("1"), None)).is_none());
    }
}
