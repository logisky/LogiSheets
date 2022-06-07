use crate::ooxml::sst::SstPart;
use crate::rtypes::RType;
use std::io::{Cursor, Write};
use xmlserde::xml_serialize_with_decl;
use zip::write::{FileOptions, ZipWriter};
use zip::CompressionMethod;

use crate::workbook::{DocProps, Workbook, Xl};
use zip::result::ZipResult;

type Writer<'a> = ZipWriter<Cursor<&'a mut Vec<u8>>>;

pub fn write(wb: Workbook) -> ZipResult<Vec<u8>> {
    let mut buf = Vec::<u8>::with_capacity(65535);
    let mut writer: Writer = ZipWriter::new(Cursor::new(&mut buf));
    write_doc_props(wb.doc_props, &mut writer)?;
    write_xl(wb.xl, &mut writer)?;
    writer.finish()?;
    drop(writer);
    Ok(buf)
}

fn write_xl(mut wb: Xl, writer: &mut Writer) -> ZipResult<Vec<RType<'static>>> {
    writer.add_directory("xl", options())?;
    if let Some(sst) = wb.sst.take() {
        write_sst(sst, writer, "xl/sharedStrings.xml")?;
    }
    todo!()
}

fn write_sst(sst: SstPart, writer: &mut Writer, path: &str) -> ZipResult<()> {
    writer.start_file(path, options())?;
    let s = xml_serialize_with_decl(sst);
    writer.write(s.as_bytes())?;
    Ok(())
}

fn write_doc_props(doc_props: DocProps, writer: &mut Writer) -> ZipResult<()> {
    if doc_props.is_empty() {
        return Ok(());
    }
    let mut doc_props = doc_props;
    writer.add_directory("docProps", options())?;
    if let Some(app) = doc_props.app.take() {
        writer.start_file("docProps/app.xml", options())?;
        let s = xml_serialize_with_decl(app);
        writer.write(s.as_bytes())?;
    }
    if let Some(core) = doc_props.core.take() {
        writer.start_file("docProps/core.xml", options())?;
        let s = xml_serialize_with_decl(core);
        writer.write(s.as_bytes())?;
    }
    if let Some(custom) = doc_props.custom.take() {
        writer.start_file("docProps/custom.xml", options())?;
        let s = xml_serialize_with_decl(custom);
        writer.write(s.as_bytes())?;
    }
    Ok(())
}

fn options() -> FileOptions {
    FileOptions::default().compression_method(CompressionMethod::Stored)
}

#[cfg(test)]
mod tests {
    use super::write;
    use std::{fs, io::Write};
    #[test]
    fn write_test() {
        // let mut buf = fs::read("../../tests/builtin_style.xlsx").unwrap();
        // let wb = crate::workbook::Workbook::from_file(&mut buf).unwrap();
        // assert!(wb.doc_props.app.is_some());
        // assert!(wb.doc_props.core.is_some());
        // assert!(wb.doc_props.custom.is_some());
        // let res = write(wb).unwrap();
        // let mut f = fs::File::create("tests_output/builtin_style.zip").unwrap();
        // f.write_all(&res).unwrap();
    }
}
