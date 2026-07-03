use super::complex_types::PlainTextString;
use super::defaults::default_false;
use xmlserde_derives::{XmlDeserialize, XmlSerialize};

/// `xl/threadedComments/threadedCommentN.xml` — worksheet-scoped threaded
/// comments (Excel 2018+). Each `threadedComment` is one note: a root note has
/// no `parentId`; replies carry the root note's `id`. `personId` /
/// `mentionpersonId` reference `xl/persons/personN.xml`.
#[derive(Debug, XmlSerialize, XmlDeserialize)]
#[xmlserde(with_ns = b"http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments")]
#[xmlserde(root = b"ThreadedComments")]
pub struct ThreadedComments {
    #[xmlserde(name = b"threadedComment", ty = "child")]
    pub comments: Vec<CtThreadedComment>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtThreadedComment {
    #[xmlserde(name = b"text", ty = "child")]
    pub text: Option<PlainTextString>,
    #[xmlserde(name = b"mentions", ty = "child")]
    pub mentions: Option<CtMentions>,
    #[xmlserde(name = b"ref", ty = "attr")]
    pub reference: String,
    #[xmlserde(name = b"dT", ty = "attr")]
    pub dt: String,
    #[xmlserde(name = b"personId", ty = "attr")]
    pub person_id: String,
    #[xmlserde(name = b"id", ty = "attr")]
    pub id: String,
    #[xmlserde(name = b"parentId", ty = "attr")]
    pub parent_id: Option<String>,
    #[xmlserde(name = b"done", ty = "attr", default = "default_false")]
    pub done: bool,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtMentions {
    #[xmlserde(name = b"mention", ty = "child")]
    pub mention: Vec<CtMention>,
}

#[derive(Debug, XmlSerialize, XmlDeserialize)]
pub struct CtMention {
    #[xmlserde(name = b"mentionpersonId", ty = "attr")]
    pub mention_person_id: String,
    #[xmlserde(name = b"mentionId", ty = "attr")]
    pub mention_id: String,
    #[xmlserde(name = b"startIndex", ty = "attr")]
    pub start_index: u32,
    #[xmlserde(name = b"length", ty = "attr")]
    pub length: u32,
}

#[cfg(test)]
mod tests {
    use super::ThreadedComments;
    use crate::xml_deserialize_from_str;

    #[test]
    fn parse() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ThreadedComments xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments"><threadedComment ref="A1" dT="2026-07-03T10:00:00Z" personId="{11111111-1111-1111-1111-111111111111}" id="{aaaaaaaa-1111-1111-1111-111111111111}"><text>Please review @Bob</text><mentions><mention mentionpersonId="{22222222-2222-2222-2222-222222222222}" mentionId="{bbbbbbbb-1111-1111-1111-111111111111}" startIndex="15" length="4"/></mentions></threadedComment><threadedComment ref="A1" dT="2026-07-03T10:05:00Z" personId="{22222222-2222-2222-2222-222222222222}" id="{aaaaaaaa-2222-2222-2222-222222222222}" parentId="{aaaaaaaa-1111-1111-1111-111111111111}"><text>Done</text></threadedComment></ThreadedComments>"#;
        let r = xml_deserialize_from_str::<ThreadedComments>(xml).unwrap();
        assert_eq!(r.comments.len(), 2);
        assert_eq!(r.comments[0].reference, "A1");
        assert!(r.comments[1].parent_id.is_some());
        let m = r.comments[0].mentions.as_ref().unwrap();
        assert_eq!(m.mention.len(), 1);
        assert_eq!(m.mention[0].start_index, 15);
    }
}
