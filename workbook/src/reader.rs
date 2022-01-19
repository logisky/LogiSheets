use std::io::{BufReader, Cursor};
use std::path::Path;
use zip::ZipArchive;

use crate::app_properties::AppProperties;
use crate::comments::Comments;
use crate::content_types::ContentTypes;
use crate::core_properties::CoreProperties;
use crate::custom::Properties as CustomProperties;
use crate::errors::Result;
use crate::external_link::ExternalLinkPart;
use crate::relationships::RelationshipsPart;
use crate::shared_string_table::SstPart;
use crate::styles::StyleSheetPart;
use crate::workbook::{ExternalReference, Sheet, WorkbookPart};
use crate::worksheet::WorksheetPart;
use crate::xml_element::OpenXmlDeserialize;

#[derive(Debug)]
pub struct Spreadsheet {
    pub content_types: ContentTypes,
    pub doc_props: DocProps,
    pub rels: RelationshipsPart,
    pub workbook: Workbook,
}

impl Spreadsheet {
    pub fn read(buf: &[u8]) -> Result<Self> {
        let reader = Cursor::new(buf);
        let mut archive = ZipArchive::new(reader)?;
        let content_types_file = archive.by_name("[Content_Types].xml")?;
        let reader = BufReader::new(content_types_file);
        let content_types = ContentTypes::from_xml_reader(reader)?;

        let rels_file = archive.by_name("_rels/.rels")?;
        let reader = BufReader::new(rels_file);
        let rels = RelationshipsPart::from_xml_reader(reader)?;

        let doc_props = read_doc_props(&mut archive).unwrap_or(DocProps::default());

        let workbook = read_workbook(&mut archive)?;

        Ok(Spreadsheet {
            content_types,
            doc_props,
            rels,
            workbook,
        })
    }
}

#[derive(Debug, Default)]
pub struct DocProps {
    pub app: AppProperties,
    pub core: CoreProperties,
    pub custom: Option<CustomProperties>,
}

#[derive(Debug)]
pub struct Workbook {
    pub rels: RelationshipsPart,
    pub workbook: WorkbookPart,
    pub shared_strings: SstPart,
    pub styles: Option<StyleSheetPart>,
    pub external_links: Option<ExternalLinks>,
    pub worksheets: Worksheets,
}

#[derive(Debug)]
pub struct Worksheets {
    pub sheets: Vec<Worksheet>,
}

#[derive(Debug)]
pub struct Worksheet {
    pub rels: Option<RelationshipsPart>,
    pub comment: Option<Comments>,
    pub sheet: WorksheetPart,
}

#[derive(Debug)]
pub struct ExternalLinks {
    pub external_links: Vec<ExternalLink>,
}

#[derive(Debug)]
pub struct ExternalLink {
    pub rels: RelationshipsPart,
    pub external_link: ExternalLinkPart,
}

fn read_doc_props(archive: &mut ZipArchive<Cursor<&[u8]>>) -> Result<DocProps> {
    let app_file = archive.by_name("docProps/app.xml")?;
    let reader = BufReader::new(app_file);
    let app = AppProperties::from_xml_reader(reader)?;
    let core_file = archive.by_name("docProps/core.xml")?;
    let reader = BufReader::new(core_file);
    let core = CoreProperties::from_xml_reader(reader)?;
    let custom_file = archive.by_name("docProps/custom.xml");
    let custom = match custom_file {
        Ok(file) => {
            let reader = BufReader::new(file);
            Some(CustomProperties::from_xml_reader(reader)?)
        }
        Err(_) => None,
    };

    Ok(DocProps { app, core, custom })
}

fn read_workbook(archive: &mut ZipArchive<Cursor<&[u8]>>) -> Result<Workbook> {
    let rels_file = archive.by_name("xl/_rels/workbook.xml.rels")?;
    let reader = BufReader::new(rels_file);
    let rels = RelationshipsPart::from_xml_reader(reader)?;
    let workbook_file = archive.by_name("xl/workbook.xml")?;
    let reader = BufReader::new(workbook_file);
    let workbook = WorkbookPart::from_xml_reader(reader)?;

    let sst_file = archive.by_name("xl/sharedStrings.xml")?;
    let reader = BufReader::new(sst_file);
    let shared_strings = SstPart::from_xml_reader(reader)?;

    let styles_file = archive.by_name("xl/styles.xml");

    let styles = match styles_file.into() {
        Ok(file) => {
            let reader = BufReader::new(file);
            Some(StyleSheetPart::from_xml_reader(reader)?)
        }
        Err(_) => None,
    };

    let external_links = read_external_links(archive, &workbook, &rels)?;

    let worksheets = read_worksheets(archive, &workbook, &rels)?;

    Ok(Workbook {
        rels,
        workbook,
        shared_strings,
        styles,
        external_links,
        worksheets,
    })
}

fn read_worksheets(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
    workbook: &WorkbookPart,
    rels: &RelationshipsPart,
) -> Result<Worksheets> {
    workbook
        .sheets
        .sheet
        .iter()
        .try_fold(
            Vec::with_capacity(workbook.sheets.sheet.len()),
            |mut sheets, s| match read_worksheet(archive, s, rels) {
                Ok(ws) => {
                    sheets.push(ws);
                    Ok(sheets)
                }
                Err(e) => Err(e),
            },
        )
        .map_or_else(|e| Err(e), |sheets| Ok(Worksheets { sheets }))
}

fn read_worksheet(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
    sheet: &Sheet,
    rels: &RelationshipsPart,
) -> Result<Worksheet> {
    let rel = rels.get_relationship(sheet.r_id.as_str()).unwrap();

    let sheet_path = format!("xl/{}", rel.target);
    let sheet_file = archive.by_name(sheet_path.as_str())?;
    let reader = BufReader::new(sheet_file);
    let sheet_part = WorksheetPart::from_xml_reader(reader)?;

    let path = Path::new(&sheet_path);
    let parent_path = path.parent().unwrap().to_str().unwrap();
    let sheet_name = path.file_name().unwrap().to_str().unwrap();
    let rel_path = format!("{}/_rels/{}.rels", parent_path, sheet_name);
    let rel_file = archive.by_name(rel_path.as_str());
    let rels_part = match rel_file.into() {
        Ok(file) => {
            let reader = BufReader::new(file);
            Some(RelationshipsPart::from_xml_reader(reader)?)
        }
        Err(_) => None,
    };
    let comment_part = match &rels_part {
        Some(rels_part) => {
            let rels_comment_type =
                "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
            let result = rels_part.get_relationship_from_type(rels_comment_type);
            match result {
                Some(rel) => {
                    let comment_base_name = Path::new(&rel.target)
                        .file_name()
                        .unwrap()
                        .to_str()
                        .unwrap();
                    let comment_path = format!("xl/{}", comment_base_name);
                    let comment_file = archive.by_name(comment_path.as_str())?;
                    let reader = BufReader::new(comment_file);
                    Some(Comments::from_xml_reader(reader)?)
                }
                None => None,
            }
        }
        None => None,
    };
    Ok(Worksheet {
        rels: rels_part,
        comment: comment_part,
        sheet: sheet_part,
    })
}

fn read_external_links(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
    workbook: &WorkbookPart,
    rels: &RelationshipsPart,
) -> Result<Option<ExternalLinks>> {
    match &workbook.external_references {
        None => Ok(None),
        Some(ers) => ers
            .external_reference
            .iter()
            .try_fold(
                Vec::with_capacity(ers.external_reference.len()),
                |mut external_links, er| match read_external_link(archive, er, rels) {
                    Ok(el) => {
                        external_links.push(el);
                        Ok(external_links)
                    }
                    Err(e) => Err(e),
                },
            )
            .map_or_else(
                |e| Err(e),
                |external_links| Ok(Some(ExternalLinks { external_links })),
            ),
    }
}

fn read_external_link(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
    er: &ExternalReference,
    rels: &RelationshipsPart,
) -> Result<ExternalLink> {
    let rel = rels.get_relationship(er.rid.as_str()).unwrap();

    let el_path = format!("xl/{}", rel.target);
    let el_file = archive.by_name(el_path.as_str())?;
    let reader = BufReader::new(el_file);
    let external_link = ExternalLinkPart::from_xml_reader(reader)?;

    let path = Path::new(&el_path);
    let parent_path = path.parent().unwrap().to_str().unwrap();
    let el_name = path.file_name().unwrap().to_str().unwrap();
    let rels_path = format!("{}/_rels/{}.rels", parent_path, el_name);
    let rels_file = archive.by_name(rels_path.as_str())?;
    let reader = BufReader::new(rels_file);
    let rels = RelationshipsPart::from_xml_reader(reader)?;

    Ok(ExternalLink {
        external_link,
        rels,
    })
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    use super::Spreadsheet;
    use crate::errors::OoxmlError;

    #[test]
    fn loader_test() -> std::result::Result<(), OoxmlError> {
        let path_str = "examples/example.xlsx";
        let path = Path::new(path_str);
        let buf = fs::read(path).unwrap();
        Spreadsheet::read(&buf)?;
        Ok(())
    }

    #[test]
    fn loader_test2() -> std::result::Result<(), OoxmlError> {
        let path_str = "examples/6.xlsx";
        let path = Path::new(path_str);
        let buf = fs::read(path).unwrap();
        Spreadsheet::read(&buf)?;
        Ok(())
    }
}
