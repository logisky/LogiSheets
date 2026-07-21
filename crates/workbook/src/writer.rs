use crate::logisheets::LogiSheetsData;
use crate::ooxml::complex_types::CtDrawing;
use crate::ooxml::content_types::{ContentTypes, CtDefault, CtOverride};
use crate::ooxml::doc_props::{DocPropApp, DocPropCore, DocPropCustom};
use crate::ooxml::drawing_part::CtWsDr;
use crate::ooxml::relationships::{CtRelationship, Relationships};
use crate::prelude::StTargetMode;
use crate::prelude::{
    Comments, Persons, SstPart, StylesheetPart, ThemePart, ThreadedComments, WorkbookPart,
    WorksheetPart,
};
use crate::rtypes::{
    CHART, CHART_COLOR_STYLE, CHART_STYLE, COMMENTS, DOC_PROP_APP, DOC_PROP_CORE, DOC_PROP_CUSTOM,
    DRAWING, EXT_LINK, LOGISHEETS_APP_DATA, PERSON, RType, SST, STYLE, THEME, THREADED_COMMENT,
    WORKBOOK, WORKSHEET,
};
use std::io::{Cursor, Write};
use xmlserde::xml_serialize_with_decl;
use zip::CompressionMethod;
use zip::write::{FileOptions, ZipWriter};

use crate::workbook::{DocProps, Wb, Worksheet, Xl};
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

pub fn write(wb: Wb) -> ZipResult<Vec<u8>> {
    let mut buf = Vec::<u8>::with_capacity(65535);
    let mut writer: Writer = ZipWriter::new(Cursor::new(&mut buf));
    let mut proofs = Vec::<WriteProof>::with_capacity(30);

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
    proofs.extend(ps);

    if let Some(logisheets) = wb.logisheets {
        let p = write_logisheets_data(logisheets, &mut writer)?;
        let relationship = CtRelationship {
            id: format!("rId{}", i),
            target_mode: StTargetMode::Internal,
            target: String::from("logisheets/data.xml"),
            ty: p.rtype.0.to_string(),
        };
        proofs.push(p);
        relationships.push(relationship);
        // i += 1;
    }

    let ps = write_xl(wb.xl, &mut writer)?;
    proofs.extend(ps);

    write_content_types(proofs, &mut writer)?;

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
    if worksheets.values().any(|w| w.threaded_comments.is_some()) {
        writer.add_directory("xl/threadedComments", options())?;
    }
    if worksheets.values().any(|w| w.drawing.is_some()) {
        writer.add_directory("xl/drawings", options())?;
        writer.add_directory("xl/drawings/_rels", options())?;
    }
    if worksheets
        .values()
        .any(|w| w.drawing.as_ref().is_some_and(|d| !d.chart_parts.is_empty()))
    {
        writer.add_directory("xl/charts", options())?;
        writer.add_directory("xl/charts/_rels", options())?;
    }

    // Binary media parts (images) live under xl/media/ and are shared across
    // the workbook. Written once here; drawings reference them via rels.
    if !xl.medias.is_empty() {
        writer.add_directory("xl/media", options())?;
        for media in xl.medias.iter() {
            writer.start_file(format!("xl/media/{}", media.name), options())?;
            writer.write(&media.data)?;
        }
    }

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

    if let Some(persons) = xl.persons {
        writer.add_directory("xl/persons", options())?;
        let persons_proof =
            write_persons(persons, writer, FileLocation::from("xl/persons/person.xml"))?;
        result.push(persons_proof);
        relationships.push(CtRelationship {
            id: String::from("rIdPersons"),
            ty: PERSON.0.to_string(),
            target: String::from("persons/person.xml"),
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

fn write_logisheets_data(data: LogiSheetsData, writer: &mut Writer) -> ZipResult<WriteProof> {
    writer.add_directory("logisheets", options())?;
    writer.start_file("logisheets/data.xml", options()).unwrap();
    let s = xml_serialize_with_decl(data);
    writer.write(s.as_bytes())?;
    Ok(WriteProof {
        path: FileLocation::from("logisheets/data.xml"),
        rtype: LOGISHEETS_APP_DATA,
    })
}

fn write_worksheet<'a>(
    mut wb: Worksheet,
    writer: &mut Writer,
    idx: usize,
) -> ZipResult<Vec<WriteProof>> {
    let mut result = Vec::<WriteProof>::new();
    let mut relationships = Vec::<CtRelationship>::new();
    let mut rid = 1_usize;

    // A drawing part holds the sheet's cell images. Emit it (plus its own rels
    // to media) and point the worksheet's <drawing r:id> at it.
    if let Some(drawing) = wb.drawing.take() {
        let drawing_rid = format!("rId{}", rid);
        rid += 1;
        let p = write_drawing_part(
            drawing.content,
            writer,
            FileLocation::from(format!("xl/drawings/drawing{}.xml", idx)),
        )?;
        result.push(p);
        write_relationships(
            Relationships {
                relationships: drawing.rels,
            },
            writer,
            &format!("xl/drawings/_rels/drawing{}.xml.rels", idx),
        )?;
        relationships.push(CtRelationship {
            id: drawing_rid.clone(),
            target: format!("../drawings/drawing{}.xml", idx),
            ty: DRAWING.0.to_string(),
            target_mode: StTargetMode::Internal,
        });
        wb.worksheet_part.drawing = Some(CtDrawing { id: drawing_rid });

        // Chart parts (and their style/color satellites) are written verbatim
        // at their preserved paths so the drawing's `graphicFrame` rels keep
        // resolving. Their content-type overrides come from the pushed proofs.
        for part in drawing.chart_parts {
            writer.start_file(part.path.clone(), options())?;
            writer.write(&part.data)?;
            if !part.rels.is_empty() {
                write_relationships(
                    Relationships {
                        relationships: part.rels,
                    },
                    writer,
                    &rels_path_for(&part.path),
                )?;
            }
            result.push(WriteProof {
                path: FileLocation::Owned(part.path),
                rtype: part.rtype,
            });
        }
    }

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
        rid += 1;
    }

    if let Some(threaded) = wb.threaded_comments {
        let p = write_threaded_comments(
            threaded,
            writer,
            FileLocation::from(format!("xl/threadedComments/threadedComment{}.xml", idx)),
        )?;
        relationships.push(CtRelationship {
            id: format!("rId{}", rid),
            target: format!("../threadedComments/threadedComment{}.xml", idx),
            ty: THREADED_COMMENT.0.to_string(),
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
define_se_func!(write_persons, Persons, PERSON);
define_se_func!(write_threaded_comments, ThreadedComments, THREADED_COMMENT);
define_se_func!(write_sheet_part, WorksheetPart, WORKSHEET);
define_se_func!(write_workbook_part, WorkbookPart, WORKBOOK);
define_se_func!(write_drawing_part, CtWsDr, DRAWING);

define_se_func!(write_doc_app, DocPropApp, DOC_PROP_APP);
define_se_func!(write_doc_core, DocPropCore, DOC_PROP_CORE);
define_se_func!(write_doc_custom, DocPropCustom, DOC_PROP_CUSTOM);

/// Map a part path to its relationships path, e.g.
/// `xl/charts/chart1.xml` -> `xl/charts/_rels/chart1.xml.rels`.
fn rels_path_for(path: &str) -> String {
    match path.rfind('/') {
        Some(i) => format!("{}/_rels/{}.rels", &path[..i], &path[i + 1..]),
        None => format!("_rels/{}.rels", path),
    }
}

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

fn write_content_types(proofs: Vec<WriteProof>, writer: &mut Writer) -> ZipResult<()> {
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
            extension: String::from("jpg"),
            content_type: String::from("image/jpeg"),
        },
        CtDefault {
            extension: String::from("gif"),
            content_type: String::from("image/gif"),
        },
        CtDefault {
            extension: String::from("bmp"),
            content_type: String::from("image/bmp"),
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
    let overides = proofs
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
        PERSON => "application/vnd.ms-excel.person+xml",
        THREADED_COMMENT => "application/vnd.ms-excel.threadedcomments+xml",
        WORKSHEET => "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
        WORKBOOK => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
        DOC_PROP_APP => "application/vnd.openxmlformats-officedocument.extended-properties+xml",
        DOC_PROP_CORE => "application/vnd.openxmlformats-package.core-properties+xml",
        DOC_PROP_CUSTOM => "application/vnd.openxmlformats-officedocument.custom-properties+xml",
        STYLE => "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml",
        EXT_LINK => "application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml",
        THEME => "application/vnd.openxmlformats-officedocument.theme+xml",
        DRAWING => "application/vnd.openxmlformats-officedocument.drawing+xml",
        CHART => "application/vnd.openxmlformats-officedocument.drawingml.chart+xml",
        CHART_STYLE => "application/vnd.ms-office.chartstyle+xml",
        CHART_COLOR_STYLE => "application/vnd.ms-office.chartcolorstyle+xml",
        _ => "",
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
        let wb = crate::workbook::Wb::from_file(&mut buf).unwrap();
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

    fn read_zip_entry(bytes: &[u8], name: &str) -> String {
        use std::io::Read;
        let mut a = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
        let mut f = a.by_name(name).unwrap();
        let mut s = String::new();
        f.read_to_string(&mut s).unwrap();
        s
    }

    #[test]
    fn chart_round_trips() {
        use crate::workbook::Wb;
        let buf = fs::read("../../tests/graph.xlsx").unwrap();
        let wb = Wb::from_file(&buf).unwrap();

        // The chart tree is read off the drawing as opaque passthrough parts.
        let d = wb
            .xl
            .worksheets
            .values()
            .filter_map(|w| w.drawing.as_ref())
            .find(|d| !d.chart_parts.is_empty())
            .expect("chart parts should be read from the drawing");
        assert!(d.chart_parts.iter().any(|p| p.path.ends_with("chart1.xml")));
        assert!(d.chart_parts.iter().any(|p| p.path.ends_with("style1.xml")));
        assert!(d.chart_parts.iter().any(|p| p.path.ends_with("colors1.xml")));
        // Both anchor object-kinds present in this fixture are preserved: the
        // chart's graphicFrame and the text-box shape.
        assert!(
            d.content
                .two_cell_anchors
                .iter()
                .any(|a| a.graphic_frame.is_some())
        );
        assert!(d.content.two_cell_anchors.iter().any(|a| a.sp.is_some()));

        let orig_chart = d
            .chart_parts
            .iter()
            .find(|p| p.path.ends_with("chart1.xml"))
            .map(|p| p.data.clone())
            .unwrap();

        // Round-trip: write, then re-read the output.
        let out = write(wb).unwrap();
        let wb2 = Wb::from_file(&out).unwrap();
        let d2 = wb2
            .xl
            .worksheets
            .values()
            .filter_map(|w| w.drawing.as_ref())
            .find(|d| !d.chart_parts.is_empty())
            .expect("chart parts should survive the round-trip");

        assert!(
            d2.content
                .two_cell_anchors
                .iter()
                .any(|a| a.graphic_frame.is_some()),
            "graphicFrame anchor lost on round-trip"
        );
        assert!(d2.content.two_cell_anchors.iter().any(|a| a.sp.is_some()));

        // Opaque parts must be byte-identical after the round-trip.
        let rt_chart = d2
            .chart_parts
            .iter()
            .find(|p| p.path.ends_with("chart1.xml"))
            .map(|p| p.data.clone())
            .unwrap();
        assert_eq!(orig_chart, rt_chart, "chart1.xml bytes changed");

        // The content-type override for the chart part is emitted.
        let ct = read_zip_entry(&out, "[Content_Types].xml");
        assert!(ct.contains("/xl/charts/chart1.xml"), "chart override missing");
        assert!(
            ct.contains("drawingml.chart+xml"),
            "chart content-type missing"
        );
        assert!(ct.contains("/xl/charts/style1.xml"));
        assert!(ct.contains("/xl/charts/colors1.xml"));
    }

    #[ignore]
    #[test]
    fn write_test_2() {
        let mut buf = fs::read("../../tests/6.xlsx").unwrap();
        let wb = crate::workbook::Wb::from_file(&mut buf).unwrap();
        let res = write(wb).unwrap();
        let mut f = fs::File::create("tests_output/6.zip").unwrap();
        f.write_all(&res).unwrap();
        let mut f = fs::File::create("tests_output/6.xlsx").unwrap();
        f.write_all(&res).unwrap();
        zipdiff(&buf, &res);
    }
}
