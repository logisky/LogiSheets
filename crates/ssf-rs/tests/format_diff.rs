//! Differential test: `ssf_rs::format_str` vs. the reference `ssf.format`
//! running under Node.js. Values pass as raw bit patterns and formats as hex so
//! nothing is lost to escaping or float parsing.
//!
//! Ignored by default (needs `node` + a local `ssf`). Run with:
//!   cargo test -p ssf-rs --test format_diff -- --ignored --nocapture

use std::io::Write;
use std::process::Command;

use ssf_rs::format_str;

struct Lcg(u64);
impl Lcg {
    fn next_u64(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.0
    }
}

fn formats() -> Vec<&'static str> {
    vec![
        "General",
        "0",
        "0.00",
        "0.000",
        "#,##0",
        "#,##0.00",
        "0%",
        "0.00%",
        "0.00E+00",
        "##0.0E+0",
        "0.0E+0",
        "#.#",
        "#.##",
        ".00",
        "0.#",
        "#,##0;(#,##0)",
        "#,##0.00;[Red](#,##0.00)",
        "0.00;-0.00;\"zero\"",
        "0.0,",
        "#,##0.0,,",
        "$#,##0.00",
        "\\$#,##0",
        "0 \"USD\"",
        "\"Total: \"0.00",
        "# ?/?",
        "# ??/??",
        "# ???/???",
        "0.00_);(0.00)",
        "m/d/yy",
        "yyyy-mm-dd",
        "d-mmm-yy",
        "d-mmm",
        "mmm-yy",
        "mmmm",
        "ddd",
        "dddd",
        "h:mm AM/PM",
        "h:mm:ss AM/PM",
        "h:mm",
        "h:mm:ss",
        "[h]:mm:ss",
        "mm:ss",
        "mm:ss.0",
        "m/d/yy h:mm",
        "yyyy\"年\"m\"月\"d\"日\"",
        "@",
        "\"x\"@\"y\"",
        "000-00-0000",
        "(###) ###-####",
        "[>100]0.0;[<=100]0.00",
        "[Red][>1000]#,##0;#,##0.00",
        "0.00000",
        "#,##0.000",
        "0.############",
    ]
}

fn values() -> Vec<f64> {
    vec![
        0.0, 1.0, -1.0, 0.5, -0.5, 2.5, 0.125, 1234.5, -1234.5, 1234567.891, 0.1, 0.001,
        0.0001, 1000000.0, 99.995, 0.9999, 1.005, 12345.6789, -12345.6789, 3.14159265,
        1.0, 60.0, 61.0, 45000.0, 45678.375, 0.5, 0.75, 0.999988425925926, 45291.5,
        25569.0, 2958465.0, 100.25, 367.0,
        1e-7, 1e-6, 1e10, 1e11, 1234567890123.0, 0.00000123, 987654321.0,
        7.0 / 8.0, 22.0 / 7.0, 1.0 / 3.0,
    ]
}

fn hex(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn unhex(s: &str) -> Vec<u8> {
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
        .collect()
}

const NODE_SCRIPT: &str = r#"
const fs = require('fs');
const SSF = require(process.argv[3]);
const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n');
function fromBits(h){
  const b = BigInt('0x'+h);
  const buf = new ArrayBuffer(8); const dv = new DataView(buf);
  dv.setBigUint64(0, b); return dv.getFloat64(0);
}
function fromHex(h){ return Buffer.from(h,'hex').toString('utf8'); }
function toHex(s){ return Buffer.from(s,'utf8').toString('hex'); }
const out = [];
for (const line of lines) {
  if (!line) continue;
  const parts = line.split('\t');
  const val = fromBits(parts[0]);
  const fmt = fromHex(parts[1]);
  let r;
  try { r = SSF.format(fmt, val); if (typeof r !== 'string') r = String(r); }
  catch (e) { r = 'ERR'; }
  out.push(toHex(r));
}
process.stdout.write(out.join('\n'));
"#;

#[test]
#[ignore = "requires node + ssf"]
fn differential_against_ssf() {
    let ssf_path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../node_modules/ssf");

    let mut vals = values();
    let mut lcg = Lcg(0xDEADBEEF12345678);
    for _ in 0..600 {
        let f = f64::from_bits(lcg.next_u64());
        if f.is_finite() {
            vals.push(f);
        }
    }

    let mut input = String::new();
    let mut rust_out: Vec<String> = Vec::new();
    for fmt in formats() {
        for &val in &vals {
            let bits = val.to_bits();
            input.push_str(&format!("{:016x}\t{}\n", bits, hex(fmt.as_bytes())));
            let r = format_str(fmt, val).unwrap_or_else(|_| "\u{1}ERR".to_string());
            rust_out.push(r);
        }
    }

    let dir = std::env::temp_dir();
    let infile = dir.join("ssf_rs_format_diff_in.txt");
    std::fs::File::create(&infile)
        .unwrap()
        .write_all(input.as_bytes())
        .unwrap();
    let scriptfile = dir.join("ssf_rs_format_diff.js");
    std::fs::File::create(&scriptfile)
        .unwrap()
        .write_all(NODE_SCRIPT.as_bytes())
        .unwrap();

    let output = Command::new("node")
        .arg(&scriptfile)
        .arg(&infile)
        .arg(ssf_path)
        .output()
        .expect("failed to run node");
    assert!(
        output.status.success(),
        "node failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let js_out = String::from_utf8(output.stdout).unwrap();
    let js_lines: Vec<String> = js_out
        .split('\n')
        .map(|h| String::from_utf8_lossy(&unhex(h)).into_owned())
        .collect();

    assert_eq!(js_lines.len(), rust_out.len(), "line count mismatch");

    let input_lines: Vec<&str> = input.lines().collect();
    let mut mismatches = 0usize;
    let mut samples = Vec::new();
    for (i, (r, j)) in rust_out.iter().zip(js_lines.iter()).enumerate() {
        if r != j {
            mismatches += 1;
            if samples.len() < 60 {
                let parts: Vec<&str> = input_lines[i].split('\t').collect();
                let val = f64::from_bits(u64::from_str_radix(parts[0], 16).unwrap());
                let fmt = String::from_utf8(unhex(parts[1])).unwrap();
                samples.push(format!("  fmt={:?} val={:?}  rust={:?} js={:?}", fmt, val, r, j));
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
    eprintln!("format differential OK: {} cases matched", rust_out.len());
}
