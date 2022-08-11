mod map_obj;

use map_obj::get_map_obj_impl_block;
use proc_macro::TokenStream;
use syn::{parse_macro_input, DeriveInput};

// MapObj means this struct will be used in a hash map as a key and a value.
// It should impl Hash, Eq, PartialEq
#[proc_macro_derive(MapObj)]
pub fn derive_map_obj(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    get_map_obj_impl_block(input).into()
}
