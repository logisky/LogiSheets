#[macro_use]
extern crate quote;

mod container;
mod de;
mod map_obj;
mod ser;
mod symbol;

use de::get_de_impl_block;
use map_obj::get_map_obj_impl_block;
use ser::get_ser_impl_block;

use proc_macro::TokenStream;

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

// MapObj means this struct will be used in a hash map as a key and a value.
// It should impl Hash, Eq, PartialEq
#[proc_macro_derive(MapObj)]
pub fn derive_map_obj(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    get_map_obj_impl_block(input).into()
}
