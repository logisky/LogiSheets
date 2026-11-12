//! A minimal owned XML tree, for editing a part this crate saves verbatim.
//!
//! Some parts are kept as raw bytes because they are only partly modeled — a
//! chartEx part is the case this exists for. Regenerating such a part from
//! its model would drop everything the model does not know (styling, data
//! labels, extensions). Editing it instead means parsing the bytes, changing
//! the few elements an edit touches, and writing the rest back as it came.
//!
//! So everything but elements is kept as the raw event it was read as — text
//! stays escaped exactly as written, entity references stay references, and
//! attribute values are never unescaped and re-escaped. Prefixes are plain
//! parts of names: nothing here resolves namespaces, and a lookup by
//! `"cx:f"` matches only that spelling.

use std::borrow::Cow;

use quick_xml::Reader;
use quick_xml::Writer;
use quick_xml::escape::escape;
use quick_xml::events::{BytesEnd, BytesStart, BytesText, Event};

#[derive(Debug, Clone)]
pub enum XNode {
    El(XElement),
    /// Text, a reference, a comment, a declaration — written back as read.
    Raw(Event<'static>),
}

#[derive(Debug, Clone)]
pub struct XElement {
    start: BytesStart<'static>,
    pub children: Vec<XNode>,
}

impl XElement {
    pub fn new(name: &str) -> Self {
        XElement {
            start: BytesStart::new(name.to_string()),
            children: Vec::new(),
        }
    }

    /// A new element with `attrs` (unescaped values) and `text` content.
    pub fn with(name: &str, attrs: &[(&str, &str)], text: Option<&str>) -> Self {
        let mut e = XElement::new(name);
        for (k, v) in attrs {
            e.set_attr(k, v);
        }
        if let Some(t) = text {
            e.children
                .push(XNode::Raw(Event::Text(BytesText::new(t).into_owned())));
        }
        e
    }

    pub fn name(&self) -> String {
        String::from_utf8_lossy(self.start.name().as_ref()).into_owned()
    }

    /// Set `key` to `value` (unescaped), replacing it if present and keeping
    /// every other attribute byte for byte.
    pub fn set_attr(&mut self, key: &str, value: &str) {
        let name = self.name();
        let mut content = name.clone();
        let mut replaced = false;
        for a in self.start.attributes().with_checks(false).flatten() {
            let k = String::from_utf8_lossy(a.key.as_ref()).into_owned();
            let raw = if k == key {
                replaced = true;
                escape(value).into_owned()
            } else {
                String::from_utf8_lossy(&a.value).into_owned()
            };
            content.push_str(&format!(" {k}=\"{raw}\""));
        }
        if !replaced {
            content.push_str(&format!(" {key}=\"{}\"", escape(value)));
        }
        self.start = BytesStart::from_content(Cow::Owned(content), name.len()).into_owned();
    }

    pub fn child(&self, name: &str) -> Option<&XElement> {
        self.children.iter().find_map(|c| match c {
            XNode::El(e) if e.name() == name => Some(e),
            _ => None,
        })
    }

    pub fn child_mut(&mut self, name: &str) -> Option<&mut XElement> {
        self.children.iter_mut().find_map(|c| match c {
            XNode::El(e) if e.name() == name => Some(e),
            _ => None,
        })
    }

    pub fn children_named<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a XElement> {
        self.children.iter().filter_map(move |c| match c {
            XNode::El(e) if e.name() == name => Some(e),
            _ => None,
        })
    }

    pub fn children_named_mut<'a>(
        &'a mut self,
        name: &'a str,
    ) -> impl Iterator<Item = &'a mut XElement> {
        self.children.iter_mut().filter_map(move |c| match c {
            XNode::El(e) if e.name() == name => Some(e),
            _ => None,
        })
    }

    pub fn attr(&self, key: &str) -> Option<String> {
        self.start
            .attributes()
            .with_checks(false)
            .flatten()
            .find(|a| a.key.as_ref() == key.as_bytes())
            .and_then(|a| {
                a.normalized_value(quick_xml::XmlVersion::Implicit1_0)
                    .ok()
                    .map(|v| v.into_owned())
            })
    }

    pub fn remove_children(&mut self, name: &str) {
        self.children
            .retain(|c| !matches!(c, XNode::El(e) if e.name() == name));
    }

    /// Insert `el` where the schema puts it: after the last child whose name
    /// comes before `el`'s in `order`, or first when none does. OOXML child
    /// order is fixed and Excel repairs a file that breaks it, so a new child
    /// cannot just be appended.
    pub fn insert_ordered(&mut self, el: XElement, order: &[&str]) {
        let rank = |n: &str| order.iter().position(|o| *o == n);
        let mine = rank(&el.name()).unwrap_or(order.len());
        let at = self
            .children
            .iter()
            .rposition(|c| match c {
                XNode::El(e) => rank(&e.name()).is_some_and(|r| r <= mine),
                XNode::Raw(_) => false,
            })
            .map(|i| i + 1)
            .unwrap_or(0);
        self.children.insert(at, XNode::El(el));
    }

    fn write(&self, w: &mut Writer<Vec<u8>>) -> std::io::Result<()> {
        if self.children.is_empty() {
            return w.write_event(Event::Empty(self.start.borrow()));
        }
        w.write_event(Event::Start(self.start.borrow()))?;
        for c in self.children.iter() {
            match c {
                XNode::El(e) => e.write(w)?,
                XNode::Raw(ev) => w.write_event(ev.borrow())?,
            }
        }
        w.write_event(Event::End(BytesEnd::new(self.name())))
    }
}

/// A parsed document: its root, plus whatever came before it (the XML
/// declaration, comments).
#[derive(Debug, Clone)]
pub struct XDoc {
    pub prolog: Vec<Event<'static>>,
    pub root: XElement,
}

impl XDoc {
    pub fn parse(bytes: &[u8]) -> Option<XDoc> {
        let text = std::str::from_utf8(bytes).ok()?;
        let mut reader = Reader::from_str(text);
        let mut prolog = Vec::new();
        let mut stack: Vec<XElement> = Vec::new();
        let mut root = None;
        loop {
            let ev = reader.read_event().ok()?;
            match ev {
                Event::Eof => break,
                Event::Start(s) => stack.push(XElement {
                    start: s.into_owned(),
                    children: Vec::new(),
                }),
                Event::Empty(s) => {
                    let e = XElement {
                        start: s.into_owned(),
                        children: Vec::new(),
                    };
                    match stack.last_mut() {
                        Some(p) => p.children.push(XNode::El(e)),
                        None => root = Some(e),
                    }
                }
                Event::End(_) => {
                    let e = stack.pop()?;
                    match stack.last_mut() {
                        Some(p) => p.children.push(XNode::El(e)),
                        None => root = Some(e),
                    }
                }
                other => match stack.last_mut() {
                    Some(p) => p.children.push(XNode::Raw(other.into_owned())),
                    // Whitespace between the prolog and the root is noise.
                    None if root.is_none() => {
                        if !matches!(&other, Event::Text(t) if t.iter().all(|b| b.is_ascii_whitespace()))
                        {
                            prolog.push(other.into_owned());
                        }
                    }
                    None => {}
                },
            }
        }
        Some(XDoc {
            prolog,
            root: root?,
        })
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut w = Writer::new(Vec::new());
        for ev in self.prolog.iter() {
            let _ = w.write_event(ev.borrow());
            // A declaration on its own line, as Excel writes it.
            if matches!(ev, Event::Decl(_)) {
                let _ = w.get_mut().extend_from_slice(b"\n");
            }
        }
        let _ = self.root.write(&mut w);
        w.into_inner()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_untouched_document_round_trips_byte_for_byte() {
        let src = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n\
            <a:root xmlns:a=\"urn:x\" q=\"&amp;&quot;\"><a:b k=\"1\">x &lt; y &amp; z</a:b><a:c/>\
            <!-- note --><a:d>t<a:e/>u</a:d></a:root>";
        let doc = XDoc::parse(src.as_bytes()).unwrap();
        assert_eq!(String::from_utf8(doc.to_bytes()).unwrap(), src);
    }

    #[test]
    fn set_attr_keeps_the_others_raw_and_escapes_the_new_value() {
        let mut doc = XDoc::parse(br#"<r a="&amp;" b="2"/>"#).unwrap();
        doc.root.set_attr("b", "<3>");
        doc.root.set_attr("c", "new");
        assert_eq!(
            String::from_utf8(doc.to_bytes()).unwrap(),
            r#"<r a="&amp;" b="&lt;3&gt;" c="new"/>"#
        );
        assert_eq!(doc.root.attr("a").as_deref(), Some("&"));
    }

    #[test]
    fn insert_ordered_follows_the_schema_order() {
        let mut doc = XDoc::parse(b"<r><a/><c/></r>").unwrap();
        doc.root
            .insert_ordered(XElement::new("b"), &["a", "b", "c"]);
        doc.root
            .insert_ordered(XElement::new("z"), &["z", "a", "b", "c"]);
        assert_eq!(
            String::from_utf8(doc.to_bytes()).unwrap(),
            "<r><z/><a/><b/><c/></r>"
        );
    }
}
