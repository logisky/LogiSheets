pub mod logisheets;
mod ooxml;
pub mod reader;
pub mod rtypes;
pub mod workbook;
pub mod writer;
#[cfg(test)]
mod zipdiff;
use thiserror::Error;
use xmlserde::*;

pub mod prelude {
    pub use super::SerdeErr;
    pub use super::ooxml::chart::{
        ChartData, ChartSeries, ChartType, LegendPos, NewChartSeries, SeriesColor, build_chart_xml,
        parse_chart,
    };
    pub use super::ooxml::comments::*;
    pub use super::ooxml::complex_types::*;
    pub use super::ooxml::drawing_part::*;
    // Both modules define a `CtMarker` — same XML elements, different field
    // types (`PlainTextU32` vs the xdr-typed ones). The globs made which one
    // you got depend on their order here, and rustc kept `complex_types`',
    // which has no users at all. Name the one the drawing code actually
    // builds; an explicit re-export beats a glob, so this also settles the
    // ambiguity rather than silencing it.
    pub use super::ooxml::drawing_part::CtMarker;
    pub use super::ooxml::external_links::*;
    pub use super::ooxml::persons::*;
    pub use super::ooxml::pivot_cache_definition::*;
    pub use super::ooxml::pivot_cache_records::*;
    pub use super::ooxml::pivot_shared::*;
    pub use super::ooxml::pivot_table::*;
    pub use super::ooxml::simple_types::*;
    pub use super::ooxml::sst::SstPart;
    pub use super::ooxml::style_sheet::StylesheetPart;
    pub use super::ooxml::table::*;
    pub use super::ooxml::theme::*;
    pub use super::ooxml::threaded_comments::*;
    pub use super::ooxml::workbook::*;
    pub use super::ooxml::worksheet::*;
    pub use super::reader::*;
    pub use super::workbook::{ChartAnchor, ChartAnchorExtent};
    pub use super::workbook::Media;
    pub use super::workbook::PassthroughPart;
    pub use super::workbook::Wb;
    pub use super::workbook::Worksheet;
    pub use super::workbook::WorksheetDrawing;
    pub use super::workbook::Xl;
    pub use super::writer::*;
}

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
