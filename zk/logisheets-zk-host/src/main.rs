use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use clap::{Parser, Subcommand};
use logisheets_zk_core::smt_builder::SparseMerkleTree;
use logisheets_zk_core::{
    Formula, FormulaWithProof, OutputDef, PrivateInputs, ProverInput, PublicInputs,
};

#[derive(Parser)]
#[command(name = "logisheets-zk-host")]
#[command(about = "LogiSheets ZK quarterly report prover")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Build the formula SMT root and local output without generating a ZK proof.
    Mock { input: PathBuf },
    /// Generate a real RiscZero proof (requires `prove` feature).
    Prove { input: PathBuf },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Mock { input } => run_mock(input),
        Commands::Prove { input } => run_prove(input),
    }
}

fn run_mock(input_path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    let input = load_input(input_path)?;
    let (report, root) = build_report(input)?;

    println!("Formula Root: 0x{}", hex::encode(root));
    println!("Quarterly Outputs:");
    for (name, value) in &report.outputs {
        println!("  {} = {}", name, value);
    }
    println!("\nMock run successful. No ZK proof was generated.");

    Ok(())
}

fn run_prove(_input_path: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(feature = "prove")]
    {
        // Real RiscZero proving would go here.
        todo!("Implement real proving with logisheets-zk-methods and risc0-zkvm");
    }
    #[cfg(not(feature = "prove"))]
    {
        eprintln!("Real proving requires the `prove` feature. Rebuild with --features prove.");
        std::process::exit(1);
    }
}

fn load_input(path: PathBuf) -> Result<ProverInput, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(path)?;
    let input: ProverInput = serde_json::from_str(&content)?;
    Ok(input)
}

fn build_report(input: ProverInput) -> Result<(logisheets_zk_core::QuarterlyReport, [u8; 32]), Box<dyn std::error::Error>> {
    let mut tree = SparseMerkleTree::new();

    // Insert all formulas into the SMT.
    for fp in &input.private.formulas_with_proofs {
        tree.insert(fp.formula.id, fp.formula.commitment());
    }

    let root = tree.root();
    if root != input.public.formula_root {
        return Err(format!(
            "Computed formula root {} does not match input root {}",
            hex::encode(root),
            hex::encode(input.public.formula_root)
        )
        .into());
    }

    // Merge public + private values for local evaluation.
    let mut values: HashMap<String, f64> = HashMap::new();
    for (k, v) in &input.public.values {
        values.insert(k.clone(), *v);
    }
    for (k, v) in &input.private.values {
        values.insert(k.clone(), *v);
    }

    // Generate inclusion proofs for each formula (used in real ZK proof).
    let mut formulas_with_proofs = Vec::new();
    for fp in &input.private.formulas_with_proofs {
        let proof = tree.proof(&fp.formula.id);
        formulas_with_proofs.push(FormulaWithProof {
            formula: fp.formula.clone(),
            proof,
        });
    }

    // Locally evaluate each formula.
    let mut outputs: Vec<(String, f64)> = Vec::new();
    for fp in &formulas_with_proofs {
        let ast = parse_formula(&fp.formula.expression);
        let result = eval_node(&ast, &values);
        outputs.push((fp.formula.name.clone(), result));
    }

    let report = logisheets_zk_core::QuarterlyReport {
        fund_id: 0,     // TODO: read from input
        quarter_id: 0,  // TODO: read from input
        formula_root: root,
        outputs,
    };

    Ok((report, root))
}

// Minimal formula evaluator duplicated here for local execution.
// In production this logic should be shared with the guest via a no_std crate.
#[derive(Clone, Debug)]
enum Node {
    Ref(String),
    Number(f64),
    Call(String, Vec<Node>),
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

fn eval_node(node: &Node, values: &HashMap<String, f64>) -> f64 {
    match node {
        Node::Number(n) => *n,
        Node::Ref(name) => *values.get(name).unwrap_or(&0.0),
        Node::Call(name, args) => eval_call(name, args, values),
    }
}

fn eval_call(name: &str, args: &[Node], values: &HashMap<String, f64>) -> f64 {
    use logisheets_zk_math::finance;
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

#[cfg(test)]
mod tests {
    use super::*;
    use logisheets_zk_core::{Formula, OutputDef};

    fn sample_input() -> ProverInput {
        let formula = Formula {
            id: [1u8; 32],
            name: "Quarterly_ROI".to_string(),
            expression: "=(EndValue - StartValue) / StartValue".to_string(),
            version: 1,
        };
        let mut tree = SparseMerkleTree::new();
        tree.insert(formula.id, formula.commitment());
        let root = tree.root();

        ProverInput {
            public: PublicInputs {
                formula_root: root,
                values: vec![
                    ("StartValue".to_string(), 1_000_000.0),
                    ("EndValue".to_string(), 1_150_000.0),
                ],
                expected_outputs: vec![OutputDef {
                    name: "Quarterly_ROI".to_string(),
                }],
            },
            private: PrivateInputs {
                formulas_with_proofs: vec![FormulaWithProof {
                    formula,
                    proof: tree.proof(&[1u8; 32]),
                }],
                values: vec![],
            },
        }
    }

    #[test]
    fn mock_report_computes_roi() {
        let input = sample_input();
        let (report, _) = build_report(input).unwrap();
        let roi = report.outputs.iter().find(|(n, _)| n == "Quarterly_ROI").unwrap().1;
        assert!((roi - 0.15).abs() < 1e-9);
    }
}
