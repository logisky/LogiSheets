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
    /// A decimal literal, kept as mantissa and scale so the printed text and
    /// the reference value come from the same place. Integers alone left the
    /// small-magnitude range almost unexplored: the `10/2*5` precedence bug was
    /// found here, but the "treat a small divisor as zero" bug was not, because
    /// reaching a small number took an expression like `7^(-12)` that the
    /// generator produced only by luck.
    Dec { mantissa: i64, scale: u32 },
    Neg(Box<Expr>),
    Bin(Op, Box<Expr>, Box<Expr>),
    /// A call to a pure numeric function. The ones chosen are those where the
    /// obvious implementation disagrees with Excel: `INT` floors rather than
    /// truncates, `MOD` takes the sign of its divisor, and `ROUND` goes half
    /// away from zero rather than to even.
    Call(Func, Vec<Expr>),
}

#[derive(Debug, Clone, Copy)]
enum Func {
    Abs,
    Int,
    Mod,
    Round,
    Power,
    Min,
    Max,
    Sum,
}

impl Func {
    fn name(self) -> &'static str {
        match self {
            Func::Abs => "ABS",
            Func::Int => "INT",
            Func::Mod => "MOD",
            Func::Round => "ROUND",
            Func::Power => "POWER",
            Func::Min => "MIN",
            Func::Max => "MAX",
            Func::Sum => "SUM",
        }
    }

    /// How many arguments to generate. Fixed where Excel fixes it.
    fn arity(self) -> (usize, usize) {
        match self {
            Func::Abs | Func::Int => (1, 1),
            Func::Mod | Func::Power => (2, 2),
            Func::Round => (2, 2),
            Func::Min | Func::Max | Func::Sum => (1, 3),
        }
    }
}

/// What the reference says an expression evaluates to, errors included.
///
/// The differential test above skips every non-finite result, which means the
/// error paths — a division by zero, and how it travels up through the
/// expression that contains it — had no automated coverage at all. Spreadsheet
/// error propagation is fiddly and worth checking: an error is not a number, and
/// an operator applied to one yields the error rather than a value.
#[derive(Debug, Clone, Copy, PartialEq)]
enum RefValue {
    Num(f64),
    Div0,
    /// `#NUM!` — a result outside the representable range, or an undefined power.
    NumErr,
}

impl RefValue {
    fn as_num(self) -> Option<f64> {
        match self {
            RefValue::Num(n) => Some(n),
            _ => None,
        }
    }
}

fn eval_checked(e: &Expr) -> RefValue {
    let finite = |x: f64| {
        if x.is_finite() {
            RefValue::Num(x)
        } else {
            RefValue::NumErr
        }
    };
    match e {
        Expr::Num(n) => RefValue::Num(*n as f64),
        Expr::Dec { mantissa, scale } => RefValue::Num(Expr::dec_value(*mantissa, *scale)),
        Expr::Neg(x) => match eval_checked(x) {
            RefValue::Num(v) => RefValue::Num(-v),
            other => other,
        },
        Expr::Bin(op, l, r) => {
            // An error in either operand is the answer: this is the propagation
            // the test exists for.
            let a = match eval_checked(l) {
                RefValue::Num(v) => v,
                other => return other,
            };
            let b = match eval_checked(r) {
                RefValue::Num(v) => v,
                other => return other,
            };
            match op {
                Op::Add => finite(a + b),
                Op::Sub => finite(a - b),
                Op::Mul => finite(a * b),
                Op::Div => {
                    if b == 0.0 {
                        RefValue::Div0
                    } else {
                        finite(a / b)
                    }
                }
                Op::Pow => finite(a.powf(b)),
            }
        }
        Expr::Call(f, args) => {
            let mut vals = Vec::with_capacity(args.len());
            for a in args {
                match eval_checked(a) {
                    RefValue::Num(v) => vals.push(v),
                    other => return other,
                }
            }
            if matches!(f, Func::Mod) && vals.get(1) == Some(&0.0) {
                return RefValue::Div0;
            }
            match eval_call(*f, &vals) {
                Some(v) => finite(v),
                None => RefValue::NumErr,
            }
        }
    }
}

/// Excel's ROUND, as scaled-integer arithmetic over the number's decimal form.
///
/// Not `(a * 10^d).round() / 10^d`: that decides the halfway case on the binary
/// double, so `ROUND(4.935,2)` comes out 4.93 where Excel says 4.94 — as a
/// double 4.935 is 4.93499999999999961, which Excel never sees because it keeps
/// 15 significant decimal digits. It also inherits the error of the scaling
/// multiply, whose direction depends on how the value was computed.
///
/// So: read the 15 significant digits as an integer mantissa with an exponent,
/// then round by integer division, half away from zero. Deliberately a
/// different formulation from the engine's (which carries over a digit string),
/// so agreement is not two copies of one mistake.
fn excel_round(a: f64, digits: i32) -> Option<f64> {
    if !a.is_finite() {
        return None;
    }
    if a == 0.0 {
        return Some(a);
    }
    let neg = a < 0.0;
    let s = format!("{:.14e}", a.abs());
    let (mantissa, exp) = s.split_once('e')?;
    let exp: i32 = exp.parse().ok()?;
    // 15 digits, so `value = m * 10^(exp - 14)`.
    let m: i128 = mantissa
        .bytes()
        .filter(u8::is_ascii_digit)
        .map(|b| (b - b'0') as i128)
        .fold(0, |acc, d| acc * 10 + d);

    // We want `round(value * 10^digits)` as an integer.
    let shift = exp - 14 + digits;
    let scaled = if shift >= 0 {
        // Already an integer at this scale; nothing to decide.
        m.checked_mul(10i128.checked_pow(u32::try_from(shift).ok()?)?)?
    } else {
        let p = 10i128.checked_pow(u32::try_from(-shift).ok()?)?;
        // Half away from zero on non-negative integers is `(m + p/2) / p`.
        (m + p / 2) / p
    };
    let out = scaled as f64 / 10f64.powi(digits);
    if !out.is_finite() {
        return None;
    }
    Some(if neg { -out } else { out })
}

/// Reference semantics, written from Excel's documented behaviour and nothing
/// else. `None` means the call has no numeric answer (Excel returns an error),
/// which the caller skips rather than guesses at.
fn eval_call(f: Func, args: &[f64]) -> Option<f64> {
    match f {
        Func::Abs => Some(args[0].abs()),
        // Toward negative infinity, so INT(-1.5) is -2 — not -1, which is what
        // truncation gives.
        Func::Int => Some(args[0].floor()),
        Func::Mod => {
            let (a, b) = (args[0], args[1]);
            if b == 0.0 {
                return None;
            }
            // Excel's MOD carries the sign of the DIVISOR: MOD(-3,2) is 1, while
            // Rust's `%` gives -1.
            Some(a - b * (a / b).floor())
        }
        Func::Round => {
            let (a, digits) = (args[0], args[1]);
            let d = digits.trunc();
            if !(-10.0..=10.0).contains(&d) {
                return None;
            }
            excel_round(a, d as i32)
        }
        Func::Power => {
            let r = args[0].powf(args[1]);
            if r.is_finite() {
                Some(r)
            } else {
                None
            }
        }
        Func::Min => args.iter().copied().reduce(f64::min),
        Func::Max => args.iter().copied().reduce(f64::max),
        Func::Sum => Some(args.iter().sum()),
    }
}

impl Expr {
    fn dec_value(mantissa: i64, scale: u32) -> f64 {
        // The engine parses the same decimal text, so both sides land on the
        // same f64 — as long as the reference derives its value the same way and
        // does not, say, accumulate it by addition.
        mantissa as f64 / 10f64.powi(scale as i32)
    }
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

/// The reference value as a plain `f64`, with an error becoming NaN.
///
/// Deliberately delegating to `eval_checked` rather than recursing separately.
/// The earlier version propagated nothing: an overflow became NaN, and
/// `f64::min(NaN, 1.0)` is `1.0`, so `MIN(POWER(5,441),1)` came out as a number
/// while the engine correctly reported `#NUM!`. The differential test reported
/// that as an engine bug. Two reference evaluators that disagree with each other
/// are worse than one.
fn eval(e: &Expr) -> f64 {
    eval_checked(e).as_num().unwrap_or(f64::NAN)
}

fn prec(e: &Expr) -> u8 {
    match e {
        Expr::Num(_) | Expr::Dec { .. } | Expr::Call(..) => 100,
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
        Expr::Dec { mantissa, scale } => {
            if *scale == 0 {
                mantissa.to_string()
            } else {
                let sign = if *mantissa < 0 { "-" } else { "" };
                let m = mantissa.unsigned_abs().to_string();
                let w = *scale as usize + 1;
                let m = format!("{:0>width$}", m, width = w);
                let split = m.len() - *scale as usize;
                format!("{}{}.{}", sign, &m[..split], &m[split..])
            }
        }
        Expr::Call(f, args) => {
            let inner: Vec<String> = args.iter().map(print).collect();
            format!("{}({})", f.name(), inner.join(","))
        }
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

// ─── Comparisons ──────────────────────────────────────────────────────────
//
// Kept as a separate top-level shape rather than another `Expr` variant: a
// comparison yields a boolean, and letting one nest inside arithmetic would drag
// Excel's TRUE-is-1 coercion into the reference evaluator. That coercion is worth
// testing, but not at the cost of making the reference clever — a reference that
// reasons the same way the engine does proves nothing.

#[derive(Debug, Clone, Copy)]
enum CmpOp {
    Eq,
    Ne,
    Lt,
    Gt,
    Le,
    Ge,
}

fn cmp_sym(op: CmpOp) -> &'static str {
    match op {
        CmpOp::Eq => "=",
        CmpOp::Ne => "<>",
        CmpOp::Lt => "<",
        CmpOp::Gt => ">",
        CmpOp::Le => "<=",
        CmpOp::Ge => ">=",
    }
}

#[derive(Debug, Clone)]
struct Comparison {
    op: CmpOp,
    left: Expr,
    right: Expr,
}

fn eval_cmp(c: &Comparison) -> bool {
    let (a, b) = (eval(&c.left), eval(&c.right));
    // Deliberately the plain operators. A tolerance here would reproduce
    // whatever the engine does and agree with it for the wrong reason.
    match c.op {
        CmpOp::Eq => a == b,
        CmpOp::Ne => a != b,
        CmpOp::Lt => a < b,
        CmpOp::Gt => a > b,
        CmpOp::Le => a <= b,
        CmpOp::Ge => a >= b,
    }
}

fn print_cmp(c: &Comparison) -> String {
    format!("{}{}{}", print(&c.left), cmp_sym(c.op), print(&c.right))
}

fn arb_cmp() -> impl Strategy<Value = Comparison> {
    let op = prop_oneof![
        Just(CmpOp::Eq),
        Just(CmpOp::Ne),
        Just(CmpOp::Lt),
        Just(CmpOp::Gt),
        Just(CmpOp::Le),
        Just(CmpOp::Ge),
    ];
    // Two shapes. Independent operands explore the ordinary cases; a NEAR pair —
    // the same expression against itself plus a tiny amount — is where an
    // equality that is really a tolerance shows up. Unrelated random operands
    // almost never land close enough to notice.
    let independent = (op.clone(), arb_expr(), arb_expr())
        .prop_map(|(op, left, right)| Comparison { op, left, right });
    let near = (op, arb_expr(), 1i64..=9, 4u32..=9).prop_map(|(op, base, m, scale)| {
        let delta = Expr::Dec {
            mantissa: m,
            scale,
        };
        Comparison {
            op,
            left: base.clone(),
            right: Expr::Bin(Op::Add, Box::new(base), Box::new(delta)),
        }
    });
    prop_oneof![independent, near]
}

fn arb_expr() -> impl Strategy<Value = Expr> {
    let leaf = prop_oneof![
        (1i64..=12).prop_map(Expr::Num),
        // Small magnitudes on purpose: that is where a tolerance mistaken for
        // zero lives.
        (1i64..=9999, 1u32..=6).prop_map(|(mantissa, scale)| Expr::Dec { mantissa, scale }),
    ];
    leaf.prop_recursive(4, 24, 2, |inner| {
        let op = prop_oneof![
            Just(Op::Add),
            Just(Op::Sub),
            Just(Op::Mul),
            Just(Op::Div),
            Just(Op::Pow),
        ];
        let func = prop_oneof![
            Just(Func::Abs),
            Just(Func::Int),
            Just(Func::Mod),
            Just(Func::Round),
            Just(Func::Power),
            Just(Func::Min),
            Just(Func::Max),
            Just(Func::Sum),
        ];
        prop_oneof![
            inner.clone().prop_map(|e| Expr::Neg(Box::new(e))),
            (op, inner.clone(), inner.clone()).prop_map(|(op, l, r)| Expr::Bin(
                op,
                Box::new(l),
                Box::new(r)
            )),
            (func, proptest::collection::vec(inner, 1..=3)).prop_map(|(f, mut args)| {
                let (lo, hi) = f.arity();
                // A generated arg list is trimmed or padded to the arity Excel
                // fixes, so the formula is well-formed by construction and the
                // test is about semantics rather than arity errors.
                while args.len() < lo {
                    args.push(Expr::Num(1));
                }
                args.truncate(hi.max(lo).min(args.len().max(lo)));
                if args.len() > hi {
                    args.truncate(hi);
                }
                // ROUND's second argument is a digit count, not a value.
                if matches!(f, Func::Round) {
                    args[1] = Expr::Num(2);
                }
                Expr::Call(f, args)
            }),
        ]
    })
}

/// The cell's value as either a number or an error string.
fn eval_value_in_engine(formula: &str) -> Option<Value> {
    let mut wb = Workbook::default();
    wb.handle_action(EditAction::Payloads(PayloadsAction::new().add_payload(
        CellInput {
            sheet_idx: 0,
            row: 0,
            col: 0,
            content: format!("={}", formula),
        },
    )));
    wb.get_sheet_by_idx(0).ok()?.get_value(0, 0).ok()
}

/// Evaluate `=<formula>`; `Some(b)` if the cell holds a boolean.
fn eval_bool_in_engine(formula: &str) -> Option<bool> {
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
        Value::Bool(b) => Some(b),
        _ => None,
    }
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

    /// A division by zero must surface as `#DIV/0!`, and must travel up through
    /// whatever contains it.
    ///
    /// The differential test above assumes a finite result, so it never sees an
    /// error. That left the propagation rules — an operator applied to an error
    /// yields the error, not a number — with no coverage. The generator plants a
    /// `/0` somewhere inside an ordinary expression, which is how a real one
    /// arises.
    #[test]
    fn division_by_zero_propagates(
        e in arb_expr(),
        side in prop::bool::ANY,
    ) {
        // Graft `x/0` into one side of an addition, so the error has to travel
        // through at least one operator to reach the top.
        let zero_div = Expr::Bin(
            Op::Div,
            Box::new(Expr::Num(1)),
            Box::new(Expr::Num(0)),
        );
        // The other operand has to be an ordinary number, or IT decides the
        // answer: an operand that overflows makes the result `#NUM!`, and which
        // error wins is a question about evaluation order rather than about
        // propagation.
        prop_assume!(matches!(eval_checked(&e), RefValue::Num(_)));
        let planted = if side {
            Expr::Bin(Op::Add, Box::new(zero_div), Box::new(e))
        } else {
            Expr::Bin(Op::Add, Box::new(e), Box::new(zero_div))
        };
        prop_assert_eq!(
            eval_checked(&planted),
            RefValue::Div0,
            "the reference should see a division by zero"
        );
        let formula = print(&planted);
        match eval_value_in_engine(&formula) {
            Some(Value::Error(msg)) => prop_assert!(
                msg.contains("DIV/0"),
                "=[{}] : expected #DIV/0!, got error {:?}",
                formula, msg
            ),
            other => prop_assert!(
                false,
                "=[{}] : expected #DIV/0! to propagate, got {:?}",
                formula, other
            ),
        }
    }

    /// Wherever the reference lands on a definite error, the engine must too —
    /// and where it lands on a number, the engine must not produce an error.
    /// Disagreeing about WHETHER something is an error is as wrong as
    /// disagreeing about a value.
    #[test]
    fn engine_and_reference_agree_on_being_an_error(e in arb_expr()) {
        let expected = eval_checked(&e);
        let formula = print(&e);
        let got = eval_value_in_engine(&formula);
        match (expected, got) {
            (RefValue::Num(n), Some(Value::Number(g))) => {
                prop_assume!(n.abs() < 1e10);
                let tol = 1e-6 * n.abs().max(1.0);
                prop_assert!(
                    (g - n).abs() <= tol,
                    "=[{}] : engine {} != reference {}", formula, g, n
                );
            }
            (RefValue::Div0, Some(Value::Error(msg))) => prop_assert!(
                msg.contains("DIV/0"),
                "=[{}] : reference says #DIV/0!, engine says {:?}", formula, msg
            ),
            // `#NUM!` covers a family of out-of-range outcomes and engines differ
            // on which one they report; agreeing that it IS an error is the
            // property worth asserting.
            (RefValue::NumErr, Some(Value::Error(_))) => {}
            (RefValue::NumErr, Some(Value::Number(_))) => {}
            (expected, got) => prop_assert!(
                false,
                "=[{}] : reference {:?} vs engine {:?}", formula, expected, got
            ),
        }
    }

    /// The engine must agree with plain `==`/`<`/`>` on comparisons, including
    /// when the two sides differ by very little. A tolerance applied here reads
    /// two distinct numbers as equal — the mistake this covers.
    #[test]
    fn engine_matches_reference_on_comparisons(c in arb_cmp()) {
        let (a, b) = (eval(&c.left), eval(&c.right));
        prop_assume!(a.is_finite() && b.is_finite() && a.abs() < 1e10 && b.abs() < 1e10);
        let expected = eval_cmp(&c);
        let formula = print_cmp(&c);
        match eval_bool_in_engine(&formula) {
            Some(got) => prop_assert!(
                got == expected,
                "=[{}] : engine {} != reference {} (lhs {:e}, rhs {:e}, diff {:e})",
                formula, got, expected, a, b, b - a
            ),
            None => prop_assert!(
                false,
                "=[{}] : engine returned a non-boolean, reference {}",
                formula, expected
            ),
        }
    }

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

/// A test that passes because nothing reached its assertion proves nothing.
/// This samples the generator and reports what actually gets exercised, so a
/// silent collapse in coverage — every call filtered out as non-finite, say —
/// fails here rather than hiding behind a green differential test.
#[test]
fn generator_actually_exercises_calls_and_decimals() {
    use proptest::strategy::{Strategy, ValueTree};
    use proptest::test_runner::TestRunner;

    let mut runner = TestRunner::deterministic();
    let strategy = arb_expr();
    let (mut calls, mut decimals, mut comparable, total) = (0, 0, 0, 600);
    let mut seen_funcs = std::collections::HashSet::new();
    for _ in 0..total {
        let tree = strategy.new_tree(&mut runner).expect("a value");
        let e = tree.current();
        fn walk(
            e: &Expr,
            calls: &mut usize,
            decimals: &mut usize,
            funcs: &mut std::collections::HashSet<&'static str>,
        ) {
            match e {
                Expr::Dec { .. } => *decimals += 1,
                Expr::Call(f, args) => {
                    *calls += 1;
                    funcs.insert(f.name());
                    for a in args {
                        walk(a, calls, decimals, funcs);
                    }
                }
                Expr::Neg(x) => walk(x, calls, decimals, funcs),
                Expr::Bin(_, l, r) => {
                    walk(l, calls, decimals, funcs);
                    walk(r, calls, decimals, funcs);
                }
                Expr::Num(_) => {}
            }
        }
        walk(&e, &mut calls, &mut decimals, &mut seen_funcs);
        let v = eval(&e);
        if v.is_finite() && v.abs() < 1e10 {
            comparable += 1;
        }
    }
    eprintln!(
        "of {total} samples: {calls} calls, {decimals} decimal literals, \
         {comparable} reached the assertion; functions seen: {:?}",
        {
            let mut v: Vec<&str> = seen_funcs.iter().copied().collect();
            v.sort_unstable();
            v
        }
    );
    assert!(calls > 100, "too few calls generated: {calls}");
    assert!(decimals > 100, "too few decimal literals: {decimals}");
    assert!(
        comparable > total / 3,
        "only {comparable} of {total} samples were comparable — the differential \
         test is mostly filtering itself out"
    );
    assert_eq!(seen_funcs.len(), 8, "not every function is being generated");
}
