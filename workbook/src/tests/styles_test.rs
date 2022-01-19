use crate::styles::*;

#[test]
fn num_fmt() {
    let xml = r#"
		<numFmt numFmtId="182" formatCode="\$#,##0.00;[Red]\-\$#,##0.00"/>
    "#;
    let r: NumFmt = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn font() {
    let xml = r#"
        <font>
			<sz val="11"/>
			<color theme="1"/>
			<name val="宋体"/>
			<family val="2"/>
			<scheme val="minor"/>
		</font>
    "#;
    let r: Font = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn fonts() {
    let xml = r#"
	<fonts count="184">
		<font>
			<i/>
			<u val="singleAccounting"/>
			<sz val="9"/>
			<name val="Arial"/>
			<family val="2"/>
		</font>
	</fonts>
    "#;
    let r: Fonts = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn border() {
    let xml = r#"
		<border>
			<left/>
			<right style="medium">
				<color auto="1"/>
			</right>
			<top style="medium">
				<color auto="1"/>
			</top>
			<bottom/>
			<diagonal/>
		</border>
    "#;
    let r: Border = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn xf() {
    let xml = r#"
		<xf numFmtId="3" fontId="88" fillId="0" borderId="40" xfId="13" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
			<alignment horizontal="right"/>
		</xf>
    "#;
    let r: Xf = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn cell_style() {
    let xml = r#"
		<cellStyle name="常规 2" xfId="2" xr:uid="{00000000-0005-0000-0000-000008000000}"/>
    "#;
    let r: CellStyle = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn table_styles() {
    let xml = r#"
	<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleMedium9"/>
    "#;
    let r: TableStyles = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn colors() {
    let xml = r#"
	<colors>
		<mruColors>
			<color rgb="FFFFFF99"/>
			<color rgb="FF0000FF"/>
		</mruColors>
	</colors>
    "#;
    let r: Colors = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r);
}

#[test]
fn fill() {
    let xml = r#"
		<fill>
			<patternFill patternType="solid">
				<fgColor indexed="9"/>
                <bgColor indexed="64"/>
			</patternFill>
		</fill>
    "#;
    let r: Fill = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", r)
}

#[test]
fn stylesheet1() {
    // serde_test!("../../examples/styles.xml", StyleSheetPart);
}

#[test]
fn stylesheet2() {
    serde_test!("../../examples/styles2.xml", StyleSheetPart);
}
