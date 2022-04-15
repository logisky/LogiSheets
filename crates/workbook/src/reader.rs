use super::rtypes::*;
use std::collections::HashMap;
use std::{
    io::{BufReader, Cursor, Read, Seek},
    path::PathBuf,
    str::FromStr,
};
use thiserror::Error;
use xmlserde::{
    comments::Comments, sst::SstPart, style_sheet::StylesheetPart, workbook::WorkbookPart,
    worksheet::WorksheetPart,
};
use zip::ZipArchive;

#[derive(Debug, Error)]
pub enum SerdeErr {
    #[error("zip error")]
    ZipError(#[from] zip::result::ZipError),
    #[error("io error")]
    IoError(#[from] std::io::Error),
    #[error("xml error")]
    XmlError(#[from] quick_xml::Error),
    #[error("custom error")]
    Custom(String),
}

use crate::external_links::ExternalLinkPart;
use crate::workbook::ExternalLink;
use crate::{
    relationships::Relationships,
    rtypes::RType,
    workbook::{Workbook, Worksheet},
    xml_deserialize_from_reader,
};

pub fn read(buf: &[u8]) -> Result<Workbook, SerdeErr> {
    let reader = Cursor::new(buf);
    let mut archive = ZipArchive::new(reader)?;
    let root = "_rels/.rels";
    let relationships = de_relationships(root, &mut archive)?;
    let mut result = Err(SerdeErr::Custom(String::from(
        "Cannot find the workbook part",
    )));
    relationships
        .relationships
        .into_iter()
        .for_each(|p| match RType(&p.ty) {
            WORKBOOK => {
                let target = &p.target;
                result = de_workbook(target, &mut archive);
            }
            _ => {}
        });
    result
}

fn de_external_link<R: Read + Seek>(
    path: &str,
    archive: &mut ZipArchive<R>,
) -> Result<ExternalLink, SerdeErr> {
    let external_link_part = de_external_link_part(path, archive)?;
    let path_buf = get_rels(path)?;
    let rels = path_buf.to_str();
    if rels.is_none() {
        return Err(SerdeErr::Custom(String::from("path buf to str error")));
    }
    let rels = rels.unwrap();
    let relationships = de_relationships(rels, archive)?;
    let target = {
        if relationships.relationships.len() == 0 {
            String::from("")
        } else {
            let mut iter = relationships.relationships.into_iter();
            let r = iter.next().unwrap();
            r.target
        }
    };
    Ok(ExternalLink {
        external_link_part,
        target,
    })
}

fn de_workbook<R: Read + Seek>(
    path: &str,
    archive: &mut ZipArchive<R>,
) -> Result<Workbook, SerdeErr> {
    let workbook_part = de_workbook_part(path, archive)?;
    let mut styles = Option::<StylesheetPart>::None;
    let mut sst = Option::<SstPart>::None;
    let mut worksheets = HashMap::<String, Worksheet>::new();
    let mut external_links = HashMap::<String, ExternalLink>::new();
    let path_buf = get_rels(path)?;
    let rels = path_buf.to_str();
    if rels.is_none() {
        return Err(SerdeErr::Custom(String::from("path buf to str error")));
    }
    let rels = rels.unwrap();
    let relationships = de_relationships(rels, archive)?;
    relationships
        .relationships
        .into_iter()
        .for_each(|r| match RType(&r.ty) {
            WORKSHEET => {
                let id = r.id;
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_worksheet(s, archive) {
                        Ok(w) => {
                            worksheets.insert(id, w);
                        }
                        Err(e) => {
                            log!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            EXT_LINK => {
                let id = r.id;
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_external_link(s, archive) {
                        Ok(w) => {
                            external_links.insert(id, w);
                        }
                        Err(e) => {
                            log!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            SST => {
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_sst(s, archive) {
                        Ok(w) => {
                            sst = Some(w);
                        }
                        Err(e) => {
                            log!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            STYLE => {
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_style_part(s, archive) {
                        Ok(w) => {
                            styles = Some(w);
                        }
                        Err(e) => {
                            log!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            _ => {}
        });
    Ok(Workbook {
        workbook_part,
        styles: styles.unwrap(),
        sst,
        worksheets,
        external_links,
    })
}

fn de_worksheet<R: Read + Seek>(
    path: &str,
    archive: &mut ZipArchive<R>,
) -> Result<Worksheet, SerdeErr> {
    let worksheet_part = de_worksheet_part(path, archive)?;
    let mut comments = Option::<Comments>::None;
    let path_buf = get_rels(path)?;
    let rels = path_buf.to_str();
    if rels.is_none() {
        return Err(SerdeErr::Custom(String::from("path buf to str error")));
    }
    let rels = rels.unwrap();
    let result = de_relationships(rels, archive);
    if result.is_err() {
        return Ok(Worksheet {
            worksheet_part,
            comments,
        });
    }
    let relationships = result.unwrap();
    relationships
        .relationships
        .into_iter()
        .for_each(|r| match RType(&r.ty) {
            COMMENTS => {
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(comment_path) = path.to_str() {
                    match de_comments(comment_path, archive) {
                        Ok(c) => {
                            comments = Some(c);
                        }
                        Err(_) => {}
                    }
                }
            }
            _ => {}
        });
    Ok(Worksheet {
        worksheet_part,
        comments,
    })
}

macro_rules! define_de_func {
    ($func:ident, $t:ty, $s:literal) => {
        fn $func<R: Read + Seek>(path: &str, archive: &mut ZipArchive<R>) -> Result<$t, SerdeErr> {
            let file = archive.by_name(path)?;
            let reader = BufReader::new(file);
            let result = xml_deserialize_from_reader::<$t, _>($s, reader);
            match result {
                Ok(r) => Ok(r),
                Err(s) => Err(SerdeErr::Custom(s)),
            }
        }
    };
}

define_de_func!(de_relationships, Relationships, b"Relationships");
define_de_func!(de_external_link_part, ExternalLinkPart, b"externalLink");
define_de_func!(de_workbook_part, WorkbookPart, b"workbook");
define_de_func!(de_worksheet_part, WorksheetPart, b"worksheet");
define_de_func!(de_comments, Comments, b"comments");
define_de_func!(de_sst, SstPart, b"sst");
define_de_func!(de_style_part, StylesheetPart, b"styleSheet");

/// Given a path `/foo/test.xml`, find its relationships `/foo/_rels/test.xml.rels`
fn get_rels(path: &str) -> Result<PathBuf, SerdeErr> {
    let p = PathBuf::from_str(path);
    if p.is_err() {
        return Err(SerdeErr::Custom(format!(
            "{:?} cannot be converted to a path",
            path
        )));
    }
    let mut path_buf = p.unwrap();
    let ext = path_buf.extension();
    if ext.is_none() {
        return Err(SerdeErr::Custom(format!(
            "cannot find the extension from the {:?}",
            path
        )));
    }
    let file_stem = path_buf.file_stem();
    if file_stem.is_none() {
        return Err(SerdeErr::Custom(format!(
            "cannot find the file stem from the {:?}",
            path
        )));
    }
    let mut file_stem = file_stem.unwrap().to_os_string();
    let ext = ext.unwrap().to_os_string();
    file_stem.push(".");
    file_stem.push(ext);
    file_stem.push(".rels");
    path_buf.pop();
    path_buf.push("_rels");
    path_buf.push(file_stem);
    Ok(path_buf)
}

/// Given the current path of the relationship and target, get the abs path of the target.
/// In rust std library, there is no function like 'join' in javascript that can join 2 paths and remove '..' or '.' in
/// the path. Therefore, we make an easy implmentation here.
fn get_target_abs_path(rels: &str, target: &str) -> PathBuf {
    let p = PathBuf::from_str(rels);
    let mut path_buf = p.unwrap();
    path_buf.pop();
    if path_buf.ends_with("_rels") {
        path_buf.pop();
    }
    let t = PathBuf::from_str(target);
    let target = t.unwrap();
    target.components().for_each(|c| match c {
        std::path::Component::Prefix(_) => unreachable!(),
        std::path::Component::RootDir => unreachable!(),
        std::path::Component::CurDir => {}
        std::path::Component::ParentDir => {
            path_buf.pop();
        }
        std::path::Component::Normal(s) => {
            path_buf.push(s);
        }
    });
    path_buf
}

#[cfg(test)]
mod tests {
    use super::get_rels;
    use super::get_target_abs_path;
    use super::read;
    #[test]
    fn get_rels_test() {
        let p = "/foo/test.xml";
        let s = get_rels(p);
        match s {
            Ok(e) => assert_eq!(e.to_str().unwrap(), r"/foo/_rels/test.xml.rels"),
            Err(_) => panic!(),
        }
    }

    #[test]
    fn get_target_abs_path_test() {
        let target = "../comments6.xml";
        let rels = "xl/worksheets/_rels/sheet8.xml.rels";
        let result = get_target_abs_path(rels, target);
        let s = result.to_str().unwrap();
        assert_eq!(s, "xl/comments6.xml");
    }
}
