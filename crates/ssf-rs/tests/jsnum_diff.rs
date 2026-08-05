//! Differential test: `ssf_rs::jsnum` vs. JavaScript's real `Number` methods.
//!
//! Values are passed to node as their raw 64-bit patterns so that node
//! reconstructs the *identical* `f64` and any rounding difference is a genuine
//! divergence, not a parse artifact.
//!
//! Ignored by default (needs `node`). Run with:
//!   cargo test -p ssf-rs --test jsnum_diff -- --ignored --nocapture

use std::io::Write;
use std::process::Command;

use ssf_rs::jsnum;

/// A tiny deterministic LCG so the test is reproducible without `rand`.
struct Lcg(u64);
impl Lcg {
    fn next_u64(&mut self) -> u64 {
        // Numerical Recipes constants
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.0
    }
    /// A finite f64 spanning many magnitudes (including subnormals, negatives).
    fn next_f64(&mut self) -> f64 {
        loop {
            let bits = self.next_u64();
            let f = f64::from_bits(bits);
            if f.is_finite() {
                return f;
            }
        }
    }
}

fn tricky_values() -> Vec<f64> {
    vec![
        0.0, -0.0, 1.0, -1.0, 0.5, -0.5, 2.5, -2.5, 0.125, 0.375, 1.005, 2.675,
        0.1, 0.2, 0.3, 0.7, 8.575, 9.999999, 9.995, 99.999, 0.0001, 0.00001,
        1e-7, 1e-6, 1e21, 1e20, 123456.789, 1234567890.12345, 0.049999999999999996,
        0.49999999999999994, 3.141592653589793, 2.718281828459045, 1000000.0,
        0.9999999999999999, 100.0, 0.999, 999.5, 45000.0, 45678.375,
    ]
}

#[derive(Clone, Copy)]
enum Kind {
    Fixed,
    Exp,
    Prec,
    Str,
}

fn kind_tag(k: Kind) -> char {
    match k {
        Kind::Fixed => 'f',
        Kind::Exp => 'e',
        Kind::Prec => 'p',
        Kind::Str => 's',
    }
}

fn rust_eval(k: Kind, x: f64, p: usize) -> String {
    match k {
        Kind::Fixed => jsnum::to_fixed(x, p),
        Kind::Exp => jsnum::to_exponential(x, p),
        Kind::Prec => jsnum::to_precision(x, p),
        Kind::Str => jsnum::to_string_js(x),
    }
}

#[test]
#[ignore = "requires node"]
fn differential_against_node() {
    let mut values = tricky_values();
    let mut lcg = Lcg(0x9E3779B97F4A7C15);
    for _ in 0..4000 {
        values.push(lcg.next_f64());
    }

    // Build cases and Rust outputs.
    let precisions = [0usize, 1, 2, 3, 4, 5, 6, 10, 15, 20];
    let mut input = String::new();
    let mut rust_out: Vec<String> = Vec::new();
    for &x in &values {
        for k in [Kind::Fixed, Kind::Exp, Kind::Prec, Kind::Str] {
            for &p in &precisions {
                // toPrecision requires 1..=100; toFixed/toExponential 0..=100.
                if matches!(k, Kind::Prec) && p == 0 {
                    continue;
                }
                // to_string_js ignores precision; test it once per value.
                if matches!(k, Kind::Str) && p != 0 {
                    continue;
                }
                let bits = x.to_bits();
                input.push_str(&format!("{:016x}\t{}\t{}\n", bits, kind_tag(k), p));
                rust_out.push(rust_eval(k, x, p));
            }
        }
    }

    // Write input to a temp file.
    let dir = std::env::temp_dir();
    let infile = dir.join("ssf_rs_jsnum_diff_in.txt");
    std::fs::File::create(&infile)
        .unwrap()
        .write_all(input.as_bytes())
        .unwrap();

    let script = r#"
const fs = require('fs');
const lines = fs.readFileSync(process.argv[1], 'utf8').split('\n');
function fromBits(hex){
  const b = BigInt('0x'+hex);
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  dv.setBigUint64(0, b);
  return dv.getFloat64(0);
}
const out = [];
for (const line of lines) {
  if (!line) continue;
  const [hex, kind, pStr] = line.split('\t');
  const x = fromBits(hex);
  const p = parseInt(pStr, 10);
  let r;
  if (kind === 'f') r = x.toFixed(p);
  else if (kind === 'e') r = x.toExponential(p);
  else if (kind === 'p') r = x.toPrecision(p);
  else r = String(x);
  out.push(r);
}
process.stdout.write(out.join('\n'));
"#;

    let output = Command::new("node")
        .arg("-e")
        .arg(script)
        .arg(&infile)
        .output()
        .expect("failed to run node");
    assert!(
        output.status.success(),
        "node failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let js_out = String::from_utf8(output.stdout).unwrap();
    let js_lines: Vec<&str> = js_out.split('\n').collect();

    assert_eq!(
        js_lines.len(),
        rust_out.len(),
        "line count mismatch: js={} rust={}",
        js_lines.len(),
        rust_out.len()
    );

    let mut mismatches = 0usize;
    let mut samples = Vec::new();
    let input_lines: Vec<&str> = input.lines().collect();
    for (i, (r, j)) in rust_out.iter().zip(js_lines.iter()).enumerate() {
        if r != *j {
            mismatches += 1;
            if samples.len() < 40 {
                let parts: Vec<&str> = input_lines[i].split('\t').collect();
                let x = f64::from_bits(u64::from_str_radix(parts[0], 16).unwrap());
                samples.push(format!(
                    "  {} p={} x={:?}  rust={:?} js={:?}",
                    parts[1], parts[2], x, r, j
                ));
            }
        }
    }
    if mismatches > 0 {
        panic!(
            "{}/{} mismatches:\n{}",
            mismatches,
            rust_out.len(),
            samples.join("\n")
        );
    }
    eprintln!("jsnum differential OK: {} cases matched", rust_out.len());
}
