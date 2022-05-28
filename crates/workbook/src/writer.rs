use std::io::Cursor;
use zip::write::{FileOptions, ZipWriter};
use zip::CompressionMethod;

use crate::workbook::Workbook;
use zip::result::ZipResult;

pub fn write(wb: Workbook) -> ZipResult<Vec<u8>> {
    let mut buf = Vec::<u8>::with_capacity(65535);
    let mut writer = ZipWriter::new(Cursor::new(&mut buf));
    let options = FileOptions::default().compression_method(CompressionMethod::Stored);
    todo!()
}
