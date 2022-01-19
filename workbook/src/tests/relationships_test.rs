use crate::relationships::*;

#[test]
fn relationships() {
    let xml = r#"
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath" Target="file:///D:\微信文件\WeChat%20Files\happyzhuyan\FileStorage\File\2020-12\CA%20BABA%20STANDARD%20MODEL%20-%20RAW%20-%2020201105.xlsx" TargetMode="External"/>
    </Relationships>
    "#;
    let res: RelationshipsPart = quick_xml::de::from_str(xml).unwrap();
    println!("{:?}", res);
}
