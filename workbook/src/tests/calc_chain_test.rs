use crate::calc_chain::*;

#[test]
fn calc_cell() {
    let xml = r#"<c r="N53" i="1"/>"#;
    let r: CalcCell = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r)
}

#[test]
fn calc_chain() {
    serde_test!("../../examples/calc_chain.xml", CalcChainPart);
}
