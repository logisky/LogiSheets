use case::{convert_camel_from_pascal, convert_camel_from_snake};
use syn::{parse_macro_input, DeriveInput};
mod case;
mod container;
mod symbol;

use container::{Contianer, RenameAll};
use proc_macro::TokenStream;
use quote::quote;

#[proc_macro_derive(TS, attributes(ts))]
pub fn derive_ts(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    get_impl_block(input).into()
}

fn get_impl_block(input: DeriveInput) -> proc_macro2::TokenStream {
    let container = Contianer::from_ast(&input);
    let file_name = container.file_name;
    let is_enum = container.is_enum;
    let rename_all = container.rename_all;
    let ident = container.ident;
    let fields = container.fields;
    let rename = container.rename;
    let ts_name = match rename {
        Some(s) => s,
        None => ident.to_string(),
    };
    let register_func = {
        let field_ds = fields.into_iter().filter(|f| !f.skip).map(|s| {
            let fi = s.ident;
            let rename = s.rename;
            let ty = s.ty;
            let name = match (rename, &rename_all) {
                (None, None) => fi.to_string(),
                (None, Some(RenameAll::CamelCase)) => {
                    let s = fi.to_string();
                    if is_enum {
                        convert_camel_from_pascal(s)
                    } else {
                        convert_camel_from_snake(s)
                    }
                }
                (Some(s), _) => s,
            };
            if let Some(ty) = ty {
                quote! {
                    let dep = <#ty as TS>::_register(manager);
                    deps.insert(dep);
                    let fd = ::gents::FieldDescriptor {
                        ident: #name.to_string(),
                        optional: <#ty as TS>::_is_optional(),
                        ts_ty: <#ty as TS>::_ts_name(),
                    };
                    fields.push(fd);
                }
            } else {
                quote! {
                    let fd = ::gents::FieldDescriptor {
                        ident: #name.to_string(),
                        optional: false,
                        ts_ty: String::from(""),
                    };
                    fields.push(fd);
                }
            }
        });
        let descriptor = if is_enum {
            quote! {
                let _enum = ::gents::EnumDescriptor {
                    dependencies: deps.into_iter().collect(),
                    fields,
                    file_name: #file_name.to_string(),
                    ts_name: #ts_name.to_string(),
                };
                let descriptor = ::gents::Descriptor::Enum(_enum);
            }
        } else {
            quote! {
                let deps_vec = deps.into_iter().collect();
                let _interface = ::gents::InterfaceDescriptor {
                    dependencies: deps_vec,
                    fields,
                    file_name: #file_name.to_string(),
                    ts_name: #ts_name.to_string(),
                };
                let descriptor = ::gents::Descriptor::Interface(_interface);
            }
        };
        quote! {
            fn _register(manager: &mut ::gents::DescriptorManager) -> usize {
                let type_id = std::any::TypeId::of::<Self>();
                let mut deps = ::std::collections::HashSet::<usize>::new();
                let mut fields = vec![];
                #(#field_ds)*
                #descriptor
                manager.registry(type_id, descriptor)
            }
        }
    };
    let ts_name_func = quote! {
        fn _ts_name() -> String {
            #ts_name.to_string()
        }
    };
    quote! {
        impl TS for #ident {
            #register_func
            #ts_name_func
        }
    }
}
