use syn::DeriveInput;

use crate::container::{Container, Derive, FieldsSummary, Generic};

pub fn get_ser_impl_block(input: DeriveInput) -> proc_macro2::TokenStream {
    let container = Container::from_ast(&input, Derive::Serialize);
    let write_ns = match container.with_ns {
        Some(ns) => quote!{
            attrs.push(Attribute::from((b"xmlns".as_ref(), #ns.as_ref())));
        },
        None => quote!{},
    };
    let FieldsSummary {
        children,
        text,
        attrs,
        self_closed_children,
    } = FieldsSummary::from_fields(container.fields);
    if text.is_some() &&
        (children.len() > 0 || self_closed_children.len() > 0) {
        panic!("Cannot owns the text and children at the same time.")
    }
    let is_empty = if text.is_none() && children.len() == 0 && self_closed_children.len() == 0 {
        true
    } else {
        false
    };
    let build_attr_and_push= attrs.into_iter().map(|attr| {
        let name = attr.name.as_ref().unwrap();
        let ident = attr.original.ident.as_ref().unwrap();
        match &attr.generic {
            Generic::Vec(_) => panic!("cannot use a vector in attribute"),
            Generic::Opt(_) => {
                quote! {
                    let mut sr: String;
                    match &self.#ident {
                        Some(v) => {
                            sr = v.serialize();
                            attrs.push(Attribute::from((#name.as_ref(), sr.as_bytes())));
                        },
                        None => {},
                    }
                }
            },
            Generic::None => {
                match &attr.default {
                    Some(path) => quote!{
                        let mut ser;
                        if #path() != self.#ident {
                            ser = self.#ident.serialize();
                            attrs.push(Attribute::from((#name.as_ref(), ser.as_bytes())));
                        }
                    },
                    None => quote! {
                        let ser = self.#ident.serialize();
                        attrs.push(Attribute::from((#name.as_ref(), ser.as_bytes())));
                    },
                }
            },
        }
    });
    let write_text_or_children = if let Some(t) = text {
        let ident = t.original.ident.as_ref().unwrap();
        quote!{
            let r = self.#ident.serialize();
            let event = BytesText::from_plain_str(&r);
            writer.write_event(Event::Text(event));
        }
    } else {
        let write_scf = self_closed_children
            .into_iter()
            .map(|f| {
                let ident = f.original.ident.as_ref().unwrap();
                let name = f.name.as_ref().unwrap();
                quote! {
                    if self.#ident {
                        let event = BytesStart::borrowed_name(#name);
                        writer.write_event(Event::Empty(event));
                    }
                }
            });
        let write_children = children
            .into_iter()
            .map(|f| {
                if f.skip_serializing {
                    quote!{}
                } else {
                    let ident = f.original.ident.as_ref().unwrap();
                    let name = f.name.as_ref().unwrap();
                    quote! {
                        self.#ident.serialize(#name, writer);
                    }
                }
            });
        quote!{
            #(#write_scf)*
            #(#write_children)*
        }
    };
    let ident = &input.ident;
    let write_event= if is_empty {
        quote!{
            writer.write_event(Event::Empty(start));
        }
    } else {
        quote!{
            writer.write_event(Event::Start(start));
            #write_text_or_children
            let end = BytesEnd::borrowed(tag);
            writer.write_event(Event::End(end));
        }
    };
    quote! {
        #[allow(unused_must_use)]
        impl crate::XmlSerialize for #ident {
            fn serialize<W: std::io::Write>(
                &self,
                tag: &[u8],
                writer: &mut quick_xml::Writer<W>,
            ) {
                use quick_xml::events::*;
                use quick_xml::events::attributes::Attribute;
                use crate::XmlValue;
                let start = BytesStart::borrowed_name(tag);
                let mut attrs = Vec::<Attribute>::new();
                #write_ns
                #(#build_attr_and_push)*
                let start = start.with_attributes(attrs);
                #write_event
            }
        }
    }
}
