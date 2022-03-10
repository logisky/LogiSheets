extern crate proc_macro;
extern crate proc_macro2;
extern crate syn;
#[macro_use]
extern crate logiutils;
#[macro_use]
extern crate quote;
extern crate paste;

mod container;
mod de;
mod ser;
mod symbol;

use de::get_de_impl_block;
use proc_macro::TokenStream;
use ser::get_ser_impl_block;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_derive(XmlDeserialize, attributes(xmlserde))]
pub fn derive_xml_deserialize(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    get_de_impl_block(input).into()
}

#[proc_macro_derive(XmlSerialize, attributes(xmlserde))]
pub fn derive_xml_serialize(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    get_ser_impl_block(input).into()
}
