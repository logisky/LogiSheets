use crate::complex_types::*;
use crate::simple_types::*;
use crate::worksheet::*;

#[test]
fn sheet_data() {
    let xml = r#"
	<sheetData>
		<row r="48" spans="1:55" ht="11.45" customHeight="1">
			<c r="P48" s="413" t="str">
				<f t="shared" ref="P48" si="35">PROPER(IF(ISTEXT(AL37),MID(AL37,1,-1+FIND(",",AL37))," "))</f>
				<v xml:space="preserve"> </v>
			</c>
		</row>
	</sheetData>
    "#;
    let r: SheetData = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn sheet_views() {
    let xml = r#"
	<sheetViews>
		<sheetView showGridLines="0" tabSelected="1" topLeftCell="A52" workbookViewId="0">
			<selection activeCell="H73" sqref="H73"/>
		</sheetView>
	</sheetViews>
    "#;
    let r: SheetViews = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn sheet_format_pr() {
    let xml = r#"
	<sheetFormatPr defaultColWidth="8.875" defaultRowHeight="13.5"/>
    "#;
    let r: SheetFormatPr = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn cell_formula() {
    let xml = r#"
    <f t = "shared" ref="I9:X9" si="0">EDATE(J9,-3)</f>
    "#;
    let r: CellFormula = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
    let cf = CellFormula {
        f: Some(String::from("sum(1)")),
        t: StCellFormulaType::Type::Shared,
        aca: false,
        reference: None,
        dt_2d: false,
        dtr: false,
        del1: false,
        del2: false,
        r1: None,
        r2: None,
        ca: false,
        si: None,
        bx: false,
    };
    let de_r = quick_xml::se::to_string(&cf).unwrap();
    println!("{:?}", de_r);
}

#[test]
fn row() {
    let xml = r#"
		<row r="2" spans="1:55" ht="14.1" customHeight="1" thickBot="1">
			<c r="A2" s="7"/>
			<c r="B2" s="8" t="s">
				<v>0</v>
			</c>
			<c r="C2" s="341" t="str">
				<f>[32]Summary!$C$2</f>
				<v>BABA US</v>
			</c>
			<c r="D2" s="9" t="str">
				<f>[32]Summary!D2</f>
				<v>USD</v>
			</c>
			<c r="E2" s="10"/>
			<c r="F2" s="39" t="str">
				<f>"FX "&amp;D3&amp;"/"&amp;D2</f>
				<v>FX CNY/USD</v>
			</c>
		</row>
    "#;
    let result: Row = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", result);
}

#[test]
fn cols() {
    let xml = r#"
	<cols>
		<col min="1" max="1" width="2.625" customWidth="1"/>
		<col min="1" max="1" width="2.625" customWidth="1"/>
	</cols>
    "#;
    let result: Cols = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", result);
}

#[test]
fn conditional_formatting() {
    let xml = r#"
	<conditionalFormatting sqref="O31 G23:N23">
		<cfRule type="cellIs" dxfId="0" priority="1" stopIfTrue="1" operator="greaterThan">
			<formula>#REF!</formula>
		</cfRule>
	</conditionalFormatting>
    "#;
    let result: ConditionalFormatting = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", result);
}

#[test]
fn selection() {
    let xml = r#"<selection activeCell="H73" sqref="H73"/>"#;
    let result: Selection = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", result);
}

#[test]
fn header_footer() {
    let xml = r#"
    <headerFooter differentFirst="1" differentOddEven="1">
        <oddHeader>&amp;R&amp;P</oddHeader>
    </headerFooter>
    "#;
    let result: HeaderFooter = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", result);
}

#[test]
fn filter_column() {
    let xml = r#"
        <filterColumn colId="1">
            <customFilters>
                <customFilter operator="greaterThan", val="0.5"/>
            </customFilters>
        </filterColumn>
    "#;
    let result: FilterColumn = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", result);
}

#[test]
fn cell() {
    let xml = r#"
    <c r="A1" t="inlineStr">
        <f>SUM(1)</f>
        <v>2561223</v>
        <is><t>This is string example</t></is>
    </c>"#;
    let result: Cell = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", result);
    let de_r = quick_xml::se::to_string(&result).unwrap();
    println!("{:?}", de_r);
}

#[test]
fn sheet1() {
    serde_test!("../../examples/sheet1.xml", WorksheetPart);
}

#[test]
fn sheet2() {
    serde_test!("../../examples/sheet2.xml", WorksheetPart);
}
