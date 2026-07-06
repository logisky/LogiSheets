#![no_main]
#![no_std]

extern crate alloc;

use alloc::string::{String, ToString};
use alloc::vec::Vec;

use logisheets_zk_core::smt::verify_proof;
use logisheets_zk_core::{PrivateInputs, PublicInputs};
use logisheets_zk_math::finance;
use risc0_zkvm::guest::env;

risc0_zkvm::guest::entry!(main);

/// A simple AST node for v1 formulas. Supports references, numbers, and named function calls.
#[derive(Clone, Debug)]
enum Node {
    Ref(String),
    Number(f64),
    Call(String, Vec<Node>),
}

fn main() {
    let private: PrivateInputs = env::read();
    let public: PublicInputs = env::read();

    // 1. Verify each formula is included in the committed SMT root.
    for fp in &private.formulas_with_proofs {
        let commitment = fp.formula.commitment();
        verify_proof(
            &public.formula_root,
            &fp.formula.id,
            &commitment,
            &fp.proof,
        );
    }

    // 2. Merge public and private values into one lookup table.
    let mut values: hashbrown::HashMap<String, f64> = hashbrown::HashMap::new();
    for (k, v) in &public.values {
        values.insert(k.clone(), *v);
    }
    for (k, v) in &private.values {
        values.insert(k.clone(), *v);
    }

    // 3. Execute each formula and store outputs by name.
    let mut outputs: Vec<(String, f64)> = Vec::new();
    for fp in &private.formulas_with_proofs {
        let name = &fp.formula.name;
        let ast = parse_formula(&fp.formula.expression);
        let result = eval_node(&ast, &values);
        outputs.push((name.clone(), result));
    }

    // 4. Commit public outputs in deterministic order.
    env::commit(&public.formula_root);
    for out_def in &public.expected_outputs {
        let value = outputs
            .iter()
            .find(|(name, _)| name == &out_def.name)
            .map(|(_, v)| *v)
            .unwrap_or(0.0);
        env::commit(&(out_def.name.clone(), value));
    }
}

fn parse_formula(expr: &str) -> Node {
    let trimmed = expr.trim();
    if trimmed.starts_with('=') {
        return parse_formula(&trimmed[1..]);
    }

    if let Ok(n) = trimmed.parse::<f64>() {
        return Node::Number(n);
    }

    if let Some(paren) = trimmed.find('(') {
        let name = trimmed[..paren].trim().to_uppercase();
        let args_end = trimmed.rfind(')').unwrap_or(trimmed.len());
        let args_str = &trimmed[paren + 1..args_end];
        let args = split_args(args_str)
            .into_iter()
            .map(|s| parse_formula(&s))
            .collect();
        return Node::Call(name, args);
    }

    Node::Ref(trimmed.to_string())
}

fn split_args(s: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut depth = 0;
    for c in s.chars() {
        match c {
            '(' => {
                depth += 1;
                current.push(c);
            }
            ')' => {
                depth -= 1;
                current.push(c);
            }
            ',' if depth == 0 => {
                result.push(current.trim().to_string());
                current.clear();
            }
            _ => current.push(c),
        }
    }
    if !current.trim().is_empty() {
        result.push(current.trim().to_string());
    }
    result
}

fn eval_node(node: &Node, values: &hashbrown::HashMap<String, f64>) -> f64 {
    match node {
        Node::Number(n) => *n,
        Node::Ref(name) => *values.get(name).unwrap_or(&0.0),
        Node::Call(name, args) => eval_call(name, args, values),
    }
}

fn eval_call(name: &str, args: &[Node], values: &hashbrown::HashMap<String, f64>) -> f64 {
    match name {
        "SUM" => args.iter().map(|a| eval_node(a, values)).sum(),
        "NPV" => {
            let rate = eval_node(&args[0], values);
            let cashflows: Vec<f64> = args[1..].iter().map(|a| eval_node(a, values)).collect();
            finance::calc_npv(rate, &cashflows)
        }
        "IRR" => {
            let cashflows: Vec<f64> = args.iter().map(|a| eval_node(a, values)).collect();
            finance::calc_irr(&cashflows, None).unwrap_or(f64::NAN)
        }
        "FV" => {
            let rate = eval_node(&args[0], values);
            let nper = eval_node(&args[1], values);
            let pmt = eval_node(&args[2], values);
            let pv = eval_node(&args[3], values);
            let beginning = args.get(4).map(|a| eval_node(a, values) != 0.0).unwrap_or(false);
            finance::calc_fv(rate, nper, pmt, pv, beginning)
        }
        "PV" => {
            let rate = eval_node(&args[0], values);
            let nper = eval_node(&args[1], values);
            let pmt = eval_node(&args[2], values);
            let fv = eval_node(&args[3], values);
            let beginning = args.get(4).map(|a| eval_node(a, values) != 0.0).unwrap_or(false);
            finance::calc_pv(rate, nper, pmt, fv, beginning)
        }
        "PMT" => {
            let rate = eval_node(&args[0], values);
            let nper = eval_node(&args[1], values) as usize;
            let pv = eval_node(&args[2], values);
            let fv = args.get(3).map(|a| eval_node(a, values)).unwrap_or(0.0);
            let beginning = args.get(4).map(|a| eval_node(a, values) != 0.0).unwrap_or(false);
            finance::calc_pmt(rate, nper, pv, fv, beginning)
        }
        "SLN" => {
            let cost = eval_node(&args[0], values);
            let salvage = eval_node(&args[1], values);
            let life = eval_node(&args[2], values) as u32;
            finance::calc_sln(cost, salvage, life)
        }
        "ABS" => eval_node(&args[0], values).abs(),
        "+" => args.iter().map(|a| eval_node(a, values)).sum(),
        "-" => {
            if args.len() == 1 {
                -eval_node(&args[0], values)
            } else {
                eval_node(&args[0], values) - eval_node(&args[1], values)
            }
        }
        "*" => args.iter().map(|a| eval_node(a, values)).product(),
        "/" => eval_node(&args[0], values) / eval_node(&args[1], values),
        _ => 0.0,
    }
}
