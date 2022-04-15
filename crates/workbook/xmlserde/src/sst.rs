use super::complex_types::*;

#[derive(XmlSerialize, XmlDeserialize, Debug)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
pub struct SstPart {
    #[xmlserde(name = b"count", ty = "attr")]
    pub count: Option<u32>,
    #[xmlserde(name = b"uniqueCount", ty = "attr")]
    pub unique_count: Option<u32>,
    #[xmlserde(name = b"si", ty = "child")]
    pub si: Vec<CtRst>,
}

#[cfg(test)]
mod tests {
    use super::SstPart;
    use crate::test_utils::in_one_line;
    use crate::{xml_deserialize_from_str, xml_serialize_with_decl};

    #[test]
    fn test() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1984" uniqueCount="1350">
	<si>
		<t>Ticker</t>
	</si>
	<si>
		<t>Ticker22</t>
	</si>
	<si>
		<t>Price</t>
	</si>
	<si>
		<t xml:space="preserve">Acquisition of Intangible </t>
		<phoneticPr fontId="16" type="noConversion"/>
	</si>
	<si>
		<t>Capex</t>
		<phoneticPr fontId="16" type="noConversion"/>
	</si>
</sst>"#;
        let r = xml_deserialize_from_str::<SstPart>(b"sst", xml);
        match r {
            Ok(sst) => {
                let actual = in_one_line(xml);
                let r = xml_serialize_with_decl(b"sst", sst);
                assert_eq!(actual, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }
}
