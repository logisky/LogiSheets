extern crate paste;
extern crate proc_macro;
extern crate quote;
extern crate syn;

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

/// This macro is used to deserialize the String to an Enum Type and
/// serialize the Enum Type to String.
/// The part of serialize or deserialize the enum is refered to this issue.
/// https://github.com/serde-rs/serde/issues/1560
#[proc_macro_attribute]
pub fn serde_st_string_enum(attr: TokenStream, item: TokenStream) -> TokenStream {
    let args = syn::parse_macro_input!(attr as syn::AttributeArgs);
    let camel_case = if args.len() == 0 {
        false
    } else {
        let arg = &args[0];
        match arg {
            syn::NestedMeta::Meta(meta) => match meta {
                syn::Meta::NameValue(nv) => {
                    let p = &nv.path;
                    if p.is_ident("convert_to_camel_case") {
                        if let syn::Lit::Bool(v) = &nv.lit {
                            v.value
                        } else {
                            false
                        }
                    } else {
                        false
                    }
                }
                _ => unreachable!(),
            },
            _ => unreachable!(),
        }
    };
    let enum_item = syn::parse_macro_input!(item as syn::ItemEnum);
    let syn::ItemEnum {
        attrs,
        vis,
        enum_token,
        ident,
        generics,
        brace_token: _,
        variants,
    } = enum_item;
    let vars = variants.iter().map(|v| &v.ident);
    let vars_iter = variants.iter().map(|v| &v.ident);
    let vars_impl = variants.iter().map(|v| &v.ident);
    let vars_str = vars_iter.map(|v| v.to_string());
    let vars_named = variants.iter().map(|v| &v.ident);
    let output = quote! {
        #[allow(non_snake_case, non_camel_case_types)]
        pub mod #ident {
            use serde::{Deserialize, Serialize};
            #[derive(Debug, Deserialize, Serialize, PartialEq, Clone, Hash, Eq)]
            #[serde(untagged)]
            #(#attrs)*
            #vis #enum_token Type#generics {
                #(
                    #[serde(with = #vars_str)]
                    #vars,
                )*
            }
            pub mod DefaultBuilder {
                use paste::paste;
                #(
                    pub fn #vars_impl() -> super::Type {
                        super::Type::#vars_impl
                    }
                    paste! {
                        pub fn [<is #vars_impl>](t: &super::Type) -> bool {
                            *t == super::Type::#vars_impl
                        }
                    }
                )*
            }
            #(
                pub mod #vars_named {
                    use convert_case::{Case, Casing};
                    pub fn serialize<S>(serializer: S) -> Result<S::Ok, S::Error>
                    where
                        S: serde::Serializer,
                    {
                        if #camel_case {
                            let camel = stringify!(#vars_named).to_case(Case::Camel);
                            serializer.serialize_str(camel.as_str())
                        } else {
                            let s = stringify!(#vars_named);
                            serializer.serialize_str(s)
                        }
                    }

                    pub fn deserialize<'de, D>(deserializer: D) -> Result<(), D::Error>
                    where
                        D: serde::Deserializer<'de>,
                    {
                        struct V;
                        impl<'de> serde::de::Visitor<'de> for V {
                            type Value = ();
                            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                                if #camel_case {
                                    let camel = stringify!(#vars_named).to_case(Case::Camel);
                                    f.write_str(camel.as_str())
                                } else {
                                    f.write_str(concat!("\"", stringify!(#vars_named), "\""))
                                }
                            }
                            fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<Self::Value, E> {
                                if #camel_case {
                                    let camel = stringify!(#vars_named).to_case(Case::Camel);
                                    if (value == camel.as_str()) {
                                        Ok(())
                                    } else {
                                        Err(E::invalid_value(serde::de::Unexpected::Str(value), &self))
                                    }
                                } else {
                                    if value == stringify!(#vars_named) {
                                        Ok(())
                                    } else {
                                        Err(E::invalid_value(serde::de::Unexpected::Str(value), &self))
                                    }
                                }
                            }
                        }
                        deserializer.deserialize_str(V)
                    }
                }
            )*
        }
    };
    output.into()
}

#[proc_macro_derive(Handler)]
pub fn derive_handler_fn(item: TokenStream) -> TokenStream {
    let input = parse_macro_input!(item as DeriveInput);
    let data = input.data;
    let ident = input.ident;
    let data_struct = match data {
        syn::Data::Struct(d) => d,
        _ => unimplemented!("This macro only used in Struct now"),
    };
    let fields = data_struct.fields;
    let fields_named = match fields {
        syn::Fields::Named(result) => result.named,
        _ => unimplemented!("Only fields named available"),
    };
    let field_ident_iter = fields_named.iter().map(|f| &f.ident);
    let field_type_iter = fields_named.iter().map(|f| &f.ty);
    let output_tokens = quote! {
        impl #ident {
            #(
                paste::paste! {
                    pub fn [<set_ #field_ident_iter>](&mut self, v: #field_type_iter) {
                        self.#field_ident_iter = v;
                    }
                }
            )*
        }
    };
    output_tokens.into()
}

#[proc_macro_derive(OoxmlHash)]
pub fn derive_ooxml_hash_fn(item: TokenStream) -> TokenStream {
    let input = parse_macro_input!(item as DeriveInput);
    let ident = input.ident;
    let output_tokens = quote! {
        impl std::hash::Hash for #ident {
            fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
                let ser_result = quick_xml::se::to_string(self);
                match ser_result {
                    Ok(s) => s.hash(state),
                    Err(_) => {},
                };
            }
        }

        impl std::cmp::PartialEq for #ident {
            fn eq(&self, other: &Self) -> bool {
                use std::hash::{Hash, Hasher};
                use std::collections::hash_map::DefaultHasher;
                let mut hasher = DefaultHasher::new();
                let mut hasher2 = DefaultHasher::new();
                self.hash(&mut hasher);
                other.hash(&mut hasher2);
                hasher.finish() == hasher2.finish()
            }
        }

        impl std::cmp::Eq for #ident {}
    };
    output_tokens.into()
}
