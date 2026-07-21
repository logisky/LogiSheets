use super::SerdeErr;
use super::rtypes::*;
use crate::logisheets::LogiSheetsData;
use crate::ooxml::doc_props::DocPropApp;
use crate::ooxml::doc_props::DocPropCore;
use crate::ooxml::doc_props::DocPropCustom;
use crate::ooxml::drawing_part::CtWsDr;
use crate::ooxml::theme::ThemePart;
use crate::ooxml::{
    comments::Comments, external_links::ExternalLinkPart, persons::Persons,
    relationships::Relationships, sst::SstPart, style_sheet::StylesheetPart,
    threaded_comments::ThreadedComments, workbook::WorkbookPart, worksheet::WorksheetPart,
};
use crate::workbook::Id;
use crate::workbook::Media;
use crate::workbook::PassthroughPart;
use crate::workbook::WorksheetDrawing;
use crate::workbook::Xl;
use std::collections::HashMap;
use std::{
    io::{BufReader, Cursor, Read, Seek},
    path::PathBuf,
    str::FromStr,
};
use zip::ZipArchive;

use crate::workbook::DocProps;
use crate::workbook::ExternalLink;
use crate::{
    rtypes::RType,
    workbook::{Wb, Worksheet},
    xml_deserialize_from_reader,
};

pub fn read(buf: &[u8]) -> Result<Wb, SerdeErr> {
    let reader = Cursor::new(buf);
    let mut archive = ZipArchive::new(reader)?;
    let root = "_rels/.rels";
    let relationships = de_relationships(root, &mut archive)?;
    let mut xl = Err(SerdeErr::Custom(String::from(
        "Cannot find the workbook part",
    )));
    let mut doc_prop_core = Option::<DocPropCore>::None;
    let mut doc_prop_custom = Option::<DocPropCustom>::None;
    let mut doc_prop_app = Option::<DocPropApp>::None;
    let mut logisheets = Option::<LogiSheetsData>::None;
    relationships
        .relationships
        .into_iter()
        .for_each(|p| match RType(&p.ty) {
            WORKBOOK => {
                let target = &p.target;
                xl = de_xl(target, &mut archive);
            }
            DOC_PROP_APP => {
                let target = &p.target;
                match de_doc_prop_app(target, &mut archive) {
                    Ok(app) => {
                        doc_prop_app = Some(app);
                    }
                    Err(e) => {
                        println!("parsing file: {:?} but meet error:{:?}", target, e)
                    }
                }
            }
            DOC_PROP_CORE => {
                let target = &p.target;
                match de_doc_prop_core(target, &mut archive) {
                    Ok(core) => {
                        doc_prop_core = Some(core);
                    }
                    Err(e) => {
                        println!("parsing file: {:?} but meet error:{:?}", target, e)
                    }
                }
            }
            DOC_PROP_CUSTOM => {
                let target = &p.target;
                match de_doc_prop_custom(target, &mut archive) {
                    Ok(custom) => {
                        doc_prop_custom = Some(custom);
                    }
                    Err(e) => {
                        println!("parsing file: {:?} but meet error:{:?}", target, e)
                    }
                }
            }
            LOGISHEETS_APP_DATA => {
                let target = &p.target;
                match de_logisheets_data(target, &mut archive) {
                    Ok(data) => {
                        logisheets = Some(data);
                    }
                    Err(e) => {
                        println!("parsing file: {:?} but meet error:{:?}", target, e)
                    }
                }
            }
            _ => {}
        });
    let xl = xl?;
    let doc_props = DocProps {
        app: doc_prop_app,
        custom: doc_prop_custom,
        core: doc_prop_core,
    };
    Ok(Wb {
        xl,
        doc_props,
        logisheets,
    })
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

fn de_xl<R: Read + Seek>(path: &str, archive: &mut ZipArchive<R>) -> Result<Xl, SerdeErr> {
    let workbook_part = de_workbook_part(path, archive)?;
    let mut styles = Option::<(Id, StylesheetPart)>::None;
    let mut sst = Option::<(Id, SstPart)>::None;
    let mut worksheets = HashMap::<Id, Worksheet>::new();
    let mut external_links = HashMap::<Id, ExternalLink>::new();
    let mut theme = Option::<(Id, ThemePart)>::None;
    let mut persons = Option::<Persons>::None;
    let mut medias = Vec::<Media>::new();
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
                    match de_worksheet(s, archive, &mut medias) {
                        Ok(w) => {
                            worksheets.insert(id, w);
                        }
                        Err(e) => {
                            println!("parsing file: {:?} but meet error:{:?}", s, e)
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
                            println!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            SST => {
                let target = &r.target;
                let id = r.id;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_sst(s, archive) {
                        Ok(w) => {
                            sst = Some((id, w));
                        }
                        Err(e) => {
                            println!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            STYLE => {
                let target = &r.target;
                let id = r.id;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_style_part(s, archive) {
                        Ok(w) => {
                            styles = Some((id, w));
                        }
                        Err(e) => {
                            println!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            THEME => {
                let target = &r.target;
                let id = r.id;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_theme(s, archive) {
                        Ok(w) => {
                            theme = Some((id, w));
                        }
                        Err(e) => {
                            println!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            PERSON => {
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(s) = path.to_str() {
                    match de_persons(s, archive) {
                        Ok(p) => {
                            persons = Some(p);
                        }
                        Err(e) => {
                            println!("parsing file: {:?} but meet error:{:?}", s, e)
                        }
                    }
                }
            }
            _ => {}
        });
    Ok(Xl {
        workbook_part,
        styles: styles.unwrap(),
        sst,
        worksheets,
        external_links,
        theme,
        persons,
        medias,
    })
}

fn de_worksheet<R: Read + Seek>(
    path: &str,
    archive: &mut ZipArchive<R>,
    medias: &mut Vec<Media>,
) -> Result<Worksheet, SerdeErr> {
    let worksheet_part = de_worksheet_part(path, archive)?;
    let mut comments = Option::<Comments>::None;
    let mut threaded_comments = Option::<ThreadedComments>::None;
    let mut drawing = Option::<WorksheetDrawing>::None;
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
            threaded_comments,
            drawing,
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
            THREADED_COMMENT => {
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(tc_path) = path.to_str() {
                    match de_threaded_comments(tc_path, archive) {
                        Ok(c) => {
                            threaded_comments = Some(c);
                        }
                        Err(_) => {}
                    }
                }
            }
            DRAWING => {
                let target = &r.target;
                let path = get_target_abs_path(rels, target);
                if let Some(d_path) = path.to_str() {
                    match de_ws_drawing(d_path, archive, medias) {
                        Ok(d) => {
                            drawing = Some(d);
                        }
                        Err(e) => {
                            println!("parsing drawing: {:?} but meet error:{:?}", d_path, e)
                        }
                    }
                }
            }
            _ => {}
        });
    Ok(Worksheet {
        worksheet_part,
        comments,
        threaded_comments,
        drawing,
    })
}

/// Read a worksheet drawing part (`xl/drawings/drawingN.xml`) plus its
/// relationships, and pull any referenced image media into `medias`.
fn de_ws_drawing<R: Read + Seek>(
    path: &str,
    archive: &mut ZipArchive<R>,
    medias: &mut Vec<Media>,
) -> Result<WorksheetDrawing, SerdeErr> {
    let content = de_drawing_part(path, archive)?;
    let rels_buf = get_rels(path)?;
    let relationships = match rels_buf.to_str() {
        Some(rels) => de_relationships(rels, archive)
            .map(|r| (rels.to_string(), r.relationships))
            .ok(),
        None => None,
    };
    let (rels_path, rels) = match relationships {
        Some(v) => v,
        None => {
            return Ok(WorksheetDrawing {
                content,
                rels: Vec::new(),
                chart_parts: Vec::new(),
            });
        }
    };
    let mut chart_parts = Vec::<PassthroughPart>::new();
    for r in rels.iter() {
        match RType(&r.ty) {
            IMAGE => {
                let media_abs = get_target_abs_path(&rels_path, &r.target);
                if let Some(mp) = media_abs.to_str() {
                    let name = mp.rsplit('/').next().unwrap_or(mp).to_string();
                    if !medias.iter().any(|m| m.name == name) {
                        if let Ok(data) = read_binary(mp, archive) {
                            medias.push(Media { name, data });
                        }
                    }
                }
            }
            CHART => {
                let chart_abs = get_target_abs_path(&rels_path, &r.target);
                if let Some(cs) = chart_abs.to_str() {
                    read_chart_tree(cs, archive, &mut chart_parts);
                }
            }
            _ => {}
        }
    }
    Ok(WorksheetDrawing {
        content,
        rels,
        chart_parts,
    })
}

/// Read a chart part plus its style/color satellites as opaque passthrough
/// parts. The chart part keeps its own relationships (to the satellites) so the
/// whole tree can be re-emitted verbatim.
fn read_chart_tree<R: Read + Seek>(
    chart_path: &str,
    archive: &mut ZipArchive<R>,
    out: &mut Vec<PassthroughPart>,
) {
    let chart = match read_passthrough_part(chart_path, CHART, archive) {
        Some(p) => p,
        None => return,
    };
    let chart_rels_path = get_rels(chart_path)
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_string()));
    let satellites = chart.rels.clone();
    out.push(chart);
    if let Some(crp) = chart_rels_path {
        for sr in satellites {
            let sat_rtype = match RType(&sr.ty) {
                CHART_STYLE => CHART_STYLE,
                CHART_COLOR_STYLE => CHART_COLOR_STYLE,
                _ => continue,
            };
            let sat_abs = get_target_abs_path(&crp, &sr.target);
            if let Some(ss) = sat_abs.to_str() {
                if let Some(part) = read_passthrough_part(ss, sat_rtype, archive) {
                    out.push(part);
                }
            }
        }
    }
}

/// Read a single part's bytes plus its `_rels` (if present) verbatim.
fn read_passthrough_part<R: Read + Seek>(
    path: &str,
    rtype: RType<'static>,
    archive: &mut ZipArchive<R>,
) -> Option<PassthroughPart> {
    let data = read_binary(path, archive).ok()?;
    let rels = get_rels(path)
        .ok()
        .and_then(|p| p.to_str().map(|s| s.to_string()))
        .and_then(|rp| de_relationships(&rp, archive).ok())
        .map(|r| r.relationships)
        .unwrap_or_default();
    Some(PassthroughPart {
        path: path.to_string(),
        data,
        rtype,
        rels,
    })
}

fn read_binary<R: Read + Seek>(
    path: &str,
    archive: &mut ZipArchive<R>,
) -> Result<Vec<u8>, SerdeErr> {
    let mut file = archive.by_name(path)?;
    let mut buf = Vec::new();
    file.read_to_end(&mut buf)?;
    Ok(buf)
}

macro_rules! define_de_func {
    ($func:ident, $t:ty) => {
        fn $func<R: Read + Seek>(path: &str, archive: &mut ZipArchive<R>) -> Result<$t, SerdeErr> {
            let file = archive.by_name(path)?;
            let reader = BufReader::new(file);
            let result = xml_deserialize_from_reader::<$t, _>(reader);
            match result {
                Ok(r) => Ok(r),
                Err(s) => Err(SerdeErr::Custom(s)),
            }
        }
    };
}

define_de_func!(de_relationships, Relationships);
define_de_func!(de_external_link_part, ExternalLinkPart);
define_de_func!(de_workbook_part, WorkbookPart);
define_de_func!(de_worksheet_part, WorksheetPart);
define_de_func!(de_comments, Comments);
define_de_func!(de_persons, Persons);
define_de_func!(de_threaded_comments, ThreadedComments);
define_de_func!(de_sst, SstPart);
define_de_func!(de_style_part, StylesheetPart);
define_de_func!(de_theme, ThemePart);
define_de_func!(de_drawing_part, CtWsDr);
define_de_func!(de_doc_prop_custom, DocPropCustom);
define_de_func!(de_doc_prop_app, DocPropApp);
define_de_func!(de_doc_prop_core, DocPropCore);
define_de_func!(de_logisheets_data, LogiSheetsData);

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
