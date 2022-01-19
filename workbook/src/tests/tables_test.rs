use crate::tables::*;

#[test]
fn table() {
    let xml = r#"
    <table xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main" id="1" name="MarginTable" displayName="MarginTable" ref="D3:G6" totalsRowShown="0">
        <autoFilter ref="D3:G6"/>
        <tableColumns count="4">
            <tableColumn id="1" name="Product"/>
            <tableColumn id="2" name="Wholesale"/>
            <tableColumn id="3" name="Retail"/>
            <tableColumn id="4" name="Margin" dataDxfId="0">
                <calculatedColumnFormula d="1">[Retail]-[Wholesale]</calculatedColumnFormula>
            </tableColumn>
        </tableColumns>
        <tableStyleInfo name="TableStyleMedium9" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
    </table>
    "#;
    let r: TablePart = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}
