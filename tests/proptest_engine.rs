// Property-based tests for the calc engine.
//
// (1) Expression differential: generate random arithmetic expressions, evaluate
//     them with a reference evaluator that encodes Excel's operator semantics
//     (precedence, left-associativity incl. `^`, unary-minus tighter than `^`),
//     print them with minimal parentheses, feed the string to the engine, and
//     assert the engine's number matches the reference. This is the automated
//     complement to the hand-written tests/operators/ suite — it explores
//     precedence/associativity combinations no human enumerates, and is aimed at
//     the class of bug the `10/2*5` precedence error belonged to.
//
// (4) Panic-safety ("fuzzing on stable"): arbitrary formula text and arbitrary
//     bytes fed to the .xlsx loader must never PANIC (the engine may return an
//     error value / Err, but a panic on untrusted input is a DoS). proptest
//     unwinds and shrinks any panic to a minimal reproducer. For coverage-guided
//     fuzzing see fuzz/ (needs `cargo +nightly fuzz`).

use logisheets::{EditAction, Value, Workbook};
use logisheets_controller::edit_action::{CellInput, PayloadsAction};
use proptest::prelude::*;

// ─── Reference expression model (Excel semantics) ──────────────────────────

#[derive(Debug, Clone, Copy)]
enum Op {
    Add,
    Sub,
    Mul,
    Div,
    Pow,
}

#[derive(Debug, Clone)]
enum Expr {
    Num(i64),
    Neg(Box<Expr>),
    Bin(Op, Box<Expr>, Box<Expr>),
}

// Binding tightness (higher = tighter). Excel: unary minus > `^` > `*`/`/` >
// `+`/`-`. All binary operators here are LEFT-associative (including `^`, which
// is Excel-specific — ordinary math makes `^` right-associative).
const NEG_PREC: u8 = 5;
fn op_prec(op: Op) -> u8 {
    match op {
        Op::Add | Op::Sub => 2,
        Op::Mul | Op::Div => 3,
        Op::Pow => 4,
    }
}
fn op_sym(op: Op) -> char {
    match op {
        Op::Add => '+',
        Op::Sub => '-',
        Op::Mul => '*',
        Op::Div => '/',
        Op::Pow => '^',
    }
}

fn eval(e: &Expr) -> f64 {
    match e {
        Expr::Num(n) => *n as f64,
        Expr::Neg(x) => -eval(x),
        Expr::Bin(op, l, r) => {
            let (a, b) = (eval(l), eval(r));
            match op {
                Op::Add => a + b,
                Op::Sub => a - b,
                Op::Mul => a * b,
                Op::Div => a / b,
                Op::Pow => a.powf(b),
            }
        }
    }
}

fn prec(e: &Expr) -> u8 {
    match e {
        Expr::Num(_) => 100,
        Expr::Neg(_) => NEG_PREC,
        Expr::Bin(op, _, _) => op_prec(*op),
    }
}

// Print with the MINIMUM parentheses the precedence/associativity rules require,
// so the emitted string exercises the engine's own precedence handling. A `Neg`
// operand is always parenthesized to avoid `^-`/`*-` lexer edge cases (those are
// covered explicitly in tests/operators/, not fuzzed here).
fn print(e: &Expr) -> String {
    match e {
        Expr::Num(n) => n.to_string(),
        Expr::Neg(x) => {
            let s = print(x);
            if prec(x) < NEG_PREC {
                format!("-({})", s)
            } else {
                format!("-{}", s)
            }
        }
        Expr::Bin(op, l, r) => {
            let p = op_prec(*op);
            let paren = |child: &Expr, right: bool| {
                let s = print(child);
                let needs = matches!(child, Expr::Neg(_))
                    || prec(child) < p
                    // right operand of a left-associative op with equal prec
                    || (right && prec(child) == p);
                if needs { format!("({})", s) } else { s }
            };
            format!("{}{}{}", paren(l, false), op_sym(*op), paren(r, true))
        }
    }
}

fn arb_expr() -> impl Strategy<Value = Expr> {
    let leaf = (1i64..=12).prop_map(Expr::Num);
    leaf.prop_recursive(4, 24, 2, |inner| {
        let op = prop_oneof![
            Just(Op::Add),
            Just(Op::Sub),
            Just(Op::Mul),
            Just(Op::Div),
            Just(Op::Pow),
        ];
        prop_oneof![
            inner.clone().prop_map(|e| Expr::Neg(Box::new(e))),
            (op, inner.clone(), inner).prop_map(|(op, l, r)| Expr::Bin(
                op,
                Box::new(l),
                Box::new(r)
            )),
        ]
    })
}

// Evaluate `=<formula>` in a fresh workbook; Some(n) if the cell holds a number.
fn eval_in_engine(formula: &str) -> Option<f64> {
    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
        CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: format!("={}", formula),
        },
    )));
    match wb.get_sheet_by_idx(0).ok()?.get_value(0, 0).ok()? {
        Value::Number(n) => Some(n),
        _ => None,
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(400))]

    // (1) The engine must agree with the reference evaluator on random expressions.
    #[test]
    fn engine_matches_reference(e in arb_expr()) {
        let expected = eval(&e);
        // Skip non-finite / huge results (division by zero, overflow, negative^
        // fractional): the reference and engine both go out of the comparable
        // range there, and those error paths are covered elsewhere.
        prop_assume!(expected.is_finite() && expected.abs() < 1e10);
        let formula = print(&e);
        match eval_in_engine(&formula) {
            Some(got) => {
                let tol = 1e-6 * expected.abs().max(1.0);
                prop_assert!(
                    (got - expected).abs() <= tol,
                    "=[{}] : engine {} != reference {}",
                    formula, got, expected
                );
            }
            None => prop_assert!(
                false,
                "=[{}] : engine returned a non-number, reference {}",
                formula, expected
            ),
        }
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(600))]

    // (4a) Arbitrary formula text must never panic the engine.
    #[test]
    fn arbitrary_formula_never_panics(s in ".{0,48}") {
        let mut wb = Workbook::default();
        wb.handle_action(EditAction::Payloads(
            PayloadsAction::new().add_payload(CellInput {
                sheet_idx: 0,
                row: 0,
                col: 0,
                content: format!("={}", s),
            }),
        ));
        // Reading the result must also not panic.
        if let Ok(ws) = wb.get_sheet_by_idx(0) {
            let _ = ws.get_value(0, 0);
        }
    }

    // (4b) Arbitrary bytes to the .xlsx loader must return Err, never panic
    // (this is the untrusted-upload path).
    #[test]
    fn arbitrary_bytes_never_panic_xlsx(
        bytes in proptest::collection::vec(any::<u8>(), 0..4096)
    ) {
        let _ = Workbook::from_file(&bytes, "fuzz".to_string());
    }
}
