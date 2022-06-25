use crate::ooxml::content_types::{ContentTypes, CtDefault, CtOverride};
use crate::ooxml::doc_props::{DocPropApp, DocPropCore, DocPropCustom};
use crate::ooxml::relationships::{CtRelationship, Relationships};
use crate::prelude::StTargetMode;
use crate::prelude::{Comments, SstPart, StylesheetPart, ThemePart, WorkbookPart, WorksheetPart};
use crate::rtypes::{
    RType, COMMENTS, DOC_PROP_APP, DOC_PROP_CORE, DOC_PROP_CUSTOM, EXT_LINK, SST, STYLE, THEME,
    WORKBOOK, WORKSHEET,
};
use std::io::{Cursor, Write};
use xmlserde::xml_serialize_with_decl;
use zip::write::{FileOptions, ZipWriter};
use zip::CompressionMethod;

use crate::workbook::{DocProps, Workbook, Worksheet, Xl};
use zip::result::ZipResult;

macro_rules! define_se_func {
    ($func:ident, $t:ty, $rtype: expr) => {
        fn $func(obj: $t, writer: &mut Writer, path: FileLocation) -> ZipResult<WriteProof> {
            writer.start_file(path.clone(), options())?;
            let s = xml_serialize_with_decl(obj);
            writer.write(s.as_bytes())?;
            Ok(WriteProof {
                path,
                rtype: $rtype,
            })
        }
    };
}

#[derive(Debug, Clone)]
pub enum FileLocation {
    Ptr(&'static str),
    Owned(String),
}

impl From<String> for FileLocation {
    fn from(s: String) -> Self {
        FileLocation::Owned(s)
    }
}

impl From<&'static str> for FileLocation {
    fn from(s: &'static str) -> Self {
        FileLocation::Ptr(s)
    }
}

impl From<FileLocation> for String {
    fn from(s: FileLocation) -> Self {
        match s {
            FileLocation::Ptr(s) => s.to_string(),
            FileLocation::Owned(s) => s,
        }
    }
}

/// WriteProof contains the information of a written part.
pub struct WriteProof {
    pub path: FileLocation,
    pub rtype: RType<'static>,
}

type Writer<'a> = ZipWriter<Cursor<&'a mut Vec<u8>>>;

pub fn write(wb: Workbook) -> ZipResult<Vec<u8>> {
    let mut buf = Vec::<u8>::with_capacity(65535);
    let mut writer: Writer = ZipWriter::new(Cursor::new(&mut buf));
    let mut prooves = Vec::<WriteProof>::with_capacity(30);

    writer.add_directory("_rels", options())?;
    writer.add_directory("xl", options())?;

    let mut i = 1_usize;
    let mut relationships = Vec::<CtRelationship>::new();

    relationships.push(CtRelationship {
        id: format!("rId{}", i),
        ty: WORKBOOK.0.to_string(),
        target: String::from("xl/workbook.xml"),
        target_mode: StTargetMode::Internal,
    });
    i += 1;

    let ps = write_doc_props(wb.doc_props, &mut writer)?;
    ps.iter().for_each(|wp| match &wp.rtype {
        &DOC_PROP_APP => {
            let relationship = CtRelationship {
                id: format!("rId{}", i),
                ty: wp.rtype.0.to_string(),
                target: String::from("docProps/app.xml"),
                target_mode: StTargetMode::Internal,
            };
            relationships.push(relationship);
            i += 1;
        }
        &DOC_PROP_CUSTOM => {
            let relationship = CtRelationship {
                id: format!("rId{}", i),
                ty: wp.rtype.0.to_string(),
                target: String::from("docProps/custom.xml"),
                target_mode: StTargetMode::Internal,
            };
            relationships.push(relationship);
            i += 1;
        }
        &DOC_PROP_CORE => {
            let relationship = CtRelationship {
                id: format!("rId{}", i),
                ty: wp.rtype.0.to_string(),
                target: String::from("docProps/core.xml"),
                target_mode: StTargetMode::Internal,
            };
            relationships.push(relationship);
            i += 1;
        }
        _ => unreachable!(),
    });
    prooves.extend(ps);

    let ps = write_xl(wb.xl, &mut writer)?;
    prooves.extend(ps);

    write_content_types(prooves, &mut writer)?;

    write_relationships(Relationships { relationships }, &mut writer, "_rels/.rels")?;

    writer.finish()?;

    drop(writer);
    Ok(buf)
}

fn write_xl(xl: Xl, writer: &mut Writer) -> ZipResult<Vec<WriteProof>> {
    let mut result = Vec::<WriteProof>::with_capacity(10);
    let mut relationships = Vec::<CtRelationship>::new();

    let mut worksheets = xl.worksheets;
    let mut sheet_ids = xl
        .workbook_part
        .sheets
        .sheets
        .iter()
        .rev()
        .map(|s| s.id.clone())
        .collect::<Vec<_>>();

    let mut idx = 1;

    writer.add_directory("xl/worksheets", options())?;
    writer.add_directory("xl/worksheets/_rels", options())?;

    while let Some(sheet_id) = sheet_ids.pop() {
        if let Some(ws) = worksheets.remove(&sheet_id) {
            let prooves = write_worksheet(ws, writer, idx)?;
            result.extend(prooves);
            relationships.push(CtRelationship {
                id: sheet_id,
                ty: WORKSHEET.0.to_string(),
                target: format!("worksheets/sheet{}.xml", idx),
                target_mode: StTargetMode::Internal,
            });
            idx += 1;
        }
    }

    if let Some(sst) = xl.sst {
        let sst_proof = write_sst(sst.1, writer, FileLocation::from("xl/sharedStrings.xml"))?;
        result.push(sst_proof);
        relationships.push(CtRelationship {
            id: sst.0,
            ty: SST.0.to_string(),
            target: String::from("sharedStrings.xml"),
            target_mode: StTargetMode::Internal,
        });
    }

    let style_proof = write_stylesheet(xl.styles.1, writer, FileLocation::from("xl/styles.xml"))?;
    result.push(style_proof);
    relationships.push(CtRelationship {
        id: xl.styles.0,
        ty: STYLE.0.to_string(),
        target: String::from("styles.xml"),
        target_mode: StTargetMode::Internal,
    });

    if let Some(theme) = xl.theme {
        writer.add_directory("xl/theme", options())?;
        let theme_proof = write_theme(theme.1, writer, FileLocation::from("xl/theme/theme1.xml"))?;
        result.push(theme_proof);
        relationships.push(CtRelationship {
            id: theme.0,
            ty: THEME.0.to_string(),
            target: String::from("theme/theme1.xml"),
            target_mode: StTargetMode::Internal,
        });
    }

    let p = write_workbook_part(
        xl.workbook_part,
        writer,
        FileLocation::from("xl/workbook.xml"),
    )?;
    result.push(p);

    writer.add_directory("xl/_rels", options())?;

    write_relationships(
        Relationships { relationships },
        writer,
        "xl/_rels/workbook.xml.rels",
    )?;

    Ok(result)
}

fn write_worksheet<'a>(
    wb: Worksheet,
    writer: &mut Writer,
    idx: usize,
) -> ZipResult<Vec<WriteProof>> {
    let mut result = Vec::<WriteProof>::new();
    let mut relationships = Vec::<CtRelationship>::new();
    let rid = 1_usize;

    if let Some(comments) = wb.comments {
        let p = write_comment(
            comments,
            writer,
            FileLocation::from(format!("xl/comments{}.xml", idx)),
        )?;
        relationships.push(CtRelationship {
            id: format!("rId{}", rid),
            target: format!("../comments{}.xml", idx),
            ty: COMMENTS.0.to_string(),
            target_mode: StTargetMode::Internal,
        });
        result.push(p);
    }

    let proof = write_sheet_part(
        wb.worksheet_part,
        writer,
        FileLocation::from(format!("xl/worksheets/sheet{}.xml", idx)),
    )?;
    result.push(proof);

    write_relationships(
        Relationships { relationships },
        writer,
        &format!("xl/worksheets/_rels/sheet{}.xml.rels", idx),
    )?;

    Ok(result)
}

define_se_func!(write_sst, SstPart, SST);
define_se_func!(write_stylesheet, StylesheetPart, STYLE);
define_se_func!(write_theme, ThemePart, THEME);

define_se_func!(write_comment, Comments, COMMENTS);
define_se_func!(write_sheet_part, WorksheetPart, WORKSHEET);
define_se_func!(write_workbook_part, WorkbookPart, WORKBOOK);

define_se_func!(write_doc_app, DocPropApp, DOC_PROP_APP);
define_se_func!(write_doc_core, DocPropCore, DOC_PROP_CORE);
define_se_func!(write_doc_custom, DocPropCustom, DOC_PROP_CUSTOM);

fn write_relationships(obj: Relationships, writer: &mut Writer, path: &str) -> ZipResult<()> {
    if obj.relationships.len() == 0 {
        return Ok(());
    }
    writer.start_file(path, options())?;
    let s = xml_serialize_with_decl(obj);
    writer.write(s.as_bytes())?;
    Ok(())
}

fn write_doc_props(doc_props: DocProps, writer: &mut Writer) -> ZipResult<Vec<WriteProof>> {
    if doc_props.is_empty() {
        return Ok(vec![]);
    }

    let mut result = Vec::<WriteProof>::with_capacity(3);
    let mut doc_props = doc_props;

    writer.add_directory("docProps", options())?;

    if let Some(app) = doc_props.app.take() {
        let p = write_doc_app(app, writer, FileLocation::from("docProps/app.xml"))?;
        result.push(p);
    }

    if let Some(core) = doc_props.core.take() {
        let p = write_doc_core(core, writer, FileLocation::from("docProps/core.xml"))?;
        result.push(p);
    }

    if let Some(custom) = doc_props.custom.take() {
        let p = write_doc_custom(custom, writer, FileLocation::from("docProps/custom.xml"))?;
        result.push(p);
    }
    Ok(result)
}

fn write_content_types(prooves: Vec<WriteProof>, writer: &mut Writer) -> ZipResult<()> {
    let defaults = vec![
        CtDefault {
            extension: String::from("bin"),
            content_type: String::from("application/vnd.ms-office.activeX"),
        },
        CtDefault {
            extension: String::from("emf"),
            content_type: String::from("image/x-emf"),
        },
        CtDefault {
            extension: String::from("jpeg"),
            content_type: String::from("image/jpeg"),
        },
        CtDefault {
            extension: String::from("png"),
            content_type: String::from("image/png"),
        },
        CtDefault {
            extension: String::from("rels"),
            content_type: String::from("application/vnd.openxmlformats-package.relationships+xml"),
        },
        CtDefault {
            extension: String::from("vml"),
            content_type: String::from("application/vnd.openxmlformats-officedocument.vmlDrawing"),
        },
        CtDefault {
            extension: String::from("wmf"),
            content_type: String::from("image/x-wmf"),
        },
        CtDefault {
            extension: String::from("xml"),
            content_type: String::from("application/xml"),
        },
    ];
    let overides = prooves
        .into_iter()
        .fold(Vec::<CtOverride>::new(), |mut prev, p| {
            let c = CtOverride {
                part_name: format!("/{}", String::from(p.path)),
                content_type: get_content_type(p.rtype).into(),
            };
            prev.push(c);
            prev
        });
    let content_types = ContentTypes { defaults, overides };
    let s = xml_serialize_with_decl(content_types);
    writer.start_file("[Content_Types].xml", options())?;
    writer.write(s.as_bytes())?;
    Ok(())
}

fn get_content_type(rtype: RType) -> &'static str {
    match rtype {
        SST => "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml",
        COMMENTS => "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml",
        WORKSHEET => "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
        WORKBOOK => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
        DOC_PROP_APP => "application/vnd.openxmlformats-officedocument.extended-properties+xml",
        DOC_PROP_CORE => "application/vnd.openxmlformats-package.core-properties+xml",
        DOC_PROP_CUSTOM => "application/vnd.openxmlformats-officedocument.custom-properties+xml",
        STYLE => "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml",
        EXT_LINK => "application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml",
        THEME => "application/vnd.openxmlformats-officedocument.theme+xml",
        _ => unreachable!(),
    }
}

fn options() -> FileOptions {
    FileOptions::default().compression_method(CompressionMethod::Stored)
}

#[cfg(test)]
mod tests {
    use super::write;
    use crate::zipdiff::zipdiff;
    use std::{fs, io::Write};
    #[ignore]
    #[test]
    fn write_test_1() {
        let mut buf = fs::read("../../tests/builtin_style.xlsx").unwrap();
        let wb = crate::workbook::Workbook::from_file(&mut buf).unwrap();
        assert!(wb.doc_props.app.is_some());
        assert!(wb.doc_props.core.is_some());
        assert!(wb.doc_props.custom.is_some());
        let res = write(wb).unwrap();
        let mut f = fs::File::create("tests_output/builtin_style.zip").unwrap();
        f.write_all(&res).unwrap();
        let mut f = fs::File::create("tests_output/builtin_style.xlsx").unwrap();
        f.write_all(&res).unwrap();
        zipdiff(&buf, &res);
    }

    #[ignore]
    #[test]
    fn write_test_2() {
        let mut buf = fs::read("../../tests/6.xlsx").unwrap();
        let wb = crate::workbook::Workbook::from_file(&mut buf).unwrap();
        let res = write(wb).unwrap();
        let mut f = fs::File::create("tests_output/6.zip").unwrap();
        f.write_all(&res).unwrap();
        let mut f = fs::File::create("tests_output/6.xlsx").unwrap();
        f.write_all(&res).unwrap();
        zipdiff(&buf, &res);
    }
}
