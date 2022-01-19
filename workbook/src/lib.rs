#[macro_use]
mod defaults;

pub mod app_properties;
pub mod calc_chain;
pub mod chartsheet;
pub mod comments;
pub mod complex_types;
pub mod content_types;
pub mod core_properties;
pub mod custom;
pub mod drawing;
pub mod errors;
pub mod external_link;
pub mod metadata;
pub mod reader;
pub mod relationships;
pub mod shared_string_table;
pub mod sheet_config;
pub mod simple_types;
pub mod styles;
pub mod tables;
pub mod variant;
pub mod workbook;
pub mod worksheet;
pub mod xml_element;

mod namespace;

#[cfg(test)]
mod tests;
