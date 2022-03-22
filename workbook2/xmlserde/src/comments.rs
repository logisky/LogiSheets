use super::complex_types::*;

#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.openxmlformats.org/spreadsheetml/2006/main")]
pub struct Comments {
    #[xmlserde(name = b"authors", ty = "child")]
    pub authors: CtAuthors,
    #[xmlserde(name = b"commentList", ty = "child")]
    pub comment_list: CtCommentList,
}

#[cfg(test)]
mod tests {
    use super::Comments;
    use crate::xml_deserialize_from_str;
    #[test]
    fn test1() {
        let xml = include_str!("../../../workbook/examples/comments.xml");
        let r = xml_deserialize_from_str::<Comments>(b"comments", xml);
        match r {
            Ok(sst) => {
                assert_eq!(sst.comment_list.comments.len(), 10);
                assert_eq!(sst.authors.authors.len(), 1);
                // Used the site and the code below to check the diff manually.
                // Basically pass.
                // https://www.diffchecker.com/diff
                // use crate::xml_serialize_with_decl;
                // use crate::test_utils::*;
                // let expected = to_tree(&in_one_line(xml));
                // let actual = xml_serialize_with_decl(b"comments", sst);
                // let r =  to_tree(&in_one_line(&actual));
                // println!("{:?}", actual);
                // use std::io::Write;
                // let mut file1 = std::fs::File::create("data1.txt").expect("create failed");
                // file1.write_all(expected.as_bytes()).expect("write failed");
                // let mut file2 = std::fs::File::create("data2.txt").expect("create failed");
                // file2.write_all(r.as_bytes()).expect("write failed");
                // assert_eq!(expected, r);
            }
            Err(e) => panic!("{:?}", e),
        }
    }
}
